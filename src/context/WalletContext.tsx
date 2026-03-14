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
import { validatePaymentRequest } from '../utils/validation';
import { wipeString, wipeUint8 } from '../utils/memory';

interface WalletContextValue extends WalletContextState {
  initializeNfc: () => Promise<void>;
  hydrateWallet: () => Promise<void>;
  setupWallet: (password: string, existingMnemonic?: string) => Promise<void>;
  sendPaymentFromOwnDevice: (
    password: string,
    request: PaymentRequest,
    preloadedShareA?: Uint8Array,
  ) => Promise<TransactionPreview>;
  sendPaymentInPosMode: (
    password: string,
    payerUserId: string,
    request: PaymentRequest,
    preloadedShareA: Uint8Array,
    posToken: string,
  ) => Promise<TransactionPreview>;
  setReceiveAmount: (value: string) => void;
  receiveAmount: string;
  refreshBalances: () => Promise<void>;
  logout: () => Promise<void>;
  isNfcScanning: boolean;
}

const initialState: WalletContextState = {
  isSetupComplete: false,
  userId: null,
  posToken: null,
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

export const WalletProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<WalletContextState>(initialState);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [isNfcScanning, setIsNfcScanning] = useState(false);

  const initializeNfc = useCallback(async () => {
    await nfcService.initialize();
  }, []);

  const hydrateWallet = useCallback(async () => {
    const profile = await secureStorage.getWalletProfile();

    if (!profile) {
      return;
    }

    const posToken = await secureStorage.getPosToken();

    setState((prev) => ({
      ...prev,
      isSetupComplete: true,
      userId: profile.userId,
      posToken,
      addresses: profile.addresses,
    }));
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

      // Register with the backend first so we get a userId + posToken to embed in the NFC card metadata.
      // posToken enables POS-mode share fetches without device credentials.
      const deviceFingerprint = await createDeviceFingerprint();
      const register = await backendApi.registerUser({
        deviceFingerprint,
        shareB: Buffer.from(shareB).toString('base64'),
      });

      await nfcService.writeShareToCard(shareA, {
        metadata: { userId: register.userId, posToken: register.posToken },
      });

      await secureStorage.saveSessionToken(register.sessionToken);
      await secureStorage.saveDeviceFingerprint(deviceFingerprint);
      await secureStorage.savePosToken(register.posToken);
      await secureStorage.saveLocalShareA(Buffer.from(shareA).toString('base64'));
      await secureStorage.saveWalletProfile({
        userId: register.userId,
        addresses: {
          eth: derived.ethAddress,
          sol: derived.solAddress,
        },
      });

      setState((prev) => ({
        ...prev,
        isSetupComplete: true,
        userId: register.userId,
        posToken: register.posToken,
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

  // Own-device reconstruction: uses device fingerprint + session token → safe for single-user payment.
  const reconstructSecrets = useCallback(
    async (password: string, userId: string, preloadedShareA?: Uint8Array) => {
      let shareA: Uint8Array | null = null;
      let shareB: Uint8Array | null = null;
      let encryptedBlob: Uint8Array | null = null;

      try {
        if (preloadedShareA) {
          shareA = Uint8Array.from(preloadedShareA);
        } else {
          const localShareABase64 = await secureStorage.getLocalShareA();
          if (localShareABase64) {
            shareA = Uint8Array.from(Buffer.from(localShareABase64, 'base64'));
          } else {
            setIsNfcScanning(true);
            // Fallback for legacy wallets that do not have local Share A persisted yet.
            shareA = await nfcService.readShareFromCard();
          }
        }

        const deviceFingerprint = await secureStorage.getDeviceFingerprint();
        const sessionToken = await secureStorage.getSessionToken();

        if (!deviceFingerprint || !sessionToken) {
          throw new Error('Device session missing. Please logout and login again.');
        }

        // Network errors are operational — re-throw directly.
        const serverShare = await backendApi.fetchShareB({ userId, deviceFingerprint, sessionToken });
        shareB = Uint8Array.from(Buffer.from(serverShare.shareB, 'base64'));
        encryptedBlob = combineShares(shareA, shareB);

        // Decrypt errors use a generic message to prevent share oracle leaks.
        try {
          return decryptSeedBlob(encryptedBlob, password);
        } catch (_decryptError) {
          throw new Error('Authentication failed. Check your password and try again.');
        }
      } finally {
        setIsNfcScanning(false);
        wipeUint8(encryptedBlob);
        wipeUint8(shareA);
        wipeUint8(shareB);
      }
    },
    [],
  );

  // POS reconstruction: merchant already holds payer's shareA from the NFC card.
  // Uses posToken (from card metadata or payer's Wallet screen) — no merchant device credentials.
  const reconstructSecretsForPOS = useCallback(
    async (password: string, payerUserId: string, shareA: Uint8Array, posToken: string) => {
      let shareACopy: Uint8Array | null = null;
      let shareB: Uint8Array | null = null;
      let encryptedBlob: Uint8Array | null = null;

      try {
        shareACopy = Uint8Array.from(shareA);

        // Network errors re-throw directly.
        const serverShare = await backendApi.fetchShareBForPOS({ userId: payerUserId, posToken });
        shareB = Uint8Array.from(Buffer.from(serverShare.shareB, 'base64'));
        encryptedBlob = combineShares(shareACopy, shareB);

        // Decrypt errors use a generic message to prevent share oracle leaks.
        try {
          return decryptSeedBlob(encryptedBlob, password);
        } catch (_decryptError) {
          throw new Error('Authentication failed. Check the payer password and try again.');
        }
      } finally {
        wipeUint8(encryptedBlob);
        wipeUint8(shareACopy);
        wipeUint8(shareB);
      }
    },
    [],
  );

  const signAndBroadcast = useCallback(async (
    request: PaymentRequest,
    password: string,
    userId: string,
    preloadedShareA?: Uint8Array,
  ) => {
    validatePaymentRequest(request);
    const secrets = await reconstructSecrets(password, userId, preloadedShareA);

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
    async (password: string, request: PaymentRequest, preloadedShareA?: Uint8Array): Promise<TransactionPreview> => {
      if (!state.userId) {
        throw new Error('Wallet is not setup yet.');
      }

      const txHash = await signAndBroadcast(request, password, state.userId, preloadedShareA);
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
      preloadedShareA: Uint8Array,
      posToken: string,
    ): Promise<TransactionPreview> => {
      validatePaymentRequest(request);
      const secrets = await reconstructSecretsForPOS(password, payerUserId, preloadedShareA, posToken);
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
    [addRecent, reconstructSecretsForPOS],
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
      hydrateWallet,
      setupWallet,
      sendPaymentFromOwnDevice,
      sendPaymentInPosMode,
      setReceiveAmount,
      receiveAmount,
      refreshBalances,
      logout,
      isNfcScanning,
    }),
    [
      initializeNfc,
      hydrateWallet,
      isNfcScanning,
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
