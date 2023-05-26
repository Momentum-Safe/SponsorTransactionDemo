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

function sponsoredTransaction(sender: string, sponsor:string, tx: TransactionBlock) {
    tx.setSender(sender);
    tx.setGasOwner(sponsor);
    //const coins = await provider.getCoins({owner:await sponsor.getAddress()});
    //console.log(coins);
    //tx.setGasPayment(coins.data.map(coin=>({objectId: coin.coinObjectId, version: coin.version, digest: coin.digest})))
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

function getDigestFromBytes(bytes: Uint8Array) {
    const hash = hashTypedData('TransactionData', bytes);
    return toB58(hash);
}

const main = async () => {
    const provider = default_provider;
    const [sender, sponsor, recipient] = createAccounts(3);
    await faucet(await sender.getAddress());
    await faucet(await sponsor.getAddress());


    const senderCoin = await provider.getCoins({ owner: await sender.getAddress() });
    const coinObjectIds = senderCoin.data.map(coin=>coin.coinObjectId);

    const tx = new TransactionBlock();
    tx.transferObjects(coinObjectIds.map(objId=>tx.object(objId)), tx.pure(await recipient.getAddress()));
    // fill in gas owner and sender
    sponsoredTransaction(await sender.getAddress(), await sponsor.getAddress(), tx);
    const txBytes = await tx.build({ provider });
    const sponsorSig  = await sponsor.signTransactionBlock({ transactionBlock: txBytes });
    const senderSig = await sender.signTransactionBlock({ transactionBlock: txBytes });
    console.log(Buffer.from(senderSig.signature, 'base64').toString("hex"));
    const result = await provider.executeTransactionBlock({
        transactionBlock: txBytes,
        signature: [senderSig.signature, sponsorSig.signature],
        options: {
            showEffects: false,
            showBalanceChanges: true,
            showEvents: false,
            showInput: false,
            showObjectChanges: false,
        },
    });
    console.log(result);

    const recipientCoin = await provider.getCoins({ owner: await recipient.getAddress() });
    for(const fromCoin of senderCoin.data) {
        const transsferdCoin = recipientCoin.data.find((toCoin)=>toCoin.coinObjectId === fromCoin.coinObjectId);
        if(!transsferdCoin) throw "coin not found";
        if (transsferdCoin.balance !== fromCoin.balance) {
            throw "Balance error";
        }
    }
    console.log("success");
    const txid = getDigestFromBytes(txBytes);
    console.log(txid);

    const senderPk = await getPubkeyFromHistory(await sender.getAddress());
    console.log("sender public key:", senderPk!.toBase64());
};

main();