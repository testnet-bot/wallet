import { buildSwapTx, sendTransaction } from '../blockchain/txBuilder';

export async function swapTokens(walletAddress: string, tokens: any[]) {
    let totalSwapped = 0;
    let fee = 0;

    for (const token of tokens) {
        const tx = await buildSwapTx(walletAddress, token.symbol, token.balance);
        const receipt = await sendTransaction(tx);
        totalSwapped += receipt.amountOut;
    }

    fee = totalSwapped * 0.025; // 2.5% protocol fee
    return { totalSwapped, fee, netReceived: totalSwapped - fee };
}
