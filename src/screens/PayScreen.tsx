import React, { useEffect, useMemo, useRef, useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
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
import Svg, { Circle, Path } from 'react-native-svg';
import { AddressChip } from '../components/ui/AddressChip';
import { BalancePill } from '../components/ui/BalancePill';
import { GradientCard } from '../components/ui/GradientCard';
import { NFCRingAnimation } from '../components/ui/NFCRingAnimation';
import { OrangeButton } from '../components/ui/OrangeButton';
import { PinDot } from '../components/ui/PinDot';
import { StepIndicator } from '../components/ui/StepIndicator';
import { useWallet } from '../context/WalletContext';
import { nfcService } from '../services/nfcService';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Typography } from '../theme/typography';
import { ChainAsset } from '../types';
import { isPositiveAmount, validateRecipientByAsset } from '../utils/validation';

type Phase = 'select' | 'tap' | 'confirm' | 'success' | 'failure';

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
const PHASE_STEPS = ['Details', 'Tap', 'Confirm'];
const PROGRESS_STEPS = ['Fetching secure share', 'Reconstructing key', 'Signing transaction', 'Broadcasting'];

const getChain = (asset: ChainAsset): 'ETH' | 'SOL' => (asset === 'SOL' || asset === 'USDC_SOL' ? 'SOL' : 'ETH');
const getExplorerUrl = (asset: ChainAsset, txHash: string) => (
  asset === 'SOL' || asset === 'USDC_SOL'
    ? `https://solscan.io/tx/${encodeURIComponent(txHash)}?cluster=devnet`
    : `https://sepolia.etherscan.io/tx/${encodeURIComponent(txHash)}`
);

export const PayScreen: React.FC = () => {
  const { balances, sendPaymentFromOwnDevice } = useWallet();
  const [phase, setPhase] = useState<Phase>('select');
  const [asset, setAsset] = useState<ChainAsset>('ETH');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [nfcState, setNfcState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [loading, setLoading] = useState(false);
  const [progressIndex, setProgressIndex] = useState(-1);
  const [failureMessage, setFailureMessage] = useState('');
  const [txHash, setTxHash] = useState('');
  const shareARef = useRef<Uint8Array | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  const chain = getChain(asset);
  const availableBalance = useMemo(() => {
    if (asset === 'ETH') return balances.eth;
    if (asset === 'SOL') return balances.sol;
    if (asset === 'USDC_ETH') return balances.usdcEth;
    return balances.usdcSol;
  }, [asset, balances.eth, balances.sol, balances.usdcEth, balances.usdcSol]);
  const usdValue = useMemo(() => (isPositiveAmount(amount) ? parseFloat(amount) * PRICES[asset] : 0), [amount, asset]);
  const stepIndex = phase === 'select' ? 0 : phase === 'tap' ? 1 : 2;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  useEffect(() => {
    if (phase !== 'tap') {
      return;
    }

    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    setNfcState('scanning');
    setFailureMessage('');
    setSecondsLeft(30);

    const countdown = setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);

    const run = async () => {
      try {
        const card = await nfcService.readCardDataFromCard();
        if (!active) {
          return;
        }
        shareARef.current = card.shareA;
        setNfcState('success');
        timeoutId = setTimeout(() => {
          if (active) {
            setPhase('confirm');
          }
        }, 700);
      } catch (error) {
        if (!active) {
          return;
        }
        setNfcState('error');
        setFailureMessage(error instanceof Error ? error.message : 'Unable to read NFC card.');
      }
    };

    run().catch(() => undefined);

    return () => {
      active = false;
      clearInterval(countdown);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [phase]);

  const resetFlow = () => {
    setPhase('select');
    setRecipient('');
    setAmount('');
    setPassword('');
    setShowPassword(false);
    setNfcState('idle');
    setFailureMessage('');
    setLoading(false);
    setProgressIndex(-1);
    setTxHash('');
    shareARef.current = null;
  };

  const onPasteRecipient = async () => {
    const value = await Clipboard.getString();
    if (value) {
      setRecipient(value.trim());
    }
  };

  const onMax = () => {
    setAmount(availableBalance);
  };

  const goToTap = () => {
    try {
      validateRecipientByAsset(asset, recipient);
    } catch (error) {
      Alert.alert('Invalid recipient', error instanceof Error ? error.message : 'Enter a valid address.');
      return;
    }

    if (!isPositiveAmount(amount)) {
      Alert.alert('Invalid amount', 'Enter a valid amount greater than zero.');
      return;
    }

    setPhase('tap');
  };

  const onConfirm = async () => {
    if (!password.trim()) {
      Alert.alert('Password required', 'Enter your wallet password to sign the payment.');
      return;
    }

    setLoading(true);
    setProgressIndex(0);
    const interval = setInterval(() => {
      setProgressIndex((value) => (value < PROGRESS_STEPS.length - 1 ? value + 1 : value));
    }, 900);

    try {
      const tx = await sendPaymentFromOwnDevice(password, {
        amount,
        asset,
        recipient: recipient.trim(),
      }, shareARef.current ?? undefined);
      setTxHash(tx.txHash ?? '');
      setPhase('success');
    } catch (error) {
      setFailureMessage(error instanceof Error ? error.message : 'Unable to complete payment.');
      setPhase('failure');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const onOpenExplorer = async () => {
    if (!txHash) {
      return;
    }
    const url = getExplorerUrl(asset, txHash);
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  };

  const onShareReceipt = async () => {
    await Share.share({
      message: `Paid ${amount} ${LABELS[asset]} to ${recipient.trim()}${txHash ? `\nTx: ${txHash}` : ''}`,
    });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Animated.View style={[styles.flex, { opacity, transform: [{ translateY }] }]}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text allowFontScaling={false} style={styles.title}>Tap To Pay</Text>
            <Text allowFontScaling={false} style={styles.subtitle}>Fast, card-backed crypto payments with your phone.</Text>

            <GradientCard style={styles.stepCard}>
              <StepIndicator currentStep={stepIndex} steps={PHASE_STEPS} />
            </GradientCard>

            {phase === 'select' && (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.assetScroll}>
                  <View style={styles.assetRow}>
                    {ASSETS.map((item) => {
                      const selected = item === asset;
                      return (
                        <Pressable key={item} onPress={() => setAsset(item)} style={[styles.assetPill, selected && styles.assetPillActive]}>
                          <Text allowFontScaling={false} style={[styles.assetPillText, selected && styles.assetPillTextActive]}>{LABELS[item]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>

                <GradientCard>
                  <View style={styles.balanceRow}>
                    <Text allowFontScaling={false} style={styles.balanceLabel}>Available Balance</Text>
                    <BalancePill asset={LABELS[asset]} balance={availableBalance} />
                  </View>

                  <View style={styles.amountWrap}>
                    <Pressable onPress={onMax} style={styles.maxButton}><Text allowFontScaling={false} style={styles.maxButtonText}>MAX</Text></Pressable>
                    <TextInput
                      allowFontScaling={false}
                      keyboardType="decimal-pad"
                      onChangeText={setAmount}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textFaint}
                      style={styles.amountInput}
                      value={amount}
                    />
                    <Text allowFontScaling={false} style={styles.currencyLabel}>{LABELS[asset]}</Text>
                    <Text allowFontScaling={false} style={styles.usdHint}>≈ ${usdValue.toFixed(2)}</Text>
                  </View>

                  <Text allowFontScaling={false} style={styles.fieldOverline}>Recipient</Text>
                  <View style={styles.recipientRow}>
                    <TextInput
                      allowFontScaling={false}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={setRecipient}
                      placeholder={chain === 'ETH' ? '0x...' : 'Solana address'}
                      placeholderTextColor={Colors.textFaint}
                      style={styles.recipientInput}
                      value={recipient}
                    />
                    <Pressable onPress={onPasteRecipient} style={styles.smallIconButton}>
                      <Feather color={Colors.brandOrange} name="clipboard" size={16} />
                    </Pressable>
                  </View>
                </GradientCard>

                <OrangeButton label="Continue To Tap" onPress={goToTap} size="lg" />
              </>
            )}

            {phase === 'tap' && (
              <GradientCard style={styles.centeredPhase}>
                <Text allowFontScaling={false} style={styles.title}>Tap your NFC card</Text>
                <Text allowFontScaling={false} style={styles.subtitleCentered}>Bring the customer card close to the phone to reconstruct your encrypted share.</Text>
                <View style={styles.nfcArea}><NFCRingAnimation state={nfcState} /></View>
                <Text allowFontScaling={false} style={styles.waitingText}>Timeout in {secondsLeft}s</Text>
                {failureMessage ? <Text allowFontScaling={false} style={styles.errorText}>{failureMessage}</Text> : null}
                <OrangeButton label="Back" onPress={() => setPhase('select')} size="md" variant="ghost" />
              </GradientCard>
            )}

            {phase === 'confirm' && (
              <>
                <GradientCard style={styles.summaryCard}>
                  <Text allowFontScaling={false} style={styles.summaryAmount}>{amount} {LABELS[asset]}</Text>
                  <Text allowFontScaling={false} style={styles.summaryUsd}>≈ ${usdValue.toFixed(2)}</Text>
                  <View style={styles.summaryArrow}><Feather color={Colors.brandOrange} name="arrow-down" size={20} /></View>
                  <AddressChip address={recipient.trim()} chain={chain} />
                </GradientCard>

                <GradientCard>
                  <Text allowFontScaling={false} style={styles.fieldOverline}>Wallet Password</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      allowFontScaling={false}
                      autoCapitalize="none"
                      onChangeText={setPassword}
                      placeholder="Enter wallet password"
                      placeholderTextColor={Colors.textFaint}
                      secureTextEntry={!showPassword}
                      style={styles.passwordInput}
                      value={password}
                    />
                    <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.smallIconButton}>
                      <Feather color={Colors.brandOrange} name={showPassword ? 'eye-off' : 'eye'} size={16} />
                    </Pressable>
                  </View>
                  <View style={styles.pinWrap}><PinDot filled={Math.min(password.length, 6)} total={6} /></View>

                  {loading ? (
                    <View>
                      {PROGRESS_STEPS.map((label, index) => {
                        const active = index === progressIndex;
                        const complete = index < progressIndex;
                        return (
                          <View key={label} style={styles.progressRow}>
                            {complete ? <Feather color={Colors.success} name="check-circle" size={16} /> : active ? <ActivityIndicator color={Colors.brandOrange} size="small" /> : <View style={styles.progressDot} />}
                            <Text allowFontScaling={false} style={[styles.progressText, active && styles.progressTextActive, complete && styles.progressTextComplete]}>{label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <OrangeButton label="Confirm Payment" onPress={onConfirm} size="lg" />
                  )}
                </GradientCard>
              </>
            )}
          </ScrollView>

          <Modal animationType="fade" transparent visible={phase === 'success'}>
            <View style={styles.overlay}>
              <View style={styles.resultWrap}>
                <Svg height={116} viewBox="0 0 120 120" width={116}>
                  <Circle cx="60" cy="60" fill="none" r="44" stroke={Colors.success} strokeWidth={6} />
                  <Path d="M38 60l14 14 30-32" fill="none" stroke={Colors.success} strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
                </Svg>
                <Text allowFontScaling={false} style={styles.resultTitle}>Payment Sent</Text>
                <Text allowFontScaling={false} style={styles.resultAmount}>{amount} {LABELS[asset]}</Text>
                <Text allowFontScaling={false} style={styles.resultMeta}>To {recipient.trim()}</Text>
                {txHash ? <Pressable onPress={onOpenExplorer}><Text allowFontScaling={false} style={styles.txHash}>{txHash}</Text></Pressable> : null}
                <View style={styles.resultActions}>
                  <OrangeButton label="Done" onPress={resetFlow} size="md" />
                  <OrangeButton label="Share Receipt" onPress={onShareReceipt} size="md" variant="outline" />
                </View>
              </View>
            </View>
          </Modal>

          <Modal animationType="fade" transparent visible={phase === 'failure'}>
            <View style={styles.overlay}>
              <View style={styles.resultWrap}>
                <Svg height={116} viewBox="0 0 120 120" width={116}>
                  <Circle cx="60" cy="60" fill="none" r="44" stroke={Colors.error} strokeWidth={6} />
                  <Path d="M46 46l28 28M74 46 46 74" fill="none" stroke={Colors.error} strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
                </Svg>
                <Text allowFontScaling={false} style={styles.resultTitle}>Payment Failed</Text>
                <Text allowFontScaling={false} style={styles.errorText}>{failureMessage || 'Unable to process payment.'}</Text>
                <View style={styles.resultActions}>
                  <OrangeButton label="Try Again" onPress={() => setPhase(shareARef.current ? 'confirm' : 'tap')} size="md" />
                  <OrangeButton label="Edit Details" onPress={() => setPhase('select')} size="md" variant="outline" />
                </View>
              </View>
            </View>
          </Modal>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: Colors.deepDark, flex: 1 },
  flex: { flex: 1 },
  container: { paddingBottom: 100, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  title: { ...Typography.displayMd, color: Colors.offWhite },
  subtitle: { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing.lg, marginTop: Spacing.sm },
  stepCard: { marginBottom: Spacing.lg },
  assetScroll: { marginBottom: Spacing.md },
  assetRow: { flexDirection: 'row', gap: Spacing.sm },
  assetPill: { backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 10 },
  assetPillActive: { backgroundColor: Colors.brandOrange },
  assetPillText: { ...Typography.labelSm, color: Colors.textMuted },
  assetPillTextActive: { color: Colors.offWhite },
  balanceRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  balanceLabel: { ...Typography.labelSm, color: Colors.textMuted },
  amountWrap: { borderBottomColor: Colors.brandOrange, borderBottomWidth: 2, marginBottom: Spacing.xl, paddingBottom: Spacing.md },
  maxButton: { alignItems: 'center', alignSelf: 'flex-end', backgroundColor: Colors.orangeDim, borderColor: Colors.orangeMid, borderRadius: Radius.full, borderWidth: 1, marginBottom: Spacing.sm, paddingHorizontal: 12, paddingVertical: 6 },
  maxButtonText: { ...Typography.labelSm, color: Colors.brandOrange },
  amountInput: { ...Typography.amountInput, color: Colors.offWhite, paddingVertical: 0, textAlign: 'center' },
  currencyLabel: { ...Typography.heading3, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'center' },
  usdHint: { ...Typography.bodySm, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'center' },
  fieldOverline: { ...Typography.overline, color: Colors.textMuted, marginBottom: Spacing.sm },
  recipientRow: { alignItems: 'center', borderColor: Colors.borderMid, borderRadius: Radius.md, borderWidth: 1, flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 14 },
  recipientInput: { ...Typography.monoSm, color: Colors.offWhite, flex: 1, paddingVertical: 0 },
  smallIconButton: { alignItems: 'center', backgroundColor: Colors.orangeDim, borderRadius: Radius.full, height: 32, justifyContent: 'center', width: 32 },
  centeredPhase: { alignItems: 'center', justifyContent: 'center', paddingTop: Spacing['2xl'] },
  subtitleCentered: { ...Typography.body, color: Colors.textMuted, maxWidth: 280, textAlign: 'center' },
  nfcArea: { marginVertical: Spacing.xl },
  waitingText: { ...Typography.bodySm, color: Colors.textMuted },
  summaryCard: { alignItems: 'center', marginBottom: Spacing.lg },
  summaryAmount: { ...Typography.amountMd, color: Colors.offWhite, textAlign: 'center' },
  summaryUsd: { ...Typography.bodySm, color: Colors.textMuted, marginTop: Spacing.sm },
  summaryArrow: { marginVertical: Spacing.md },
  passwordRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm },
  passwordInput: { ...Typography.body, borderColor: Colors.borderMid, borderRadius: Radius.md, borderWidth: 1, color: Colors.offWhite, flex: 1, paddingHorizontal: Spacing.md, paddingVertical: 14 },
  pinWrap: { marginTop: Spacing.md },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  progressDot: { backgroundColor: Colors.orangeMid, borderRadius: Radius.full, height: 10, width: 10 },
  progressText: { ...Typography.bodySm, color: Colors.textMuted },
  progressTextActive: { color: Colors.offWhite },
  progressTextComplete: { color: Colors.success },
  overlay: { alignItems: 'center', backgroundColor: Colors.deepDark, bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  resultWrap: { alignItems: 'center', paddingHorizontal: Spacing.xl, width: '100%' },
  resultTitle: { ...Typography.displayTitle, color: Colors.offWhite, marginTop: Spacing.lg },
  resultAmount: { ...Typography.monoLg, color: Colors.offWhite, marginTop: Spacing.md },
  resultMeta: { ...Typography.body, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'center' },
  txHash: { ...Typography.monoXs, color: Colors.brandOrange, marginTop: Spacing.md, textDecorationLine: 'underline' },
  resultActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  errorText: { ...Typography.bodySm, color: Colors.error, marginBottom: Spacing.md, marginTop: Spacing.sm, textAlign: 'center' },
});
