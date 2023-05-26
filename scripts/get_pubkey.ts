import {
    JsonRpcProvider,
    fromSerializedSignature,
    localnetConnection, devnetConnection, testnetConnection,
} from "@mysten/sui.js";

import {bytesToHex} from "@noble/hashes/utils";

const default_provider = new JsonRpcProvider(localnetConnection);

export async function getPubkeyFromHistory(address: string, provider = default_provider) {
    const txs = await provider.queryTransactionBlocks({
        filter: {FromAddress: address},
        options: {showInput: true},
        limit: 1,
    });
    const tx = txs.data[0];
    if(!tx) return undefined;
    const signature = tx.transaction!.txSignatures;

    const decodedSignatures = signature.map(fromSerializedSignature);
    /*
    const printSig = {
        0: {
            scheme: decodedSignatures[0].signatureScheme,
            sig: bytesToHex(decodedSignatures[0].signature),
            pubKey: bytesToHex(decodedSignatures[0].pubKey.toBytes())
        },
        1: {
            scheme: decodedSignatures[1].signatureScheme,
            sig: bytesToHex(decodedSignatures[1].signature),
            pubKey: bytesToHex(decodedSignatures[1].pubKey.toBytes())
        }
    };
    console.table(printSig);
    */
    return decodedSignatures[0].pubKey;
}