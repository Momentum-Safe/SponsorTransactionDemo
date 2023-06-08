import {
    JsonRpcProvider,
    PubkeyWeightPair, PublicKey,
    SerializedSignature,
    SignerWithProvider,
    SuiAddress,
    toMultiSigAddress,
    combinePartialSigs
} from "@mysten/sui.js";
import {blake2b} from "@noble/hashes/blake2b";

export class MultiRawSigner extends SignerWithProvider {
    public readonly pksWeightPairs: PubkeyWeightPair[];
    public readonly threshold: number;

    constructor(pks: PubkeyWeightPair[], threshold: number, provider: JsonRpcProvider) {
        super(provider);
        this.pksWeightPairs = pks;
        this.threshold = threshold;
    }

    async getAddress(): Promise<SuiAddress> {
        return toMultiSigAddress(this.pksWeightPairs, this.threshold);
    }

    async signData(data: Uint8Array): Promise<SerializedSignature> {
        throw "don't support";
    }

    connect(provider: JsonRpcProvider): MultiRawSigner {
        return new MultiRawSigner(this.pksWeightPairs, this.threshold, provider);
    }

    combinePartialSigs(
        sigs: SerializedSignature[],
    ): SerializedSignature {
        return combinePartialSigs(sigs, this.pksWeightPairs, this.threshold);
    }

    static new(pubkeys: PublicKey[], weights: number[], threshold: number, provider: JsonRpcProvider): MultiRawSigner {
        if (pubkeys.length != weights.length) throw "pubkeys and weigths mismatch";
        let weightSum = 0;
        weights.forEach(weight=>{
            if(!Number.isInteger(weight)) throw "weight should be integer";
            if(weight < 1) throw "weight too small";
            if(weight > 255) throw "weight too large";
            weightSum += weight;
        });
        if (weightSum < threshold) "weightSum < threshold";
        if (threshold > 65535) throw "threshold too big";
        const pks = pubkeys.map((pubkey, index) => ({
            pubKey: pubkey,
            weight: weights[index],
        }));
        return new MultiRawSigner(pks, threshold, provider);
    }
}
