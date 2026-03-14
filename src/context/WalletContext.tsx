import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from 'buffer';
import { backendApi } from '../services/backendApi';
import { fetchBalances, sendEth, sendSol, sendUsdcOnEthereum, sendUsdcOnSolana } from '../services/blockchainService';
import {
  combineShares,
  createDeviceFingerprint,
  decryptSeedBlob,
  deriveKeysFromMnemonic,
  encryptSeedBlob,
  generateMnemonic,
  splitEncryptedBlob,
  wipeWalletSecrets,
} from '../services/cryptoService';
import { nfcService } from '../services/nfcService';
import { secureStorage } from '../services/secureStorage';
import { PaymentRequest, TransactionPreview, WalletContextState } from '../types';
import { wipeString, wipeUint8 } from '../utils/memory';

interface WalletContextValue extends WalletContextState {
  initializeNfc: () => Promise<void>;
  setupWallet: (password: string, existingMnemonic?: string) => Promise<void>;
  sendPaymentFromOwnDevice: (password: string, request: PaymentRequest) => Promise<TransactionPreview>;
  sendPaymentInPosMode: (
    password: string,
    payerUserId: string,
    request: PaymentRequest,
    preloadedShareA?: Uint8Array,
  ) => Promise<TransactionPreview>;
  setReceiveAmount: (value: string) => void;
  receiveAmount: string;
  refreshBalances: () => Promise<void>;
  logout: () => Promise<void>;
}

const initialState: WalletContextState = {
  isSetupComplete: false,
  userId: null,
  addresses: null,
  balances: {
    eth: '0.0000',
    sol: '0.0000',
    usdcEth: '0.00',
    usdcSol: '0.00',
  },
  recentTransactions: [],
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

const mapError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  return new Error('Unexpected failure. Please retry.');
};

export const WalletProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<WalletContextState>(initialState);
  const [receiveAmount, setReceiveAmount] = useState('');

  const initializeNfc = useCallback(async () => {
    await nfcService.initialize();
  }, []);

  const addRecent = useCallback((tx: TransactionPreview) => {
    setState((prev) => ({
      ...prev,
      recentTransactions: [tx, ...prev.recentTransactions].slice(0, 10),
    }));
  }, []);

  const setupWallet = useCallback(async (password: string, existingMnemonic?: string) => {
    let shareA: Uint8Array | null = null;
    let shareB: Uint8Array | null = null;
    let encryptedBlob: Uint8Array | null = null;

    try {
      const mnemonic = existingMnemonic?.trim() || generateMnemonic();
      const derived = deriveKeysFromMnemonic(mnemonic);
      encryptedBlob = encryptSeedBlob(derived.mnemonic, password);

      const split = splitEncryptedBlob(encryptedBlob);
      shareA = split.shareA;
      shareB = split.shareB;

      await nfcService.writeShareToCard(shareA);

      const deviceFingerprint = await createDeviceFingerprint();
      const register = await backendApi.registerUser({
        deviceFingerprint,
        shareB: Buffer.from(shareB).toString('base64'),
      });

      await secureStorage.saveSessionToken(register.sessionToken);
      await secureStorage.saveDeviceFingerprint(deviceFingerprint);

      setState((prev) => ({
        ...prev,
        isSetupComplete: true,
        userId: register.userId,
        addresses: {
          eth: derived.ethAddress,
          sol: derived.solAddress,
        },
      }));

      wipeWalletSecrets(derived);
      wipeString(mnemonic);
    } finally {
      wipeUint8(encryptedBlob);
      wipeUint8(shareA);
      wipeUint8(shareB);
    }
  }, []);

  const reconstructSecrets = useCallback(
    async (password: string, userId: string, preloadedShareA?: Uint8Array) => {
      let shareA: Uint8Array | null = null;
      let shareB: Uint8Array | null = null;
      let encryptedBlob: Uint8Array | null = null;

      try {
        shareA = preloadedShareA ? Uint8Array.from(preloadedShareA) : await nfcService.readShareFromCard();

        const deviceFingerprint = await secureStorage.getDeviceFingerprint();
        const sessionToken = await secureStorage.getSessionToken();

        if (!deviceFingerprint || !sessionToken) {
          throw new Error('Device session missing. Please login again.');
        }

        const serverShare = await backendApi.fetchShareB({
          userId,
          deviceFingerprint,
          sessionToken,
        });

        shareB = Uint8Array.from(Buffer.from(serverShare.shareB, 'base64'));
        encryptedBlob = combineShares(shareA, shareB);

        // We intentionally return one generic error on password/decryption failure to avoid share oracle leaks.
        return decryptSeedBlob(encryptedBlob, password);
      } catch (_error) {
        throw new Error('Authentication failed. Please verify card and password and try again.');
      } finally {
        wipeUint8(encryptedBlob);
        wipeUint8(shareA);
        wipeUint8(shareB);
      }
    },
    [],
  );

  const signAndBroadcast = useCallback(async (request: PaymentRequest, password: string, userId: string) => {
    const secrets = await reconstructSecrets(password, userId);

    try {
      // Key material exists only within this isolated async function scope and is wiped immediately after signing.
      if (request.asset === 'ETH') {
        const result = await sendEth(secrets.ethPrivateKey, request.recipient, request.amount);
        return result.txHash;
      }

      if (request.asset === 'USDC_ETH') {
        const result = await sendUsdcOnEthereum(secrets.ethPrivateKey, request.recipient, request.amount);
        return result.txHash;
      }

      if (request.asset === 'SOL') {
        const result = await sendSol(secrets.solPrivateKeyBase58, request.recipient, request.amount);
        return result.txHash;
      }

      const result = await sendUsdcOnSolana(secrets.solPrivateKeyBase58, request.recipient, request.amount);
      return result.txHash;
    } finally {
      wipeWalletSecrets(secrets);
    }
  }, [reconstructSecrets]);

  const sendPaymentFromOwnDevice = useCallback(
    async (password: string, request: PaymentRequest): Promise<TransactionPreview> => {
      if (!state.userId) {
        throw new Error('Wallet is not setup yet.');
      }

      const txHash = await signAndBroadcast(request, password, state.userId);
      const tx: TransactionPreview = {
        id: (QuickCrypto as any).randomBytes(8).toString('hex'),
        chain: request.asset.includes('SOL') || request.asset === 'SOL' ? 'solana' : 'ethereum',
        asset: request.asset,
        amount: request.amount,
        to: request.recipient,
        status: 'confirmed',
        timestamp: Date.now(),
        txHash,
      };

      addRecent(tx);
      return tx;
    },
    [addRecent, signAndBroadcast, state.userId],
  );

  const sendPaymentInPosMode = useCallback(
    async (
      password: string,
      payerUserId: string,
      request: PaymentRequest,
      preloadedShareA?: Uint8Array,
    ): Promise<TransactionPreview> => {
      const secrets = await reconstructSecrets(password, payerUserId, preloadedShareA);
      let txHash = '';

      try {
        if (request.asset === 'ETH') {
          txHash = (await sendEth(secrets.ethPrivateKey, request.recipient, request.amount)).txHash;
        } else if (request.asset === 'USDC_ETH') {
          txHash = (await sendUsdcOnEthereum(secrets.ethPrivateKey, request.recipient, request.amount)).txHash;
        } else if (request.asset === 'SOL') {
          txHash = (await sendSol(secrets.solPrivateKeyBase58, request.recipient, request.amount)).txHash;
        } else {
          txHash = (await sendUsdcOnSolana(secrets.solPrivateKeyBase58, request.recipient, request.amount)).txHash;
        }
      } finally {
        wipeWalletSecrets(secrets);
      }

      const tx: TransactionPreview = {
        id: (QuickCrypto as any).randomBytes(8).toString('hex'),
        chain: request.asset.includes('SOL') || request.asset === 'SOL' ? 'solana' : 'ethereum',
        asset: request.asset,
        amount: request.amount,
        to: request.recipient,
        status: 'confirmed',
        timestamp: Date.now(),
        txHash,
      };

      addRecent(tx);
      return tx;
    },
    [addRecent, reconstructSecrets],
  );

  const refreshBalances = useCallback(async () => {
    if (!state.addresses) {
      return;
    }

    const live = await fetchBalances(state.addresses);

    setState((prev) => ({
      ...prev,
      balances: live,
    }));
  }, [state.addresses]);

  const logout = useCallback(async () => {
    await secureStorage.clearAuth();
    setState(initialState);
    setReceiveAmount('');
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      ...state,
      initializeNfc,
      setupWallet,
      sendPaymentFromOwnDevice,
      sendPaymentInPosMode,
      setReceiveAmount,
      receiveAmount,
      refreshBalances,
      logout,
    }),
    [
      initializeNfc,
      receiveAmount,
      refreshBalances,
      sendPaymentFromOwnDevice,
      sendPaymentInPosMode,
      setupWallet,
      state,
      logout,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = (): WalletContextValue => {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('Wallet context must be used inside WalletProvider');
  }
  return ctx;
};
