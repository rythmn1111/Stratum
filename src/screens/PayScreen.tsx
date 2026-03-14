import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionLabel } from '../components/SectionLabel';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { ChainAsset } from '../types';
import { isPositiveAmount, validateRecipientByAsset } from '../utils/validation';

const ASSETS: ChainAsset[] = ['ETH', 'SOL', 'USDC_ETH', 'USDC_SOL'];

const ASSET_META: Record<ChainAsset, { color: string; network: string }> = {
  ETH: { color: '#627EEA', network: 'Ethereum' },
  SOL: { color: '#9945FF', network: 'Solana' },
  USDC_ETH: { color: '#2775CA', network: 'USDC · Ethereum' },
  USDC_SOL: { color: '#2775CA', network: 'USDC · Solana' },
};

export const PayScreen: React.FC = () => {
  const { sendPaymentFromOwnDevice, isNfcScanning } = useWallet();

  const [password, setPassword] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState<ChainAsset>('ETH');
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const canSubmit = useMemo(() => !!(recipient && amount), [recipient, amount]);

  const validateDraft = (): { recipient: string; amount: string } | null => {
    const trimmedRecipient = recipient.trim();
    const trimmedAmount = amount.trim();

    if (!isPositiveAmount(trimmedAmount)) {
      Alert.alert('Invalid amount', 'Amount must be greater than zero.');
      return null;
    }

    try {
      validateRecipientByAsset(asset, trimmedRecipient);
    } catch (error) {
      Alert.alert('Invalid recipient', error instanceof Error ? error.message : 'Invalid recipient address.');
      return null;
    }

    return { recipient: trimmedRecipient, amount: trimmedAmount };
  };

  const submit = async () => {
    if (!password.trim()) {
      Alert.alert('Missing password', 'Enter wallet password to authorize this payment.');
      return;
    }

    const draft = validateDraft();
    if (!draft) {
      return;
    }

    setLoading(true);
    try {
      const tx = await sendPaymentFromOwnDevice(
        password,
        { recipient: draft.recipient, amount: draft.amount, asset },
      );
      Alert.alert('Payment sent', `Transaction ${tx.txHash ?? 'submitted'} confirmed.`);
      setPassword('');
      setRecipient('');
      setAmount('');
      setShowConfirmModal(false);
    } catch (error) {
      Alert.alert('Payment failed', error instanceof Error ? error.message : 'Unable to send payment.');
    } finally {
      setLoading(false);
    }
  };

  const openConfirmation = () => {
    const draft = validateDraft();
    if (!draft) {
      return;
    }

    setShowConfirmModal(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.kbv}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Modal transparent animationType="fade" visible={isNfcScanning}>
        <View style={styles.nfcOverlay}>
          <View style={styles.nfcBox}>
            <ActivityIndicator color={theme.colors.accent} size="large" />
            <Text style={styles.nfcTitle}>Tap Your NFC Card</Text>
            <Text style={styles.nfcSubtitle}>
              Hold your wallet card flat against the back of your phone.
            </Text>
          </View>
        </View>
      </Modal>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Send" subtitle="Tap your NFC card on this device when prompted." />

        <SectionLabel label="Asset" />
        <View style={styles.assetGrid}>
          {ASSETS.map((a) => (
            <Pressable
              key={a}
              onPress={() => setAsset(a)}
              style={[styles.assetChip, asset === a && styles.assetChipActive]}
            >
              <View style={[styles.assetDot, { backgroundColor: ASSET_META[a].color }]} />
              <View>
                <Text style={[styles.assetChipName, asset === a && styles.assetChipNameActive]}>
                  {a}
                </Text>
                <Text style={styles.assetChipNetwork}>{ASSET_META[a].network}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <SectionLabel label="Recipient" />
        <TextInput
          style={styles.input}
          value={recipient}
          onChangeText={setRecipient}
          placeholder="0x… or wallet address"
          placeholderTextColor={theme.colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <SectionLabel label="Amount" />
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="decimal-pad"
        />

        <SectionLabel label="Checkout" />
        <GlassCard>
          <Text style={styles.authHint}>
            Review payment first, then confirm with password in a secure popup.
          </Text>
        </GlassCard>

        <PrimaryButton
          title="Review & Confirm"
          onPress={() => openConfirmation()}
          loading={loading}
          disabled={!canSubmit}
        />
      </ScrollView>

      <Modal transparent animationType="fade" visible={showConfirmModal}>
        <View style={styles.nfcOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Confirm Transaction</Text>
            <Text style={styles.confirmLine}>Asset: {asset}</Text>
            <Text style={styles.confirmLine}>Amount: {amount.trim() || '0'}</Text>
            <Text style={styles.confirmLine} numberOfLines={1}>To: {recipient.trim() || '—'}</Text>
            <Text style={styles.confirmHint}>
              Enter your wallet password to sign and broadcast this payment.
            </Text>

            <TextInput
              style={[styles.input, styles.confirmInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="Wallet password"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={styles.confirmActions}>
              <PrimaryButton
                title="Cancel"
                onPress={() => {
                  setShowConfirmModal(false);
                }}
              />
              <PrimaryButton
                title="Sign & Send"
                onPress={() => submit()}
                loading={loading}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  kbv: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, paddingBottom: 40 },
  nfcOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 32,
    alignItems: 'center',
    width: '80%',
    gap: 14,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  nfcTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  nfcSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 20,
    width: '88%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  confirmTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  confirmLine: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    marginBottom: 4,
  },
  confirmHint: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 10,
    lineHeight: 17,
  },
  confirmInput: {
    marginBottom: 10,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  assetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  assetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    width: '47%',
  },
  assetChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(42,230,215,0.08)',
  },
  assetDot: { width: 10, height: 10, borderRadius: 5 },
  assetChipName: { color: theme.colors.textSecondary, fontWeight: '700', fontSize: 14 },
  assetChipNameActive: { color: theme.colors.accent },
  assetChipNetwork: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 1 },
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
  authHint: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },
});
