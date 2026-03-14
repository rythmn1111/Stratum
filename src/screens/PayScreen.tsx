import React, { useEffect, useMemo, useRef, useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Buffer } from 'buffer';
import { PublicKey } from '@solana/web3.js';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionLabel } from '../components/SectionLabel';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { CONFIG } from '../config';
import { readShareAFromCard } from '../modules/nfc/reader';
import { fetchShareB } from '../modules/api/shareService';
import { reconstructAndDecrypt, wipeKeyMaterial } from '../modules/crypto/reconstruct';
import { sendETH, sendUSDC_ETH } from '../modules/blockchain/ethPayment';
import { sendSOL, sendUSDC_SOL } from '../modules/blockchain/solPayment';
import { ChainAsset } from '../types';

type WizardStep = 'select' | 'tap' | 'password' | 'success' | 'failure';

const ASSETS: ChainAsset[] = ['ETH', 'SOL', 'USDC_ETH', 'USDC_SOL'];

const ASSET_LABEL: Record<ChainAsset, string> = {
  ETH: 'ETH',
  SOL: 'SOL',
  USDC_ETH: 'USDC (ETH)',
  USDC_SOL: 'USDC (SOL)',
};

const getExplorerUrl = (asset: ChainAsset, txHash: string): string => {
  if (asset === 'SOL' || asset === 'USDC_SOL') {
    return `https://solscan.io/tx/${encodeURIComponent(txHash)}?cluster=devnet`;
  }

  return `https://sepolia.etherscan.io/tx/${encodeURIComponent(txHash)}`;
};

export const PayScreen: React.FC = () => {
  const { userId, balances } = useWallet();

  const [step, setStep] = useState<WizardStep>('select');
  const [asset, setAsset] = useState<ChainAsset>('ETH');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [tapCountdown, setTapCountdown] = useState(30);
  const [isTapReading, setIsTapReading] = useState(false);
  const [nfcInlineError, setNfcInlineError] = useState<string | null>(null);

  const [opProgress, setOpProgress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [txHash, setTxHash] = useState('');
  const [failureMessage, setFailureMessage] = useState('');

  const shareARef = useRef<Buffer | null>(null);
  const ringPulse = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const availableBalance = useMemo(() => {
    switch (asset) {
      case 'ETH':
        return balances.eth;
      case 'SOL':
        return balances.sol;
      case 'USDC_ETH':
        return balances.usdcEth;
      case 'USDC_SOL':
        return balances.usdcSol;
      default:
        return '0';
    }
  }, [asset, balances.eth, balances.sol, balances.usdcEth, balances.usdcSol]);

  const clearShareRef = () => {
    if (shareARef.current) {
      shareARef.current.fill(0);
      shareARef.current = null;
    }
  };

  const cleanupCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const validateSelectStep = (): string | null => {
    const trimmedRecipient = recipient.trim();
    const trimmedAmount = amount.trim();

    if (!trimmedRecipient) {
      return 'Recipient is required.';
    }

    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmedAmount) || Number.parseFloat(trimmedAmount) <= 0) {
      return 'Amount must be greater than zero.';
    }

    if (asset === 'ETH' || asset === 'USDC_ETH') {
      const { isAddress } = require('ethers') as typeof import('ethers');
      if (!isAddress(trimmedRecipient)) {
        return 'Invalid Ethereum address for selected asset.';
      }
    } else {
      try {
        void new PublicKey(trimmedRecipient);
      } catch (_error) {
        return 'Invalid Solana address for selected asset.';
      }
    }

    return null;
  };

  const goToTapStep = () => {
    const validationError = validateSelectStep();
    if (validationError) {
      Alert.alert('Validation', validationError);
      return;
    }

    setNfcInlineError(null);
    setTapCountdown(30);
    setStep('tap');
  };

  const runTapRead = async () => {
    setNfcInlineError(null);
    setIsTapReading(true);
    setTapCountdown(30);
    cleanupCountdown();

    countdownIntervalRef.current = setInterval(() => {
      setTapCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    try {
      const shareA = await readShareAFromCard();
      clearShareRef();
      shareARef.current = Buffer.from(shareA);
      setStep('password');
    } catch (error) {
      setNfcInlineError(error instanceof Error ? error.message : 'Failed to read NFC card.');
    } finally {
      cleanupCountdown();
      setIsTapReading(false);
    }
  };

  useEffect(() => {
    if (step !== 'tap') {
      return;
    }

    runTapRead().catch(() => undefined);
  }, [step]);

  useEffect(() => {
    if (step !== 'tap') {
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [ringPulse, step]);

  useEffect(() => {
    if (step !== 'success') {
      return;
    }

    successScale.setValue(0.8);
    Animated.spring(successScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 90,
    }).start();
  }, [step, successScale]);

  useEffect(() => {
    return () => {
      cleanupCountdown();
      clearShareRef();
    };
  }, []);

  const pasteRecipient = async () => {
    const text = await Clipboard.getString();
    if (text) {
      setRecipient(text.trim());
    }
  };

  // SECURITY: privateKey is never assigned to React state.
  // It flows directly: reconstruct -> sign -> wipe
  // wipeKeyMaterial() is called in finally so it runs on both success and failure.
  const confirmPayment = async () => {
    if (!userId) {
      setFailureMessage('Missing user session. Please relogin.');
      setStep('failure');
      return;
    }

    if (!shareARef.current) {
      setFailureMessage('NFC card share is missing. Please tap card again.');
      setStep('failure');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Password required', 'Enter your wallet password.');
      return;
    }

    const validationError = validateSelectStep();
    if (validationError) {
      setFailureMessage(validationError);
      setStep('failure');
      return;
    }

    const recipientValue = recipient.trim();
    const amountValue = amount.trim();

    let shareB = Buffer.alloc(0) as Buffer<ArrayBufferLike>;
    let keys: { mnemonic: string; ethPrivateKey: string; solPrivateKey: Uint8Array } | null = null;

    setSubmitting(true);
    setFailureMessage('');

    try {
      setOpProgress('Fetching secure share...');
      shareB = await fetchShareB(userId);

      setOpProgress('Reconstructing key...');
      keys = await reconstructAndDecrypt(Buffer.from(shareARef.current), shareB, password);

      setOpProgress('Signing...');
      let txResult: { txHash?: string; txSignature?: string };

      if (asset === 'ETH') {
        const sendPromise = sendETH(keys.ethPrivateKey, recipientValue, amountValue, CONFIG.ethRpcUrl);
        setOpProgress('Broadcasting...');
        txResult = await sendPromise;
      } else if (asset === 'USDC_ETH') {
        const sendPromise = sendUSDC_ETH(
          keys.ethPrivateKey,
          recipientValue,
          amountValue,
          CONFIG.usdcEthContract,
          CONFIG.ethRpcUrl,
        );
        setOpProgress('Broadcasting...');
        txResult = await sendPromise;
      } else if (asset === 'SOL') {
        const sendPromise = sendSOL(keys.solPrivateKey, recipientValue, Number.parseFloat(amountValue), CONFIG.solRpcUrl);
        setOpProgress('Broadcasting...');
        txResult = await sendPromise;
      } else {
        const sendPromise = sendUSDC_SOL(
          keys.solPrivateKey,
          recipientValue,
          Number.parseFloat(amountValue),
          CONFIG.usdcSolMint,
          CONFIG.solRpcUrl,
        );
        setOpProgress('Broadcasting...');
        txResult = await sendPromise;
      }

      setTxHash(txResult.txHash ?? txResult.txSignature ?? '');
      setStep('success');
      clearShareRef();
      setPassword('');
    } catch (error) {
      setFailureMessage(error instanceof Error ? error.message : 'Unable to send payment.');
      setStep('failure');
    } finally {
      if (keys) {
        wipeKeyMaterial(keys);
      }
      shareB.fill(0);
      setSubmitting(false);
      setOpProgress('');
    }
  };

  const resetWizard = () => {
    setStep('select');
    setPassword('');
    setTxHash('');
    setFailureMessage('');
    setNfcInlineError(null);
    setTapCountdown(30);
    setSubmitting(false);
    setOpProgress('');
    clearShareRef();
  };

  const shareReceipt = async () => {
    if (!txHash) {
      return;
    }

    const message = `Payment Receipt\nAsset: ${ASSET_LABEL[asset]}\nAmount: ${amount.trim()}\nRecipient: ${recipient.trim()}\nTx: ${txHash}`;
    await Share.share({ message });
  };

  const openExplorer = async () => {
    if (!txHash) {
      return;
    }

    const url = getExplorerUrl(asset, txHash);
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Explorer', 'Unable to open explorer link on this device.');
      return;
    }

    await Linking.openURL(url);
  };

  return (
    <KeyboardAvoidingView style={styles.kbv} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Pay" subtitle="Secure NFC split-key checkout" />

        <GlassCard>
          <Text style={styles.stepText}>Step {step === 'select' ? '1/5' : step === 'tap' ? '2/5' : step === 'password' ? '3/5' : step === 'success' ? '4/5' : '5/5'}</Text>
          <Text style={styles.stepTitle}>
            {step === 'select' && 'Select Payment Details'}
            {step === 'tap' && 'Tap Card'}
            {step === 'password' && 'Password & Sign'}
            {step === 'success' && 'Payment Success'}
            {step === 'failure' && 'Payment Failed'}
          </Text>
        </GlassCard>

        {step === 'select' && (
          <>
            <SectionLabel label="Chain" />
            <View style={styles.assetRow}>
              {ASSETS.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.assetChip, asset === item && styles.assetChipActive]}
                  onPress={() => setAsset(item)}
                >
                  <Text style={[styles.assetChipText, asset === item && styles.assetChipTextActive]}>{ASSET_LABEL[item]}</Text>
                </Pressable>
              ))}
            </View>

            <SectionLabel label="Recipient" />
            <View style={styles.recipientRow}>
              <TextInput
                style={[styles.input, styles.recipientInput]}
                value={recipient}
                onChangeText={setRecipient}
                placeholder="Wallet address"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable onPress={pasteRecipient} style={styles.pasteButton}>
                <Text style={styles.pasteButtonText}>Paste</Text>
              </Pressable>
            </View>

            <SectionLabel label="Amount" />
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="decimal-pad"
            />

            <Text style={styles.balanceText}>Available: {availableBalance} {ASSET_LABEL[asset]}</Text>

            <PrimaryButton title="Next" onPress={goToTapStep} />
          </>
        )}

        {step === 'tap' && (
          <GlassCard>
            <Animated.View style={[styles.nfcRingOuter, { transform: [{ scale: ringPulse }] }]}>
              <View style={styles.nfcRingInner}>
                {isTapReading ? <ActivityIndicator color={theme.colors.accent} size="large" /> : <Text style={styles.nfcIcon}>📳</Text>}
              </View>
            </Animated.View>

            <Text style={styles.tapTitle}>Tap your NFC card to your phone</Text>
            <Text style={styles.tapSubtitle}>Timeout in {tapCountdown}s</Text>

            {nfcInlineError ? <Text style={styles.errorInline}>{nfcInlineError}</Text> : null}

            <View style={styles.rowActions}>
              <PrimaryButton title="Retry" onPress={runTapRead} loading={isTapReading} />
              <PrimaryButton title="Back" onPress={() => setStep('select')} />
            </View>
          </GlassCard>
        )}

        {step === 'password' && (
          <GlassCard>
            <Text style={styles.summaryLine}>Asset: {ASSET_LABEL[asset]}</Text>
            <Text style={styles.summaryLine}>Amount: {amount.trim()}</Text>
            <Text style={styles.summaryLine} numberOfLines={1}>Recipient: {recipient.trim()}</Text>

            <SectionLabel label="Enter your wallet password" />
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable style={styles.showHideBtn} onPress={() => setShowPassword((prev) => !prev)}>
                <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            {opProgress ? <Text style={styles.progressText}>{opProgress}</Text> : null}

            <View style={styles.rowActions}>
              <PrimaryButton title="Confirm Payment" onPress={confirmPayment} loading={submitting} />
              <PrimaryButton title="Retap Card" onPress={() => setStep('tap')} />
            </View>
          </GlassCard>
        )}

        {step === 'success' && (
          <GlassCard>
            <Animated.View style={[styles.successBadge, { transform: [{ scale: successScale }] }]}>
              <Text style={styles.successIcon}>✓</Text>
            </Animated.View>
            <Text style={styles.successTitle}>Payment Sent</Text>
            <Text style={styles.summaryLine}>Amount: {amount.trim()} {ASSET_LABEL[asset]}</Text>
            <Text style={styles.summaryLine}>Recipient: {recipient.trim().slice(0, 8)}...{recipient.trim().slice(-6)}</Text>
            <Pressable onPress={openExplorer}>
              <Text style={styles.txHashLink}>Tx: {txHash}</Text>
            </Pressable>
            <View style={styles.rowActions}>
              <PrimaryButton title="Done" onPress={resetWizard} />
              <PrimaryButton title="Share Receipt" onPress={shareReceipt} />
            </View>
          </GlassCard>
        )}

        {step === 'failure' && (
          <GlassCard>
            <View style={styles.failureBadge}>
              <Text style={styles.failureIcon}>✕</Text>
            </View>
            <Text style={styles.failureTitle}>Payment Failed</Text>
            <Text style={styles.errorInline}>{failureMessage || 'Unknown error occurred.'}</Text>
            <View style={styles.rowActions}>
              <PrimaryButton title="Try Again" onPress={() => setStep(shareARef.current ? 'password' : 'tap')} />
              <PrimaryButton title="Edit Details" onPress={() => setStep('select')} />
            </View>
          </GlassCard>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  kbv: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, paddingBottom: 40 },
  stepText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  stepTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  assetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  assetChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  assetChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(42,230,215,0.1)',
  },
  assetChipText: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  assetChipTextActive: {
    color: theme.colors.accent,
  },
  recipientRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  recipientInput: {
    flex: 1,
    marginBottom: 0,
  },
  pasteButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.colors.surfaceAlt,
  },
  pasteButtonText: {
    color: theme.colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.textPrimary,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    fontSize: 15,
  },
  balanceText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginBottom: theme.spacing.md,
  },
  nfcRingOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: theme.colors.accent,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  nfcRingInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcIcon: {
    fontSize: 34,
  },
  tapTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  tapSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  errorInline: {
    color: theme.colors.danger,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  summaryLine: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    marginBottom: 6,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
  },
  showHideBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.colors.surfaceAlt,
  },
  showHideText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  progressText: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '600',
    marginVertical: theme.spacing.sm,
  },
  rowActions: {
    gap: 10,
  },
  successBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(55,214,122,0.16)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  successIcon: {
    color: theme.colors.success,
    fontSize: 44,
    fontWeight: '700',
  },
  successTitle: {
    color: theme.colors.success,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  txHashLink: {
    color: theme.colors.accent,
    fontSize: 12,
    marginBottom: theme.spacing.md,
    textDecorationLine: 'underline',
  },
  failureBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(244,91,105,0.15)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  failureIcon: {
    color: theme.colors.danger,
    fontSize: 40,
    fontWeight: '700',
  },
  failureTitle: {
    color: theme.colors.danger,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
});
