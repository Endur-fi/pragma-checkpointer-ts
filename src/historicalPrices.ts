import { plot, Plot } from "nodeplotlib";
import { getProvider } from ".";
import { CairoCustomEnum, Contract } from "starknet";

async function historicalPrice() {
    const PRAGMA = '0x02a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b'
    const provider = getProvider();
    const cls = await provider.getClassAt(PRAGMA);
    const pragmaContract = new Contract(cls.abi, PRAGMA, provider);

    const xSTRK_USD = '1629317993172502401860';
    const xSTRKDataType = new CairoCustomEnum({SpotEntry: xSTRK_USD});
    const STRK_USD = '6004514686061859652';
    const STRKDataType = new CairoCustomEnum({SpotEntry: STRK_USD});

    let latestblock = await provider.getBlock('latest');
    let blockNumber = latestblock.block_number;
    const prices: number[] = [];
    const avgPrices: number[] = [];
    const blocks: number[] = [];
    while (blockNumber > latestblock.block_number - 30000) {
        const output: any = await pragmaContract.call('get_data_median', [xSTRKDataType], {
            blockIdentifier: blockNumber
        });
        const outputSTRK: any = await pragmaContract.call('get_data_median', [STRKDataType], {
            blockIdentifier: blockNumber
        });
        console.log('Block: ', blockNumber, 'Price: ', Number(output.price) / Number(outputSTRK.price), 'Timestamp: ', new Date(Number(output.last_updated_timestamp) * 1000));
        blockNumber -= 100;
        prices.push(Number(output.price) / Number(outputSTRK.price));
        const last24ItemsAvgPrice = prices.slice(-24).reduce((a, b) => a + b, 0) / prices.slice(-24).length;
        console.log('Last 24 items avg price: ', last24ItemsAvgPrice);
        avgPrices.push(last24ItemsAvgPrice);
        blocks.push(blockNumber);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const data: Plot[] = [
        {
          x: avgPrices,
          y: blocks,
          type: 'scatter',
        },
    ];
    plot(data);
}

historicalPrice().catch(console.error);