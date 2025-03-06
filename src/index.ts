import dotenv from 'dotenv';
dotenv.config();
import { getDefaultStoreConfig, IConfig, Network, Store } from "@strkfarm/sdk";
import axios from "axios";
import { CairoCustomEnum, Call, constants, Contract, RpcProvider, TransactionExecutionStatus } from "starknet";

const MAX_CHECKPOINT_LAG = 30 * 60 * 1000; // 30 minutes

export function getProvider() {
    return new RpcProvider({
        nodeUrl: 'https://starknet-mainnet.public.blastapi.io'
    })
}

function getAccount(accountKey: string) {
    const config: IConfig = {
        provider: getProvider(),
        network: Network.mainnet,
        stage: 'production'
    }
    const storeConfig = getDefaultStoreConfig(Network.mainnet);
    storeConfig.ACCOUNTS_FILE_NAME = "accounts-risk.json"
    const store = new Store(config, {
        ...storeConfig,
        PASSWORD: process.env.ACCOUNT_SECURE_PASSWORD || '',
    });
    
    return store.getAccount(accountKey, constants.TRANSACTION_VERSION.V3);
}

async function main() {
    console.log('====================================');
    console.log('Starting job');
    const PRAGMA = '0x02a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b'
    const provider = getProvider();
    const cls = await provider.getClassAt(PRAGMA)
    const pragmaContract = new Contract(cls.abi, PRAGMA, provider);

    const xSTRK_USD = '1629317993172502401860';
    const STRK_USD = '6004514686061859652';

    const now = new Date();
    const calls: Call[] = [];

    // xSTRK
    const xSTRKDataType = new CairoCustomEnum({SpotEntry: xSTRK_USD});
    const aggregationMode = new CairoCustomEnum({Median: {}});
    const xSTRKLastCheckPoint: any = await pragmaContract.call('get_latest_checkpoint', [xSTRKDataType, aggregationMode]);
    const lastTime = new Date(Number(xSTRKLastCheckPoint.timestamp) * 1000);

    const diff = now.getTime() - lastTime.getTime();
    console.log('Last xSTRK checkpoint: ', lastTime, 'Diff (sec): ', diff);
    if (diff > MAX_CHECKPOINT_LAG) {
        calls.push(pragmaContract.populate('set_checkpoint', [xSTRKDataType, aggregationMode]));
    } else {
        console.log('No need to update xSTRK');
    }

    // const xSTRKLastCheckPointIndex = await pragmaContract.call('get_latest_checkpoint_index', [xSTRKDataType, aggregationMode]);
    // console.log(xSTRKLastCheckPointIndex);

    // const checkPointxSTRK: any = await pragmaContract.call('get_checkpoint', [xSTRKDataType, 450, aggregationMode]);
    // console.log(checkPointxSTRK, new Date(Number(checkPointxSTRK.timestamp) * 1000))

    // STRK
    const STRKDataType = new CairoCustomEnum({SpotEntry: STRK_USD});
    const STRKLastCheckPoint: any = await pragmaContract.call('get_latest_checkpoint', [STRKDataType, aggregationMode]);
    const lastTimeSTRK = new Date(Number(STRKLastCheckPoint.timestamp) * 1000);

    const diffSTRK = now.getTime() - lastTimeSTRK.getTime();
    console.log('Last STRK checkpoint: ', lastTimeSTRK, 'Diff (sec): ', diffSTRK);
    if (diffSTRK > MAX_CHECKPOINT_LAG) {
        calls.push(pragmaContract.populate('set_checkpoint', [STRKDataType, aggregationMode]));
    } else {
        console.log('No need to update STRK');
    }

    // send calls
    if (calls.length > 0) {
        console.log('Sending transaction: ', calls.length);
        const acc = getAccount('risk-manager');
        const gas = await acc.estimateInvokeFee(calls);
        const tx = await acc.execute(calls, {
            resourceBounds: gas.resourceBounds,
        })
        console.log(`Transaction hash: ${tx.transaction_hash}`);
        await provider.waitForTransaction(tx.transaction_hash, {
            successStates: [TransactionExecutionStatus.SUCCEEDED]
        });
        console.log('Transaction succeeded');
    }

    // if heart beat url configured, send a get request to it
    // ensures the team is notified if the job is down
    if (process.env.HEARTBEAT_URL) {
        await axios.get(process.env.HEARTBEAT_URL);
    }
}

main().catch(console.error);