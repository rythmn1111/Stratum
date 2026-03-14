import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from '@solana/spl-token';

export class InvalidAddressError extends Error {
  constructor(message = 'Invalid Solana address.') {
    super(message);
    this.name = 'InvalidAddressError';
  }
}

export class SolPaymentError extends Error {
  constructor(message = 'Solana payment failed.') {
    super(message);
    this.name = 'SolPaymentError';
  }
}

const assertValidSolAddress = (address: string, label: string): PublicKey => {
  try {
    return new PublicKey(address);
  } catch (_error) {
    throw new InvalidAddressError(`${label} is not a valid Solana base58 address.`);
  }
};

const toUsdcBaseUnits = (amountUsdc: number): bigint => {
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new SolPaymentError('Amount must be a positive number.');
  }

  return BigInt(Math.round(amountUsdc * 1_000_000));
};

export const sendSOL = async (
  privateKeyUint8Array: Uint8Array,
  toPublicKeyStr: string,
  amountSol: number,
  rpcUrl: string,
): Promise<{ txSignature: string }> => {
  try {
    const toPublicKey = assertValidSolAddress(toPublicKeyStr, 'Recipient address');

    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      throw new SolPaymentError('Amount must be greater than zero.');
    }

    const fromKeypair = Keypair.fromSecretKey(privateKeyUint8Array);
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

    const connection = new Connection(rpcUrl, 'confirmed');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    const tx = new Transaction({
      feePayer: fromKeypair.publicKey,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports,
      }),
    );

    tx.sign(fromKeypair);
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      'confirmed',
    );

    return { txSignature: signature };
  } catch (error) {
    if (error instanceof InvalidAddressError || error instanceof SolPaymentError) {
      throw error;
    }
    throw new SolPaymentError(error instanceof Error ? error.message : 'Unknown SOL transfer error.');
  } finally {
    privateKeyUint8Array.fill(0);
  }
};

export const sendUSDC_SOL = async (
  privateKeyUint8Array: Uint8Array,
  toPublicKeyStr: string,
  amountUsdc: number,
  usdcMintAddress: string,
  rpcUrl: string,
): Promise<{ txSignature: string }> => {
  try {
    const toPublicKey = assertValidSolAddress(toPublicKeyStr, 'Recipient address');
    const mintPublicKey = assertValidSolAddress(usdcMintAddress, 'USDC mint address');

    const amountBaseUnits = toUsdcBaseUnits(amountUsdc);

    const sender = Keypair.fromSecretKey(privateKeyUint8Array);
    const connection = new Connection(rpcUrl, 'confirmed');

    const senderAta = await getAssociatedTokenAddress(
      mintPublicKey,
      sender.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const senderTokenAccount = await getAccount(connection, senderAta, 'confirmed', TOKEN_PROGRAM_ID);
    if (senderTokenAccount.amount < amountBaseUnits) {
      throw new SolPaymentError('Insufficient USDC balance.');
    }

    const recipientAta = await getAssociatedTokenAddress(
      mintPublicKey,
      toPublicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const instructions = [];

    try {
      await getAccount(connection, recipientAta, 'confirmed', TOKEN_PROGRAM_ID);
    } catch (_error) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          sender.publicKey,
          recipientAta,
          toPublicKey,
          mintPublicKey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    instructions.push(
      createTransferInstruction(
        senderAta,
        recipientAta,
        sender.publicKey,
        amountBaseUnits,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction({
      feePayer: sender.publicKey,
      recentBlockhash: blockhash,
    });

    tx.add(...instructions);
    tx.sign(sender);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      'confirmed',
    );

    return { txSignature: signature };
  } catch (error) {
    if (error instanceof InvalidAddressError || error instanceof SolPaymentError) {
      throw error;
    }
    throw new SolPaymentError(error instanceof Error ? error.message : 'Unknown USDC(SOL) transfer error.');
  } finally {
    privateKeyUint8Array.fill(0);
  }
};

export const getSOLBalance = async (publicKeyStr: string, rpcUrl: string): Promise<string> => {
  try {
    const publicKey = assertValidSolAddress(publicKeyStr, 'Address');

    const connection = new Connection(rpcUrl, 'confirmed');
    const lamports = await connection.getBalance(publicKey, 'confirmed');

    return (lamports / LAMPORTS_PER_SOL).toFixed(9);
  } catch (error) {
    if (error instanceof InvalidAddressError) {
      throw error;
    }
    throw new SolPaymentError(error instanceof Error ? error.message : 'Failed to fetch SOL balance.');
  }
};

export const getUSDCBalance_SOL = async (
  publicKeyStr: string,
  mintAddress: string,
  rpcUrl: string,
): Promise<string> => {
  try {
    const owner = assertValidSolAddress(publicKeyStr, 'Address');
    const mint = assertValidSolAddress(mintAddress, 'USDC mint address');

    const connection = new Connection(rpcUrl, 'confirmed');
    const ata = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    try {
      const account = await getAccount(connection, ata, 'confirmed', TOKEN_PROGRAM_ID);
      return (Number(account.amount) / 1_000_000).toFixed(6);
    } catch (_error) {
      return '0.000000';
    }
  } catch (error) {
    if (error instanceof InvalidAddressError) {
      throw error;
    }
    throw new SolPaymentError(error instanceof Error ? error.message : 'Failed to fetch USDC(SOL) balance.');
  }
};
