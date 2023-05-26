import {
    Ed25519Keypair,
    JsonRpcProvider,
    RawSigner,
    TransactionBlock,
    fromSerializedSignature,
    fromB64,
    toB64, localnetConnection, devnetConnection, testnetConnection,
} from "@mysten/sui.js";
import { blake2b } from "@noble/hashes/blake2b";

import {toB58} from "@mysten/bcs";
import {bytesToHex} from "@noble/hashes/utils";
import {getPubkeyFromHistory} from "./get_pubkey";

const default_provider = new JsonRpcProvider(localnetConnection);

//const default_provider = new JsonRpcProvider(devnetConnection);

export async function faucet(to: string, provider: JsonRpcProvider = default_provider) {
    to = to.slice(2);
    console.log("----use faucet:", provider.connection.faucet);
    console.log("----faucet to", to);
    await provider.requestSuiFromFaucet(to);
    const coins = await provider.getAllBalances({owner: to});
    console.log("coins:", coins.map(coin => coin));
}
export function createAccount(provider: JsonRpcProvider = default_provider): RawSigner {
    const keypair = new Ed25519Keypair();
    return new RawSigner(keypair, provider);
}

export function createAccounts(count: number, provider: JsonRpcProvider = default_provider): RawSigner[] {
    return Array(count).fill(0).map(() => createAccount(provider));
}

async function sponsoredTransaction(sender: string, sponsor:string, gasIndex: number, tx: TransactionBlock, provider = default_provider) {
    tx.setSender(sender);
    tx.setGasOwner(sponsor);
    const coins = await provider.getCoins({owner: sponsor});
    //console.log(coins);
    tx.setGasPayment(coins.data.slice(gasIndex, gasIndex+1).map(coin=>({objectId: coin.coinObjectId, version: coin.version, digest: coin.digest})))
    //tx.setGasBudget(BigInt(coins.data[0].balance));
    return tx;
}

export function hashTypedData(typeTag: string, data: Uint8Array): Uint8Array {
    const typeTagBytes = Array.from(`${typeTag}::`).map((e) => e.charCodeAt(0));

    const dataWithTag = new Uint8Array(typeTagBytes.length + data.length);
    dataWithTag.set(typeTagBytes);
    dataWithTag.set(data, typeTagBytes.length);

    return blake2b(dataWithTag, { dkLen: 32 });
}

const main = async () => {
    const provider = default_provider;
    const [sender, sponsor, recipient] = createAccounts(3);
    await faucet(await sender.getAddress());
    await faucet(await sponsor.getAddress());


    const senderCoin = await provider.getCoins({ owner: await sender.getAddress() });
    const coinObjectIds = senderCoin.data.map(coin=>coin.coinObjectId);

    const to = await recipient.getAddress();
    const txs = coinObjectIds.map(objId=>{
        const tx = new TransactionBlock();
        tx.transferObjects([tx.object(objId)], tx.pure(to));
        return tx;
    });
    for(const i in txs) {
        const tx = txs[i];
        await sponsoredTransaction(await sender.getAddress(), await sponsor.getAddress(), Number(i), tx);
    }

    const signedTxs = await Promise.all(txs.map(async tx=>{
        const txBytes = await tx.build({ provider });
        const sponsorSig = await sponsor.signTransactionBlock({ transactionBlock: txBytes });
        const senderSig = await sender.signTransactionBlock({ transactionBlock: txBytes });
        return {
            txBytes,
            signature: [senderSig.signature, sponsorSig.signature],
        }
    }));
    const results = await Promise.all(signedTxs.map(async signedTx=>{
        return await provider.executeTransactionBlock({
            transactionBlock: signedTx.txBytes,
            signature: signedTx.signature,
            options: {
                showEffects: false,
                showBalanceChanges: false,
                showEvents: false,
                showInput: false,
                showObjectChanges: false,
            },
            requestType: "WaitForLocalExecution"
        });
    }));
    console.log(results);
    const recipientCoin = await provider.getCoins({ owner: await recipient.getAddress() });
    for(const fromCoin of senderCoin.data) {
        const transsferdCoin = recipientCoin.data.find((toCoin)=>toCoin.coinObjectId === fromCoin.coinObjectId);
        if(!transsferdCoin) throw "coin not found";
        if (transsferdCoin.balance !== fromCoin.balance) {
            throw "Balance error";
        }
    }
    console.log("success");
};

main();