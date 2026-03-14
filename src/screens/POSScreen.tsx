import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle, Path } from 'react-native-svg';
import { AddressChip } from '../components/ui/AddressChip';
import { GradientCard } from '../components/ui/GradientCard';
import { NFCRingAnimation } from '../components/ui/NFCRingAnimation';
import { OrangeButton } from '../components/ui/OrangeButton';
import { PinDot } from '../components/ui/PinDot';
import { TransactionRow } from '../components/ui/TransactionRow';
import { useWallet } from '../context/WalletContext';
import { nfcService } from '../services/nfcService';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Typography } from '../theme/typography';
import { ChainAsset, TransactionPreview } from '../types';
import { isPositiveAmount } from '../utils/validation';

type PosTab = 'qr' | 'nfc';

const ASSETS: ChainAsset[] = ['ETH', 'SOL', 'USDC_ETH', 'USDC_SOL'];
const LABELS: Record<ChainAsset, string> = {
  ETH: 'ETH',
  SOL: 'SOL',
  USDC_ETH: 'USDC (ETH)',
  USDC_SOL: 'USDC (SOL)',
};
const PRICES: Record<ChainAsset, number> = {
  ETH: 2501.61,
  SOL: 52,
  USDC_ETH: 1,
  USDC_SOL: 1,
};
const PROGRESS_STEPS = ['Fetching secure share', 'Reconstructing key', 'Signing transaction', 'Broadcasting'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'DEL'] as const;

const normalizeAmount = (value: string) => {
  if (!value) {
    return '';
  }

  if (value.startsWith('.')) {
    return `0${value}`;
  }

  return value;
};

const nextAmount = (current: string, key: string) => {
  if (key === 'DEL') {
    return current.slice(0, -1);
  }

  if (key === '.') {
    if (current.includes('.')) {
      return current;
    }
    return current ? `${current}.` : '0.';
  }

  const next = `${current}${key}`;
  const [, decimals = ''] = next.split('.');

  if (decimals.length > 6) {
    return current;
  }

  if (next.length > 1 && next.startsWith('0') && !next.includes('.')) {
    return String(Number(next));
  }

  return next;
};

export const POSScreen: React.FC = () => {
  const { addresses, recentTransactions, sendPaymentInPosMode } = useWallet();
  const [tab, setTab] = useState<PosTab>('qr');
  const [asset, setAsset] = useState<ChainAsset>('ETH');
  const [amount, setAmount] = useState('');
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [scanStatus, setScanStatus] = useState('NFC Inactive');
  const [shareA, setShareA] = useState<Uint8Array | null>(null);
  const [payerUserId, setPayerUserId] = useState('');
  const [posToken, setPosToken] = useState('');
  const [customerPassword, setCustomerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progressIndex, setProgressIndex] = useState(-1);
  const [receivedTx, setReceivedTx] = useState<TransactionPreview | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  const merchantAddress = useMemo(() => {
    if (!addresses) {
      return '';
    }

    return asset === 'SOL' || asset === 'USDC_SOL' ? addresses.sol : addresses.eth;
  }, [addresses, asset]);

  const amountValue = useMemo(() => normalizeAmount(amount) || '0.00', [amount]);
  const usdValue = useMemo(
    () => (isPositiveAmount(amountValue) ? parseFloat(amountValue) * PRICES[asset] : 0),
    [amountValue, asset],
  );
  const recentPayments = useMemo(
    () => recentTransactions.filter((tx) => tx.to === merchantAddress).slice(0, 3),
    [merchantAddress, recentTransactions],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { duration: 300, toValue: 1, useNativeDriver: true }),
      Animated.timing(translateY, { duration: 300, toValue: 0, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const stopReader = useCallback(async () => {
    await nfcService.stopReaderMode().catch(() => undefined);
    setScanState('idle');
    setScanStatus('NFC Inactive');
  }, []);

  const startReader = useCallback(async () => {
    setScanState('scanning');
    setScanStatus('NFC Active');

    await nfcService.startReaderMode(async (tag) => {
      try {
        const card = await nfcService.readCardDataFromTag(tag);
        setShareA(card.shareA);
        setPayerUserId(card.userId ?? '');
        setPosToken(card.posToken ?? '');
        setScanState('success');
        setScanStatus('Card detected');
        setShowSheet(true);
        setTimeout(() => setScanState('idle'), 800);
      } catch (error) {
        setScanState('error');
        setScanStatus(error instanceof Error ? error.message : 'Unable to parse NFC card');
      }
    });
  }, []);

  useEffect(() => {
    if (tab !== 'nfc') {
      stopReader().catch(() => undefined);
      return;
    }

    startReader().catch((error) => {
      setScanState('error');
      setScanStatus(error instanceof Error ? error.message : 'Unable to start NFC reader');
    });

    return () => {
      stopReader().catch(() => undefined);
    };
  }, [startReader, stopReader, tab]);

  const onKeyPress = (key: string) => {
    setAmount((current) => nextAmount(current, key));
  };

  const onShareAddress = async () => {
    await Share.share({ message: `Pay ${LABELS[asset]} to ${merchantAddress}` });
  };

  const resetPaymentState = () => {
    setCustomerPassword('');
    setShareA(null);
    setPayerUserId('');
    setPosToken('');
    setProgressIndex(-1);
    setProcessing(false);
  };

  const onProcessPayment = async () => {
    if (!shareA || !payerUserId.trim() || !posToken.trim()) {
      Alert.alert('Customer card required', 'Tap the customer card before processing payment.');
      return;
    }

    if (!isPositiveAmount(amountValue)) {
      Alert.alert('Invalid amount', 'Enter a valid amount greater than zero.');
      return;
    }

    if (!customerPassword.trim()) {
      Alert.alert('Password required', 'Ask the customer to enter their wallet password.');
      return;
    }

    setProcessing(true);
    setProgressIndex(0);
    const interval = setInterval(() => {
      setProgressIndex((value) => (value < PROGRESS_STEPS.length - 1 ? value + 1 : value));
    }, 850);

    try {
      const tx = await sendPaymentInPosMode(
        customerPassword,
        payerUserId.trim(),
        { amount: amountValue, asset, recipient: merchantAddress },
        shareA,
        posToken.trim(),
      );

      setReceivedTx(tx);
      setShowSheet(false);
      resetPaymentState();
    } catch (error) {
      Alert.alert('Payment failed', error instanceof Error ? error.message : 'Unable to process payment.');
      resetPaymentState();
    } finally {
      clearInterval(interval);
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <Animated.View style={[styles.flex, { opacity, transform: [{ translateY }] }]}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Text allowFontScaling={false} style={styles.title}>Receive Payment</Text>
            <AddressChip
              address={merchantAddress || '0x0000'}
              chain={asset === 'SOL' || asset === 'USDC_SOL' ? 'SOL' : 'ETH'}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chainScroll}>
            <View style={styles.chainRow}>
              {ASSETS.map((item) => {
                const selected = item === asset;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setAsset(item)}
                    style={[styles.chainPill, selected && styles.chainPillActive]}
                  >
                    <Feather
                      color={selected ? Colors.offWhite : Colors.textMuted}
                      name={item === 'SOL' || item === 'USDC_SOL' ? 'triangle' : 'hexagon'}
                      size={14}
                    />
                    <Text allowFontScaling={false} style={[styles.chainText, selected && styles.chainTextActive]}>
                      {LABELS[item]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <GradientCard style={styles.amountCard}>
            <Text allowFontScaling={false} style={styles.amountText}>{amountValue}</Text>
            <Text allowFontScaling={false} style={styles.currencyText}>{LABELS[asset]}</Text>
            <Text allowFontScaling={false} style={styles.usdText}>${usdValue.toFixed(2)}</Text>
          </GradientCard>

          <View style={styles.keypadGrid}>
            {KEYS.map((key) => (
              <Pressable key={key} onPress={() => onKeyPress(key)} style={styles.keypadButton}>
                {key === 'DEL' ? (
                  <Feather color={Colors.brandOrange} name="delete" size={20} />
                ) : (
                  <Text allowFontScaling={false} style={styles.keypadText}>{key}</Text>
                )}
              </Pressable>
            ))}
          </View>

          <View style={styles.tabSwitcher}>
            <Pressable onPress={() => setTab('qr')} style={[styles.tabPill, tab === 'qr' && styles.tabPillActive]}>
              <Text allowFontScaling={false} style={[styles.tabText, tab === 'qr' && styles.tabTextActive]}>QR Code</Text>
            </Pressable>
            <Pressable onPress={() => setTab('nfc')} style={[styles.tabPill, tab === 'nfc' && styles.tabPillActive]}>
              <Text allowFontScaling={false} style={[styles.tabText, tab === 'nfc' && styles.tabTextActive]}>NFC Tap</Text>
            </Pressable>
          </View>

          {tab === 'qr' ? (
            <GradientCard style={styles.qrCard}>
              {merchantAddress ? (
                <View style={styles.qrWrap}>
                  <QRCode
                    backgroundColor={Colors.surface}
                    color={Colors.offWhite}
                    size={200}
                    value={`${merchantAddress}:${amountValue}:${asset}`}
                  />
                </View>
              ) : (
                <Text allowFontScaling={false} style={styles.helperText}>
                  Wallet address unavailable. Finish wallet setup to generate payment requests.
                </Text>
              )}
              <View style={styles.qrFooter}>
                <AddressChip
                  address={merchantAddress || '0x0000'}
                  chain={asset === 'SOL' || asset === 'USDC_SOL' ? 'SOL' : 'ETH'}
                />
                <OrangeButton label="Share Address" onPress={onShareAddress} size="sm" variant="outline" />
              </View>
            </GradientCard>
          ) : (
            <GradientCard style={styles.nfcCard}>
              <View style={styles.nfcWrap}>
                <NFCRingAnimation state={scanState} />
              </View>
              <View style={[styles.statusPill, scanState === 'scanning' ? styles.statusActive : styles.statusInactive]}>
                <View style={[styles.statusDot, scanState === 'scanning' ? styles.statusDotActive : styles.statusDotInactive]} />
                <Text allowFontScaling={false} style={styles.statusText}>
                  {scanState === 'scanning' ? 'NFC Active' : 'NFC Inactive'}
                </Text>
              </View>
              <Text allowFontScaling={false} style={styles.helperText}>
                {scanState === 'scanning' ? 'Waiting for customer to tap card...' : scanStatus}
              </Text>
            </GradientCard>
          )}

          {!receivedTx ? (
            <View>
              <View style={styles.sectionHeader}>
                <Text allowFontScaling={false} style={styles.sectionTitle}>Recent Payments</Text>
              </View>
              <GradientCard>
                {recentPayments.length === 0 ? (
                  <Text allowFontScaling={false} style={styles.helperText}>No recent payments yet.</Text>
                ) : (
                  recentPayments.map((tx, index) => (
                    <View key={tx.id} style={[styles.txRow, index > 0 && styles.txDivider]}>
                      <TransactionRow
                        address={tx.to}
                        amount={tx.amount}
                        asset={tx.asset}
                        direction="received"
                        status={tx.status}
                        timestamp={tx.timestamp}
                      />
                    </View>
                  ))
                )}
              </GradientCard>
            </View>
          ) : null}
        </ScrollView>

        <Modal animationType="slide" transparent visible={showSheet}>
          <View style={styles.sheetBackdrop}>
            <GradientCard style={styles.sheetCard}>
              <Text allowFontScaling={false} style={styles.sheetTitle}>Customer Authentication</Text>
              <Text allowFontScaling={false} style={styles.sheetSubtitle}>
                Ask the customer to enter their wallet password.
              </Text>
              <View style={styles.badge}>
                <Text allowFontScaling={false} style={styles.badgeText}>Entered on your device, not shared</Text>
              </View>
              <View>
                <TextInput
                  allowFontScaling={false}
                  autoCapitalize="none"
                  onChangeText={setCustomerPassword}
                  placeholder="Customer wallet password"
                  placeholderTextColor={Colors.textFaint}
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={customerPassword}
                />
                <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton}>
                  <Feather color={Colors.brandOrange} name={showPassword ? 'eye-off' : 'eye'} size={18} />
                </Pressable>
              </View>
              <View style={styles.pinArea}>
                <PinDot filled={Math.min(customerPassword.length, 6)} total={6} />
              </View>

              {processing ? (
                <View>
                  {PROGRESS_STEPS.map((label, index) => (
                    <View key={label} style={styles.progressRow}>
                      {index < progressIndex ? (
                        <Feather color={Colors.success} name="check-circle" size={16} />
                      ) : index === progressIndex ? (
                        <ActivityIndicator color={Colors.brandOrange} size="small" />
                      ) : (
                        <View style={styles.progressDot} />
                      )}
                      <Text allowFontScaling={false} style={styles.progressText}>{label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <OrangeButton label="Process Payment" onPress={onProcessPayment} size="lg" />
              )}
              <OrangeButton label="Close" onPress={() => setShowSheet(false)} size="md" variant="ghost" />
            </GradientCard>
          </View>
        </Modal>

        <Modal animationType="slide" transparent visible={!!receivedTx}>
          <View style={styles.overlay}>
            <View style={styles.overlayContent}>
              <Svg height={116} viewBox="0 0 120 120" width={116}>
                <Circle cx="60" cy="60" fill="none" r="44" stroke={Colors.success} strokeWidth={6} />
                <Path
                  d="M38 60l14 14 30-32"
                  fill="none"
                  stroke={Colors.success}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={8}
                />
              </Svg>
              <Text allowFontScaling={false} style={styles.overlayTitle}>Payment Received!</Text>
              <Text allowFontScaling={false} style={styles.overlayAmount}>
                {receivedTx?.amount} {receivedTx?.asset}
              </Text>
              <AddressChip
                address={merchantAddress || '0x0000'}
                chain={asset === 'SOL' || asset === 'USDC_SOL' ? 'SOL' : 'ETH'}
              />
              {receivedTx?.txHash ? (
                <Text allowFontScaling={false} style={styles.overlayHash}>{receivedTx.txHash}</Text>
              ) : null}
              <View style={styles.overlayButtons}>
                <OrangeButton
                  label="New Payment"
                  onPress={() => {
                    setReceivedTx(null);
                    setAmount('');
                  }}
                  size="md"
                />
                <OrangeButton
                  label="View Transaction"
                  onPress={() => (receivedTx?.txHash ? Alert.alert('Transaction', receivedTx.txHash) : undefined)}
                  size="md"
                  variant="outline"
                />
              </View>
            </View>
          </View>
        </Modal>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.deepDark,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  container: {
    paddingBottom: 100,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.displayMd,
    color: Colors.offWhite,
  },
  chainScroll: {
    marginBottom: Spacing.md,
  },
  chainRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chainPill: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chainPillActive: {
    backgroundColor: Colors.brandOrange,
  },
  chainText: {
    ...Typography.labelSm,
    color: Colors.textMuted,
  },
  chainTextActive: {
    color: Colors.offWhite,
  },
  amountCard: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  amountText: {
    ...Typography.heroBalance,
    color: Colors.offWhite,
    fontSize: 48,
  },
  currencyText: {
    ...Typography.heading3,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  usdText: {
    ...Typography.caption,
    color: Colors.textFaint,
    marginTop: Spacing.xs,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  keypadButton: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    height: 64,
    justifyContent: 'center',
    width: '23%',
  },
  keypadText: {
    ...Typography.displaySm,
    color: Colors.offWhite,
    fontSize: 22,
  },
  tabSwitcher: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    flexDirection: 'row',
    marginBottom: Spacing.lg,
    padding: 4,
  },
  tabPill: {
    alignItems: 'center',
    borderRadius: Radius.full,
    flex: 1,
    paddingVertical: 10,
  },
  tabPillActive: {
    backgroundColor: Colors.brandOrange,
  },
  tabText: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.offWhite,
  },
  qrCard: {
    alignItems: 'center',
  },
  qrWrap: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  qrFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    width: '100%',
  },
  nfcCard: {
    alignItems: 'center',
  },
  nfcWrap: {
    marginBottom: Spacing.lg,
  },
  statusPill: {
    alignItems: 'center',
    borderRadius: Radius.full,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusActive: {
    backgroundColor: Colors.successDim,
  },
  statusInactive: {
    backgroundColor: Colors.borderSubtle,
  },
  statusDot: {
    borderRadius: Radius.full,
    height: 10,
    width: 10,
  },
  statusDotActive: {
    backgroundColor: Colors.success,
  },
  statusDotInactive: {
    backgroundColor: Colors.textFaint,
  },
  statusText: {
    ...Typography.labelSm,
    color: Colors.offWhite,
  },
  helperText: {
    ...Typography.bodySm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  sectionHeader: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.heading3,
    color: Colors.offWhite,
  },
  txRow: {
    paddingVertical: 2,
  },
  txDivider: {
    borderTopColor: Colors.borderSubtle,
    borderTopWidth: 1,
  },
  sheetBackdrop: {
    backgroundColor: Colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.lg,
  },
  sheetCard: {
    marginBottom: 0,
  },
  sheetTitle: {
    ...Typography.heading2,
    color: Colors.offWhite,
    marginBottom: Spacing.xs,
  },
  sheetSubtitle: {
    ...Typography.bodySm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.orangeDim,
    borderColor: Colors.orangeMid,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginBottom: Spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    ...Typography.caption,
    color: Colors.brandOrange,
  },
  passwordInput: {
    ...Typography.body,
    backgroundColor: Colors.borderSubtle,
    borderColor: Colors.borderMid,
    borderRadius: Radius.md,
    borderWidth: 1,
    color: Colors.offWhite,
    paddingHorizontal: Spacing.md,
    paddingRight: 48,
    paddingVertical: 14,
  },
  eyeButton: {
    position: 'absolute',
    right: Spacing.md,
    top: 14,
  },
  pinArea: {
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  progressDot: {
    backgroundColor: Colors.orangeMid,
    borderRadius: Radius.full,
    height: 10,
    width: 10,
  },
  progressText: {
    ...Typography.bodySm,
    color: Colors.textMuted,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: Colors.deepDark,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overlayContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  overlayTitle: {
    ...Typography.displayTitle,
    color: Colors.offWhite,
    marginTop: Spacing.lg,
  },
  overlayAmount: {
    ...Typography.displayMd,
    color: Colors.success,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  overlayHash: {
    ...Typography.monoXs,
    color: Colors.brandOrange,
    marginTop: Spacing.md,
  },
  overlayButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
});
