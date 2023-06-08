import {
    Ed25519Keypair,
    JsonRpcProvider,
    RawSigner,
    TransactionBlock,
    localnetConnection
} from "@mysten/sui.js";
import { blake2b } from "@noble/hashes/blake2b";
import {MultiRawSigner} from "./MultiRawSigner";

const default_provider = new JsonRpcProvider(localnetConnection);

async function faucet(to: string, provider: JsonRpcProvider = default_provider) {
    to = to.slice(2);
    console.log("----use faucet:", provider.connection.faucet);
    console.log("----faucet to", to);
    await provider.requestSuiFromFaucet(to);
    const coins = await provider.getAllBalances({owner: to});
    console.log("coins:", coins.map(coin => coin));
}

function createMultiAccount(ownerCount: number, threshold: number, provider: JsonRpcProvider = default_provider) {
    const keypairs = Array(ownerCount).fill(0).map(() => new Ed25519Keypair());
    const pks = keypairs.map(keypair=>keypair.getPublicKey());
    const weights = pks.map(()=>1);
    const owners = keypairs.map(keypair=> new RawSigner(keypair, provider));
    return {
        multiSigner: MultiRawSigner.new(pks, weights, threshold, provider),
        owners,
    };
}

export function hashTypedData(typeTag: string, data: Uint8Array): Uint8Array {
    const typeTagBytes = Array.from(`${typeTag}::`).map((e) => e.charCodeAt(0));

    const dataWithTag = new Uint8Array(typeTagBytes.length + data.length);
    dataWithTag.set(typeTagBytes);
    dataWithTag.set(data, typeTagBytes.length);

    return blake2b(dataWithTag, { dkLen: 32 });
}

export function createAccount(provider: JsonRpcProvider = default_provider): RawSigner {
    const keypair = new Ed25519Keypair();
    return new RawSigner(keypair, provider);
}


const main = async () => {
    const provider = default_provider;

    const sponsor = createAccount();
    const multiAccount = createMultiAccount(3, 2);
    const sender = multiAccount.multiSigner;
    const owners = multiAccount.owners;
    const recipient = owners[0];

    await faucet(await sender.getAddress());

    const senderCoin = await provider.getCoins({ owner: await sender.getAddress() });
    const coinObjectIds = senderCoin.data.map(coin=>coin.coinObjectId);

    const tx = new TransactionBlock();
    tx.transferObjects(coinObjectIds.slice(1).map(objId=>tx.object(objId)), tx.pure(await recipient.getAddress()));
    tx.setSender(await sender.getAddress());
    const txBytes = await tx.build({ provider });
    const ownerSigs = await Promise.all(owners.map(owner=>owner.signTransactionBlock({ transactionBlock: txBytes })));
    const senderSig = sender.combinePartialSigs(ownerSigs.map(ownerSig=>ownerSig.signature));

    const result = await provider.executeTransactionBlock({
        transactionBlock: txBytes,
        signature: senderSig,
        options: {
            showEffects: false,
            showBalanceChanges: true,
            showEvents: false,
            showInput: false,
            showObjectChanges: false,
        },
    });
    console.log(result);
};

main().then();