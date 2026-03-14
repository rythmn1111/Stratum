import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionLabel } from '../components/SectionLabel';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { nfcService } from '../services/nfcService';
import { truncateAddress } from '../utils/format';
import { ChainAsset } from '../types';
import { wipeUint8 } from '../utils/memory';
import { isPositiveAmount } from '../utils/validation';

type ReceiveMode = 'receive' | 'pos';

const ASSETS: ChainAsset[] = ['ETH', 'SOL', 'USDC_ETH', 'USDC_SOL'];

export const ReceiveScreen: React.FC = () => {
  const { addresses, receiveAmount, setReceiveAmount, sendPaymentInPosMode } = useWallet();

  const [mode, setMode] = useState<ReceiveMode>('receive');
  const [asset, setAsset] = useState<ChainAsset>('ETH');
  const [payerUserId, setPayerUserId] = useState('');
  const [payerUserIdAutoResolved, setPayerUserIdAutoResolved] = useState(false);
  const [payerPassword, setPayerPassword] = useState('');
  const [posShareA, setPosShareA] = useState<Uint8Array | null>(null);
  const [posToken, setPosToken] = useState<string | null>(null);
  const [posTokenAutoResolved, setPosTokenAutoResolved] = useState(false);
  const [posTokenManual, setPosTokenManual] = useState('');
  const [isNfcReading, setIsNfcReading] = useState(false);
  const [loading, setLoading] = useState(false);

  const receiveAddress = useMemo(
    () => (asset.includes('SOL') || asset === 'SOL' ? addresses?.sol ?? '' : addresses?.eth ?? ''),
    [addresses, asset],
  );

  useEffect(() => {
    if (mode !== 'pos' && posShareA) {
      wipeUint8(posShareA);
      setPosShareA(null);
      setPayerUserId('');
      setPayerUserIdAutoResolved(false);
      setPosToken(null);
      setPosTokenAutoResolved(false);
      setPosTokenManual('');
    }
  }, [mode, posShareA]);

  useEffect(() => () => {
    if (posShareA) {
      wipeUint8(posShareA);
    }
  }, [posShareA]);

  const onProcessPosPayment = async () => {
    if (!posShareA) {
      Alert.alert('Card required', 'Tap payer NFC card first to load authorization share.');
      return;
    }

    if (!receiveAddress) {
      Alert.alert('Address missing', 'Merchant wallet address is unavailable.');
      return;
    }

    if (!payerUserId.trim()) {
      Alert.alert('Payer required', 'Enter payer user ID to fetch the server share.');
      return;
    }

    if (!payerPassword.trim()) {
      Alert.alert('Password required', 'Enter payer password to decrypt and sign.');
      return;
    }

    if (!isPositiveAmount(receiveAmount || '0')) {
      Alert.alert('Invalid amount', 'Amount must be greater than zero.');
      return;
    }

    const resolvedPosToken = posTokenAutoResolved ? posToken : posTokenManual.trim();
    if (!resolvedPosToken) {
      Alert.alert(
        'POS token required',
        'Scan a card with embedded token or enter the payer\'s POS Token from their Wallet screen.',
      );
      return;
    }

    setLoading(true);
    try {
      const tx = await sendPaymentInPosMode(
        payerPassword,
        payerUserId,
        { recipient: receiveAddress, amount: receiveAmount.trim(), asset },
        posShareA,
        resolvedPosToken,
      );
      Alert.alert('Payment confirmed', `Transaction ${tx.txHash ?? 'submitted'} confirmed.`);
      setPayerPassword('');
      setPayerUserId('');
      setPayerUserIdAutoResolved(false);
      setPosToken(null);
      setPosTokenAutoResolved(false);
      setPosTokenManual('');
      wipeUint8(posShareA);
      setPosShareA(null);
    } catch (error) {
      Alert.alert('Payment failed', error instanceof Error ? error.message : 'Unable to process payment.');
    } finally {
      setLoading(false);
    }
  };

  const onReadPayerCard = async () => {
    setIsNfcReading(true);
    try {
      const readResult = await nfcService.readCardDataFromCard();
      if (posShareA) {
        wipeUint8(posShareA);
      }
      setPosShareA(readResult.shareA);

      if (readResult.userId) {
        setPayerUserId(readResult.userId);
        setPayerUserIdAutoResolved(true);
      } else {
        setPayerUserIdAutoResolved(false);
      }

      if (readResult.posToken) {
        setPosToken(readResult.posToken);
        setPosTokenAutoResolved(true);
      } else {
        setPosToken(null);
        setPosTokenAutoResolved(false);
      }

      const hasId = !!readResult.userId;
      const hasTok = !!readResult.posToken;
      if (hasId && hasTok) {
        Alert.alert('Card detected', 'Payer card loaded. User ID and POS token auto-resolved.');
      } else if (hasId) {
        Alert.alert('Card detected', 'Payer card loaded. Enter POS token manually (from payer\'s Wallet screen).');
      } else {
        Alert.alert('Card detected', 'Legacy card loaded. Enter payer user ID and POS token manually.');
      }
    } catch (error) {
      Alert.alert('NFC read failed', error instanceof Error ? error.message : 'Unable to read payer card.');
    } finally {
      setIsNfcReading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.kbv} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Receive" />

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeBtn, mode === 'receive' && styles.modeBtnActive]}
            onPress={() => setMode('receive')}
          >
            <Text style={[styles.modeBtnText, mode === 'receive' && styles.modeBtnTextActive]}>
              My QR Code
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === 'pos' && styles.modeBtnActive]}
            onPress={() => setMode('pos')}
          >
            <Text style={[styles.modeBtnText, mode === 'pos' && styles.modeBtnTextActive]}>
              POS Mode
            </Text>
          </Pressable>
        </View>

        {/* Asset selector */}
        <SectionLabel label="Asset" />
        <View style={styles.chipRow}>
          {ASSETS.map((a) => (
            <Pressable
              key={a}
              onPress={() => setAsset(a)}
              style={[styles.chip, asset === a && styles.chipActive]}
            >
              <Text style={[styles.chipText, asset === a && styles.chipTextActive]}>{a}</Text>
            </Pressable>
          ))}
        </View>

        {mode === 'receive' && (
          <>
            <GlassCard>
              <View style={styles.qrBox}>
                {receiveAddress ? (
                  <QRCode value={receiveAddress} size={180} />
                ) : (
                  <Text style={styles.noAddr}>No address — complete wallet setup first.</Text>
                )}
              </View>
            </GlassCard>

            {receiveAddress ? (
              <GlassCard>
                <Text style={styles.addrLabel}>{asset} Address</Text>
                <Text style={styles.addrFull} selectable>
                  {receiveAddress}
                </Text>
                <Text style={styles.addrTrunc}>{truncateAddress(receiveAddress)}</Text>
              </GlassCard>
            ) : null}
          </>
        )}

        {mode === 'pos' && (
          <>
            <GlassCard>
              <View style={styles.qrBox}>
                {receiveAddress ? (
                  <QRCode value={receiveAddress} size={180} />
                ) : (
                  <Text style={styles.noAddr}>No address — complete wallet setup first.</Text>
                )}
              </View>
            </GlassCard>

            <GlassCard>
              <Text style={styles.posMetaLabel}>NFC Reader</Text>
              <Text style={styles.posMetaText}>
                {isNfcReading ? 'Listening for NFC card… keep card near phone.' : posShareA ? 'Payer card loaded. Ready for password.' : 'Tap to scan payer card and load Share A.'}
              </Text>
              <PrimaryButton
                title={posShareA ? 'Rescan Payer Card' : 'Tap Payer Card'}
                onPress={onReadPayerCard}
                loading={isNfcReading}
              />
            </GlassCard>

            <SectionLabel label="Amount to Collect" />
            <TextInput
              style={styles.input}
              value={receiveAmount}
              onChangeText={setReceiveAmount}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="decimal-pad"
            />

            <GlassCard>
              <Text style={styles.posMetaLabel}>Payer Details</Text>
              <Text style={styles.posMetaText}>
                {payerUserIdAutoResolved
                  ? 'Payer ID auto-resolved from card.'
                  : 'Enter payer user ID (from their Wallet screen).'}
              </Text>
              <TextInput
                style={[styles.input, styles.inputInCard]}
                value={payerUserId}
                onChangeText={(text) => {
                  setPayerUserId(text);
                  if (text !== payerUserId) {
                    setPayerUserIdAutoResolved(false);
                  }
                }}
                placeholder="Payer user ID"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!payerUserIdAutoResolved}
              />

              <Text style={styles.posMetaText}>
                {posTokenAutoResolved
                  ? 'POS token auto-resolved from card.'
                  : 'Enter POS token (from payer\'s Wallet screen → POS Token).'}
              </Text>
              {!posTokenAutoResolved && (
                <TextInput
                  style={[styles.input, styles.inputInCard]}
                  value={posTokenManual}
                  onChangeText={setPosTokenManual}
                  placeholder="POS token"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
              {posTokenAutoResolved && (
                <View style={styles.tokenResolvedRow}>
                  <View style={styles.tokenResolvedDot} />
                  <Text style={styles.tokenResolvedText}>POS token loaded from card</Text>
                </View>
              )}

              <TextInput
                style={[styles.input, styles.inputLast]}
                value={payerPassword}
                onChangeText={setPayerPassword}
                placeholder="Payer password"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                autoCapitalize="none"
              />
            </GlassCard>

            <PrimaryButton title="Process Payment" onPress={onProcessPosPayment} loading={loading} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  kbv: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, paddingBottom: 40 },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 3,
    marginBottom: theme.spacing.xs,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: theme.radius.sm,
  },
  modeBtnActive: { backgroundColor: theme.colors.accent },
  modeBtnText: { color: theme.colors.textSecondary, fontWeight: '700', fontSize: 14 },
  modeBtnTextActive: { color: theme.colors.background },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
  },
  chipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(42,230,215,0.08)',
  },
  chipText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: theme.colors.accent },
  qrBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    backgroundColor: '#fff',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  noAddr: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  posMetaLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  posMetaText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: theme.spacing.sm,
  },
  addrLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  addrFull: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
    marginBottom: 2,
  },
  addrTrunc: { color: theme.colors.textSecondary, fontSize: 12 },
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
  tokenResolvedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(42,230,215,0.06)',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(42,230,215,0.25)',
  },
  tokenResolvedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  tokenResolvedText: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  inputInCard: { marginBottom: theme.spacing.sm },
  inputLast: { marginBottom: 0 },
});
