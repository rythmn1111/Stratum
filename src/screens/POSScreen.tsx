import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Buffer } from 'buffer';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionLabel } from '../components/SectionLabel';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import {
  createPaymentRequest,
  encodeRequestToNFC,
  encodeRequestToQR,
  PaymentChain,
} from '../modules/pos/paymentRequest';
import { nfcService } from '../services/nfcService';
import { ChainAsset } from '../types';
import { wipeUint8 } from '../utils/memory';

type PosTab = 'qr' | 'nfc';

const ASSETS: ChainAsset[] = ['ETH', 'SOL', 'USDC_ETH', 'USDC_SOL'];

const ASSET_TO_PAYMENT_CHAIN: Record<ChainAsset, PaymentChain> = {
  ETH: 'ETH',
  SOL: 'SOL',
  USDC_ETH: 'USDC_ETH',
  USDC_SOL: 'USDC_SOL',
};

const ASSET_LABEL: Record<ChainAsset, string> = {
  ETH: 'ETH',
  SOL: 'SOL',
  USDC_ETH: 'USDC (ETH)',
  USDC_SOL: 'USDC (SOL)',
};

const KEYS: ReadonlyArray<string> = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'DEL'];

const normalizeAmount = (raw: string): string => {
  if (!raw) {
    return '';
  }

  if (raw.startsWith('.')) {
    return `0${raw}`;
  }

  return raw;
};

const amountFromKeypad = (current: string, key: string): string => {
  if (key === 'DEL') {
    return current.slice(0, -1);
  }

  if (key === '.') {
    if (!current) {
      return '0.';
    }
    if (current.includes('.')) {
      return current;
    }
    return `${current}.`;
  }

  if (current === '0' && key === '0') {
    return current;
  }

  const next = `${current}${key}`;

  const [whole = '', decimals = ''] = next.split('.');
  if (decimals.length > 6) {
    return current;
  }

  if (whole.length > 1 && whole.startsWith('0') && !next.includes('.')) {
    return String(Number.parseInt(whole, 10));
  }

  return next;
};

export const POSScreen: React.FC = () => {
  const { addresses, sendPaymentInPosMode } = useWallet();

  const [tab, setTab] = useState<PosTab>('qr');
  const [asset, setAsset] = useState<ChainAsset>('ETH');
  const [amount, setAmount] = useState('');

  const [isListening, setIsListening] = useState(false);
  const [scanStatus, setScanStatus] = useState('Waiting for card tap');

  const [shareA, setShareA] = useState<Uint8Array | null>(null);
  const [payerUserId, setPayerUserId] = useState('');
  const [posToken, setPosToken] = useState('');

  const [customerPassword, setCustomerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const nfcShareBufferRef = useRef<Buffer | null>(null);

  const merchantAddress = useMemo(() => {
    if (!addresses) {
      return '';
    }

    return asset === 'SOL' || asset === 'USDC_SOL' ? addresses.sol : addresses.eth;
  }, [addresses, asset]);

  const amountDisplay = useMemo(() => {
    const normalized = normalizeAmount(amount);
    return normalized || '0';
  }, [amount]);

  const qrPayload = useMemo(() => {
    if (!merchantAddress || !amount) {
      return '';
    }

    try {
      const req = createPaymentRequest(
        merchantAddress,
        ASSET_TO_PAYMENT_CHAIN[asset],
        normalizeAmount(amount),
      );
      return encodeRequestToQR(req);
    } catch (_error) {
      return '';
    }
  }, [amount, asset, merchantAddress]);

  const nfcPayloadPreview = useMemo(() => {
    if (!merchantAddress || !amount) {
      return '';
    }

    try {
      const req = createPaymentRequest(
        merchantAddress,
        ASSET_TO_PAYMENT_CHAIN[asset],
        normalizeAmount(amount),
      );
      return encodeRequestToNFC(req).toString('utf8');
    } catch (_error) {
      return '';
    }
  }, [amount, asset, merchantAddress]);

  const cleanupShare = useCallback(() => {
    if (nfcShareBufferRef.current) {
      nfcShareBufferRef.current.fill(0);
      nfcShareBufferRef.current = null;
    }

    if (shareA) {
      wipeUint8(shareA);
      setShareA(null);
    }
  }, [shareA]);

  const stopNfcListener = useCallback(async () => {
    await nfcService.stopReaderMode().catch(() => undefined);
    setIsListening(false);
  }, []);

  const startNfcListener = useCallback(async () => {
    if (tab !== 'nfc') {
      return;
    }

    setScanStatus('Waiting for card tap');
    setIsListening(true);

    await nfcService.startReaderMode(async (tag) => {
      try {
        const card = await nfcService.readCardDataFromTag(tag);

        cleanupShare();

        const local = Buffer.from(card.shareA);
        nfcShareBufferRef.current = local;
        setShareA(Uint8Array.from(local));

        setPayerUserId(card.userId ?? '');
        setPosToken(card.posToken ?? '');
        setScanStatus(card.userId && card.posToken ? 'Card loaded' : 'Card loaded. Enter missing fields manually.');
      } catch (error) {
        setScanStatus(error instanceof Error ? error.message : 'Card parse failed');
      }
    });
  }, [cleanupShare, tab]);

  useEffect(() => {
    if (tab !== 'nfc') {
      stopNfcListener().catch(() => undefined);
      return;
    }

    startNfcListener().catch((error) => {
      setIsListening(false);
      setScanStatus(error instanceof Error ? error.message : 'Failed to start NFC listener');
    });

    return () => {
      stopNfcListener().catch(() => undefined);
    };
  }, [startNfcListener, stopNfcListener, tab]);

  useEffect(() => {
    return () => {
      stopNfcListener().catch(() => undefined);
      cleanupShare();
    };
  }, [cleanupShare, stopNfcListener]);

  const onKeypadPress = (key: string) => {
    setAmount((prev) => amountFromKeypad(prev, key));
  };

  const clearTransactionState = useCallback(() => {
    setCustomerPassword('');
    setShowPassword(false);
    setShowConfirm(false);
    setPayerUserId('');
    setPosToken('');
    cleanupShare();
  }, [cleanupShare]);

  const canOpenConfirm = useMemo(() => {
    const normalizedAmount = normalizeAmount(amount);
    return (
      tab === 'nfc'
      && !!merchantAddress
      && !!shareA
      && !!payerUserId.trim()
      && !!posToken.trim()
      && !!normalizedAmount
      && Number.parseFloat(normalizedAmount) > 0
    );
  }, [amount, merchantAddress, payerUserId, posToken, shareA, tab]);

  const restartAfterAttempt = useCallback(async () => {
    clearTransactionState();
    if (tab === 'nfc') {
      await stopNfcListener();
      await startNfcListener().catch((error) => {
        setScanStatus(error instanceof Error ? error.message : 'Unable to restart NFC listener');
      });
    }
  }, [clearTransactionState, startNfcListener, stopNfcListener, tab]);

  const onConfirmPayment = async () => {
    if (!shareA || !merchantAddress) {
      Alert.alert('Missing card', 'Tap customer card first.');
      return;
    }

    if (!customerPassword.trim()) {
      Alert.alert('Password required', 'Enter customer wallet password.');
      return;
    }

    const normalizedAmount = normalizeAmount(amount);
    if (!normalizedAmount || Number.parseFloat(normalizedAmount) <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const tx = await sendPaymentInPosMode(
        customerPassword,
        payerUserId.trim(),
        {
          recipient: merchantAddress,
          amount: normalizedAmount,
          asset,
        },
        shareA,
        posToken.trim(),
      );

      Alert.alert('Payment complete', `Tx hash: ${tx.txHash ?? 'submitted'}`);
      await restartAfterAttempt();
    } catch (error) {
      Alert.alert('Payment failed', error instanceof Error ? error.message : 'Unable to complete payment.');
      await restartAfterAttempt();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="POS" subtitle="Merchant collection flow" />

      <GlassCard>
        <View style={styles.tabRow}>
          <Pressable style={[styles.tabButton, tab === 'qr' && styles.tabButtonActive]} onPress={() => setTab('qr')}>
            <Text style={[styles.tabText, tab === 'qr' && styles.tabTextActive]}>QR</Text>
          </Pressable>
          <Pressable style={[styles.tabButton, tab === 'nfc' && styles.tabButtonActive]} onPress={() => setTab('nfc')}>
            <Text style={[styles.tabText, tab === 'nfc' && styles.tabTextActive]}>NFC</Text>
          </Pressable>
        </View>
      </GlassCard>

      <SectionLabel label="Asset" />
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

      <SectionLabel label="Amount" />
      <GlassCard>
        <Text style={styles.amountDisplay}>{amountDisplay}</Text>
        <View style={styles.keypadGrid}>
          {KEYS.map((key) => (
            <Pressable key={key} style={styles.key} onPress={() => onKeypadPress(key)}>
              <Text style={styles.keyText}>{key}</Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>

      {tab === 'qr' && (
        <GlassCard>
          <Text style={styles.infoTitle}>Customer Scan</Text>
          {qrPayload ? (
            <View style={styles.qrWrap}>
              <QRCode value={qrPayload} size={180} />
            </View>
          ) : (
            <Text style={styles.infoBody}>Enter an amount and keep wallet connected to generate QR request.</Text>
          )}
          {!!nfcPayloadPreview && (
            <Text style={styles.previewText} numberOfLines={4}>
              NFC payload preview: {nfcPayloadPreview}
            </Text>
          )}
        </GlassCard>
      )}

      {tab === 'nfc' && (
        <>
          <GlassCard>
            <Text style={styles.infoTitle}>Tap Customer Card</Text>
            <Text style={styles.infoBody}>{scanStatus}</Text>
            <Text style={styles.statusChip}>{isListening ? 'Listener active' : 'Listener stopped'}</Text>
          </GlassCard>

          <GlassCard>
            <Text style={styles.infoTitle}>Customer Identity</Text>
            <TextInput
              style={styles.input}
              value={payerUserId}
              onChangeText={setPayerUserId}
              placeholder="Customer user ID"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              value={posToken}
              onChangeText={setPosToken}
              placeholder="POS token"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <PrimaryButton
              title="Continue"
              onPress={() => setShowConfirm(true)}
              disabled={!canOpenConfirm}
            />
          </GlassCard>
        </>
      )}

      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.modalBackdrop}>
          <GlassCard>
            <Text style={styles.modalTitle}>Confirm POS Payment</Text>
            <Text style={styles.modalLine}>Asset: {ASSET_LABEL[asset]}</Text>
            <Text style={styles.modalLine}>Amount: {normalizeAmount(amount)}</Text>
            <Text style={styles.modalLine} numberOfLines={1}>
              Merchant: {merchantAddress || 'Unavailable'}
            </Text>

            <SectionLabel label="Customer Password" />
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={customerPassword}
                onChangeText={setCustomerPassword}
                placeholder="Enter customer password"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable style={styles.showHideBtn} onPress={() => setShowPassword((prev) => !prev)}>
                <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <PrimaryButton title="Cancel" onPress={() => setShowConfirm(false)} />
              <PrimaryButton title="Charge Customer" onPress={onConfirmPayment} loading={submitting} />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    paddingBottom: 44,
    backgroundColor: theme.colors.background,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  tabButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(42,230,215,0.1)',
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  tabTextActive: {
    color: theme.colors.accent,
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
    fontSize: 12,
    fontWeight: '700',
  },
  assetChipTextActive: {
    color: theme.colors.accent,
  },
  amountDisplay: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: theme.spacing.md,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  key: {
    width: '31%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  keyText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  infoTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  infoBody: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.md,
  },
  previewText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: theme.spacing.sm,
  },
  statusChip: {
    marginTop: theme.spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.textSecondary,
    fontSize: 12,
    backgroundColor: theme.colors.surfaceAlt,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: theme.spacing.sm,
  },
  modalLine: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginBottom: 4,
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
  modalActions: {
    marginTop: theme.spacing.sm,
    gap: 8,
  },
});
