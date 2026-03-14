import { Buffer } from 'buffer';
import { CONFIG } from '../config';

const ERC20_ABI = [
  'function transfer(address to, uint amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
];

export interface BroadcastResult {
  txHash: string;
}

export interface WalletBalanceSnapshot {
  eth: string;
  sol: string;
  usdcEth: string;
  usdcSol: string;
}

export const fetchBalances = async (
  addresses: { eth: string; sol: string },
): Promise<WalletBalanceSnapshot> => {
  const { ethers } = require('ethers') as typeof import('ethers');
  const { Connection, LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js') as typeof import('@solana/web3.js');

  const provider = new ethers.JsonRpcProvider(CONFIG.ethRpcUrl);
  const solConnection = new Connection(CONFIG.solRpcUrl, 'confirmed');

  const [ethBalanceWei, solLamports] = await Promise.all([
    provider.getBalance(addresses.eth),
    solConnection.getBalance(new PublicKey(addresses.sol), 'confirmed'),
  ]);

  let usdcEth = '0.00';
  if (CONFIG.usdcEthContract) {
    try {
      const usdcEthContract = new ethers.Contract(CONFIG.usdcEthContract, ERC20_ABI, provider);
      const [decimals, rawBalance] = await Promise.all([
        usdcEthContract.decimals(),
        usdcEthContract.balanceOf(addresses.eth),
      ]);
      usdcEth = Number.parseFloat(ethers.formatUnits(rawBalance, decimals)).toFixed(2);
    } catch (_err) {
      usdcEth = '0.00';
    }
  }

  let usdcSol = '0.00';
  if (CONFIG.usdcSolMint) {
    try {
      const tokenAccounts = await solConnection.getParsedTokenAccountsByOwner(
        new PublicKey(addresses.sol),
        { mint: new PublicKey(CONFIG.usdcSolMint) },
        'confirmed',
      );

      const total = tokenAccounts.value.reduce((sum, item) => {
        const info = (item.account.data as any)?.parsed?.info;
        const uiAmount = Number.parseFloat(info?.tokenAmount?.uiAmountString ?? '0');
        return sum + (Number.isFinite(uiAmount) ? uiAmount : 0);
      }, 0);

      usdcSol = total.toFixed(2);
    } catch (_err) {
      usdcSol = '0.00';
    }
  }

  return {
    eth: Number.parseFloat(ethers.formatEther(ethBalanceWei)).toFixed(4),
    sol: (solLamports / LAMPORTS_PER_SOL).toFixed(4),
    usdcEth,
    usdcSol,
  };
};

export const sendEth = async (
  privateKey: string,
  to: string,
  amountEth: string,
): Promise<BroadcastResult> => {
  const { ethers } = require('ethers') as typeof import('ethers');

  const provider = new ethers.JsonRpcProvider(CONFIG.ethRpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const tx = await wallet.sendTransaction({
    to,
    value: ethers.parseEther(amountEth),
  });

  await tx.wait();
  return { txHash: tx.hash };
};

export const sendUsdcOnEthereum = async (
  privateKey: string,
  to: string,
  amountUsdc: string,
): Promise<BroadcastResult> => {
  const { ethers } = require('ethers') as typeof import('ethers');

  const provider = new ethers.JsonRpcProvider(CONFIG.ethRpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(CONFIG.usdcEthContract, ERC20_ABI, wallet);

  const decimals = await contract.decimals();
  const amount = ethers.parseUnits(amountUsdc, decimals);

  const tx = await contract.transfer(to, amount);
  await tx.wait();
  return { txHash: tx.hash };
};

export const sendSol = async (
  privateKeyBase64: string,
  to: string,
  amountSol: string,
): Promise<BroadcastResult> => {
  const {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmRawTransaction,
  } = require('@solana/web3.js') as typeof import('@solana/web3.js');

  const solConnection = new Connection(CONFIG.solRpcUrl, 'confirmed');

  const secretKey = Buffer.from(privateKeyBase64, 'base64');
  const fromKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: new PublicKey(to),
      lamports: Number.parseFloat(amountSol) * LAMPORTS_PER_SOL,
    }),
  );

  tx.feePayer = fromKeypair.publicKey;
  tx.recentBlockhash = (await solConnection.getLatestBlockhash('finalized')).blockhash;

  tx.sign(fromKeypair);
  const raw = tx.serialize();

  const signature = await sendAndConfirmRawTransaction(solConnection, raw, {
    commitment: 'confirmed',
  });

  secretKey.fill(0);
  return { txHash: signature };
};

export const sendUsdcOnSolana = async (
  privateKeyBase64: string,
  to: string,
  amountUsdc: string,
): Promise<BroadcastResult> => {
  const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js') as typeof import('@solana/web3.js');
  const {
    createTransferInstruction,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    getMint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  } = require('@solana/spl-token') as typeof import('@solana/spl-token');

  if (!CONFIG.usdcSolMint) {
    throw new Error('USDC Solana mint is not configured.');
  }

  const solConnection = new Connection(CONFIG.solRpcUrl, 'confirmed');
  const mint = new PublicKey(CONFIG.usdcSolMint);
  const destinationOwner = new PublicKey(to);

  const secretKey = Buffer.from(privateKeyBase64, 'base64');
  const fromKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  try {
    const mintInfo = await getMint(solConnection, mint, 'confirmed');
    const amount = BigInt(Math.round(Number.parseFloat(amountUsdc) * 10 ** mintInfo.decimals));

    if (amount <= 0n) {
      throw new Error('Amount must be greater than zero.');
    }

    const fromTokenAddress = getAssociatedTokenAddressSync(
      mint,
      fromKeypair.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const toTokenAddress = getAssociatedTokenAddressSync(
      mint,
      destinationOwner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const destinationTokenInfo = await solConnection.getAccountInfo(toTokenAddress, 'confirmed');
    const tx = new Transaction();

    if (!destinationTokenInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          fromKeypair.publicKey,
          toTokenAddress,
          destinationOwner,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    tx.add(
      createTransferInstruction(
        fromTokenAddress,
        toTokenAddress,
        fromKeypair.publicKey,
        amount,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    const signature = await sendAndConfirmTransaction(solConnection, tx, [fromKeypair], {
      commitment: 'confirmed',
      skipPreflight: false,
    });

    return { txHash: signature };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`USDC transfer on Solana failed: ${error.message}`);
    }
    throw new Error('USDC transfer on Solana failed.');
  } finally {
    secretKey.fill(0);
  }
};
