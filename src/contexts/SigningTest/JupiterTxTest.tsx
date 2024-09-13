import { useState } from 'react';
import { useUnifiedWallet } from '../UnifiedWalletContext';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import tw from 'twin.macro';
import { useConnection } from '@solana/wallet-adapter-react';

const JupiterTxTest = (props: { rpcUrl: string }) => {
  const { publicKey, signTransaction } = useUnifiedWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);

  const fetchAndSwap = async (props: { verTx: boolean }) => {
    if (!signTransaction) {
      throw new Error('signTransaction not available');
    }

    try {
      setLoading(true);

      if (!publicKey) {
        throw Error('user is disconnected');
      }

      const qs = new URLSearchParams({
        inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        outputMint: 'So11111111111111111111111111111111111111112',
        amount: '100000', // 0.1 USDC
        slippageBps: '300',
        swapMode: 'ExactIn',
        onlyDirectRoutes: props.verTx ? 'false' : 'true',
        asLegacyTransaction: props.verTx ? 'false' : 'true',
        maxAccounts: '64',
        minimizeSlippage: 'false',
      });

      const quoteResponse = await (await fetch(`https://quote-api.jup.ag/v6/quote?${qs.toString()}`)).json();
      const swapResponse = await (
        await fetch('https://quote-api.jup.ag/v6/swap', {
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userPublicKey: publicKey?.toString(),
            wrapAndUnwrapSol: true,
            prioritizationFeeLamports: {
              priorityLevelWithMaxLamports: { maxLamports: 4000000, global: false, priorityLevel: 'high' },
            },
            asLegacyTransaction: props.verTx ? false : true,
            dynamicComputeUnitLimit: true,
            allowOptimizedWrappedSolTokenAccount: false,
            quoteResponse,
            dynamicSlippage: { maxBps: 300 },
          }),
          method: 'POST',
        })
      ).json();

      console.log({
        quoteResponse,
        swapResponse,
      });

      const latestBlockHash = await connection.getLatestBlockhash();

      // Execute the transaction
      const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = props.verTx
        ? VersionedTransaction.deserialize(swapTransactionBuf)
        : Transaction.from(swapTransactionBuf);
      const signedTx = await signTransaction(transaction);

      const rawTransaction = signedTx.serialize();
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });

      console.log(`https://solscan.io/tx/${txid}`);

      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: txid,
      });
      toast.success(`Success https://solscan.io/tx/${txid}`);
    } catch (err) {
      console.log(err);
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p css={tw`text-white text-xs mt-2 mb-1`}>Jupiter Swap</p>

      <div css={tw`flex gap-x-2`}>
        <button
          data-test-id="sign-transaction-button"
          onClick={() => fetchAndSwap({ verTx: true })}
          disabled={loading}
          css={tw`rounded-lg py-1 px-2 text-xs bg-v2-lily/70 text-black disabled:opacity-50`}
        >
          Fetch & Swap (0.1 USDC)
        </button>

        <button
          data-test-id="sign-transaction-button"
          onClick={() => fetchAndSwap({ verTx: false })}
          disabled={loading}
          css={tw`rounded-lg py-1 px-2 text-xs bg-v2-lily/70 text-black disabled:opacity-50`}
        >
          Fetch & Swap (0.1 USDC) (Legacy)
        </button>
      </div>
    </div>
  );
};

export default JupiterTxTest;