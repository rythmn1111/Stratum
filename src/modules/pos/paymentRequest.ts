import { Buffer } from 'buffer';
import QuickCrypto from 'react-native-quick-crypto';

export type PaymentChain = 'ETH' | 'SOL' | 'USDC_ETH' | 'USDC_SOL';

export type PaymentRequest = {
  requestId: string;
  merchantAddress: string;
  chain: PaymentChain;
  amount: string;
  createdAt: number;
  expiresAt: number;
};

export type PaymentResult = {
  requestId: string;
  txHash: string;
  chain: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  completedAt: number;
};

export class ExpiredRequestError extends Error {
  constructor(message = 'Payment request has expired.') {
    super(message);
    this.name = 'ExpiredRequestError';
  }
}

export class InvalidRequestError extends Error {
  constructor(message = 'Invalid payment request payload.') {
    super(message);
    this.name = 'InvalidRequestError';
  }
}

const REQUEST_TTL_MS = 300_000;

const ALLOWED_CHAINS: ReadonlySet<PaymentChain> = new Set(['ETH', 'SOL', 'USDC_ETH', 'USDC_SOL']);

const isPositiveDecimal = (value: string): boolean => {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) {
    return false;
  }
  return Number.parseFloat(normalized) > 0;
};

const randomHex = (bytes: number): string => {
  const randomBytes = (QuickCrypto as unknown as {
    randomBytes: (size: number) => Buffer;
  }).randomBytes;

  const buf = randomBytes(bytes);
  const hex = buf.toString('hex');
  buf.fill(0);
  return hex;
};

const generateUuidV4 = (): string => {
  const hex = randomHex(16);
  const chars = hex.split('');

  // RFC4122 UUIDv4 bits.
  chars[12] = '4';
  const variantNibble = Number.parseInt(chars[16], 16);
  chars[16] = ((variantNibble & 0x3) | 0x8).toString(16);

  return `${chars.slice(0, 8).join('')}-${chars.slice(8, 12).join('')}-${chars.slice(12, 16).join('')}-${chars.slice(16, 20).join('')}-${chars.slice(20, 32).join('')}`;
};

const assertValidRequest = (request: PaymentRequest): void => {
  if (!request.requestId || typeof request.requestId !== 'string') {
    throw new InvalidRequestError('requestId is required.');
  }
  if (!request.merchantAddress || typeof request.merchantAddress !== 'string') {
    throw new InvalidRequestError('merchantAddress is required.');
  }
  if (!ALLOWED_CHAINS.has(request.chain)) {
    throw new InvalidRequestError('chain is invalid.');
  }
  if (!isPositiveDecimal(request.amount)) {
    throw new InvalidRequestError('amount must be a positive decimal string.');
  }
  if (!Number.isFinite(request.createdAt) || !Number.isFinite(request.expiresAt)) {
    throw new InvalidRequestError('createdAt/expiresAt must be valid numbers.');
  }
  if (request.expiresAt <= request.createdAt) {
    throw new InvalidRequestError('expiresAt must be greater than createdAt.');
  }
};

const buildUri = (scheme: 'ethereum' | 'solana', address: string, amount: string, requestId: string): string => {
  const query = `amount=${encodeURIComponent(amount)}&requestId=${encodeURIComponent(requestId)}`;
  return `${scheme}:${address}?${query}`;
};

const decodeFromUri = (uri: string): PaymentRequest => {
  const [schemeAndAddress, queryString = ''] = uri.split('?');
  const schemeSep = schemeAndAddress.indexOf(':');

  if (schemeSep <= 0) {
    throw new InvalidRequestError('Invalid payment URI.');
  }

  const scheme = schemeAndAddress.slice(0, schemeSep).toLowerCase();
  const merchantAddress = schemeAndAddress.slice(schemeSep + 1);

  if (!merchantAddress) {
    throw new InvalidRequestError('merchantAddress missing in URI.');
  }

  const params = new URLSearchParams(queryString);
  const amount = params.get('amount') ?? '';
  const requestId = params.get('requestId') ?? '';

  if (!requestId) {
    throw new InvalidRequestError('requestId missing in URI.');
  }

  const now = Date.now();
  const chain: PaymentChain = scheme === 'solana' ? 'SOL' : 'ETH';

  const parsed: PaymentRequest = {
    requestId,
    merchantAddress,
    chain,
    amount,
    createdAt: now,
    expiresAt: now + REQUEST_TTL_MS,
  };

  assertValidRequest(parsed);
  return parsed;
};

export const createPaymentRequest = (
  merchantAddress: string,
  chain: PaymentRequest['chain'],
  amount: string,
): PaymentRequest => {
  const now = Date.now();

  const request: PaymentRequest = {
    requestId: generateUuidV4(),
    merchantAddress: merchantAddress.trim(),
    chain,
    amount: amount.trim(),
    createdAt: now,
    expiresAt: now + REQUEST_TTL_MS,
  };

  // Payment requests expire to prevent replay attacks.
  assertValidRequest(request);

  return request;
};

export const encodeRequestToQR = (request: PaymentRequest): string => {
  assertValidRequest(request);

  if (request.chain === 'SOL' || request.chain === 'USDC_SOL') {
    return buildUri('solana', request.merchantAddress, request.amount, request.requestId);
  }

  return buildUri('ethereum', request.merchantAddress, request.amount, request.requestId);
};

export const encodeRequestToNFC = (request: PaymentRequest): Buffer => {
  assertValidRequest(request);
  return Buffer.from(JSON.stringify(request), 'utf8');
};

export const isRequestExpired = (request: PaymentRequest): boolean => {
  return request.expiresAt < Date.now();
};

export const decodePaymentRequest = (data: Buffer | string): PaymentRequest => {
  try {
    const raw = typeof data === 'string' ? data.trim() : data.toString('utf8').trim();
    if (!raw) {
      throw new InvalidRequestError('Payment request payload is empty.');
    }

    let parsed: PaymentRequest;

    if (raw.startsWith('{')) {
      const obj = JSON.parse(raw) as PaymentRequest;
      parsed = {
        requestId: obj.requestId,
        merchantAddress: obj.merchantAddress,
        chain: obj.chain,
        amount: obj.amount,
        createdAt: obj.createdAt,
        expiresAt: obj.expiresAt,
      };
    } else {
      parsed = decodeFromUri(raw);
    }

    assertValidRequest(parsed);

    if (isRequestExpired(parsed)) {
      throw new ExpiredRequestError();
    }

    return parsed;
  } catch (error) {
    if (error instanceof ExpiredRequestError || error instanceof InvalidRequestError) {
      throw error;
    }

    throw new InvalidRequestError(error instanceof Error ? error.message : 'Unable to decode payment request.');
  }
};
