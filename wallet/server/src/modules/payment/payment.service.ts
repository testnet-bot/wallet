import { prisma } from '../../config/database.js';
import { getProvider } from '../../blockchain/provider.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { ethers, Interface } from 'ethers';
import { logger } from '../../utils/logger.js';

const REVENUE_ADDRESS = process.env.REVENUE_ADDRESS;
const ERC20_ABI = ["event Transfer(address indexed from, address indexed to, uint256 value)"];

export const paymentService = {
  /**
   * Creates a pending payment record (Intent)
   */
  async createIntent(wallet: string, amount: number, chain: string) {
  
    return await prisma.payment.create({
      data: {
        wallet: wallet.toLowerCase(),
        amount,
        chain,
        confirmed: false
      }
    });
  },

  /**
   * Heavy-Duty Transaction Verifier
   * Validates recipient AND the actual amount sent.
   */
  async verifyTransaction(paymentId: string, txHash: string) {
  
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error("Payment record not found");

    const chainConfig = EVM_CHAINS.find(c => c.name === payment.chain);
    if (!chainConfig) throw new Error(`Chain ${payment.chain} not supported`);

    const provider = getProvider(chainConfig.rpc);
    
    // Fetch Receipt & Tx Data
    const [receipt, tx] = await Promise.all([
      provider.getTransactionReceipt(txHash),
      provider.getTransaction(txHash)
    ]);

    if (!receipt || receipt.status !== 1 || !tx) {
      throw new Error("Transaction is still pending or failed on-chain");
    }

    // Security Check: Native Transfer (ETH/BNB/POL)
    const isNativeToMe = receipt.to?.toLowerCase() === REVENUE_ADDRESS?.toLowerCase();
    const nativeValueMatches = parseFloat(ethers.formatEther(tx.value)) >= payment.amount * 0.98;

    // Security Check: ERC20 Transfer (USDC/USDT)
    let isTokenVerified = false;
    const iface = new Interface(ERC20_ABI);
    
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === 'Transfer' && parsed.args.to.toLowerCase() === REVENUE_ADDRESS?.toLowerCase()) {
      
          const rawValue = parsed.args.value;
          const val6 = parseFloat(ethers.formatUnits(rawValue, 6));
          const val18 = parseFloat(ethers.formatUnits(rawValue, 18));
          
          if (val6 >= payment.amount * 0.98 || val18 >= payment.amount * 0.98) {
            isTokenVerified = true;
            break;
          }
        }
      } catch { continue; }
    }

    if ((isNativeToMe && nativeValueMatches) || isTokenVerified) {
      logger.info(`[Payment] Success: ${txHash} for $${payment.amount}`);
      
  
      return await prisma.payment.update({
        where: { id: paymentId },
        data: { txHash, confirmed: true }
      });
    }

    throw new Error("Funds did not reach WIP or amount was insufficient");
  }
};
