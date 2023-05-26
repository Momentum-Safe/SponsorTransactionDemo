# Sponosor Transaction Demo
Demo script to test [sponsor transaction](https://docs.sui.io/learn/sponsored-transactions) of sui.

## Prerequisite
Install latest sui binary from [here](https://github.com/MystenLabs/sui/releases).

## Run script
1. Start local node
    ```shell
    yarn faucet-node
    ```
2. Single sponsor transaction
    ```shell
    npx ts-node scripts/sponsor-transaction.ts
    ```
3. Concurrence sponsor transactions(with different gas object)
    ```shell
    npx ts-node scripts/multi_gas.ts
    ```

## About Sponsor Transaction
Sponsor Transaction allow one person to pay gas fee for the transaction from another person.
The Sponsor Transaction has same structure as normal transaction, except that the `GasOwner` is the sponsor.
Both the sender and sponsor need to sign the transaction.

### Limitation
Transactions require specifying `GAS Payments`, which contains the `objectid`, `version`, and `digest`.
If the version/digest changes before the transaction is submitted, the transaction cannot be validated by sui nodes.
Therefore, sponsor cannot pay gas for multiple transactions using the same `GSS Object` at same time.
```ts
type GasObject = {
   objectId: string;
   version: number;
   digest: string;
}
```