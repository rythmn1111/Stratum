import { ChainAsset, PaymentRequest } from '../types';

const POSITIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export const isPositiveAmount = (amount: string): boolean => {
  const trimmed = amount.trim();
  if (!POSITIVE_DECIMAL_PATTERN.test(trimmed)) {
    return false;
  }

  return Number.parseFloat(trimmed) > 0;
};

export const validateRecipientByAsset = (asset: ChainAsset, recipient: string): void => {
  const trimmed = recipient.trim();

  if (!trimmed) {
    throw new Error('Recipient address is required.');
  }

  if (asset === 'ETH' || asset === 'USDC_ETH') {
    const { isAddress } = require('ethers') as typeof import('ethers');
    if (!isAddress(trimmed)) {
      throw new Error('Invalid Ethereum address for selected asset.');
    }
    return;
  }

  const { PublicKey } = require('@solana/web3.js') as typeof import('@solana/web3.js');
  try {
    // Construction throws when base58 address is malformed.
    void new PublicKey(trimmed);
  } catch (_error) {
    throw new Error('Invalid Solana address for selected asset.');
  }
};

export const validatePaymentRequest = (request: PaymentRequest): void => {
  if (!isPositiveAmount(request.amount)) {
    throw new Error('Amount must be a valid number greater than zero.');
  }

  validateRecipientByAsset(request.asset, request.recipient);
};
