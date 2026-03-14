import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { ChainAsset } from '../types';

const assets: ChainAsset[] = ['ETH', 'SOL', 'USDC_ETH', 'USDC_SOL'];

export const PayScreen: React.FC = () => {
  const { sendPaymentFromOwnDevice } = useWallet();

  const [password, setPassword] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState<ChainAsset>('ETH');
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => password && recipient && amount, [password, recipient, amount]);

  const submit = async () => {
    setLoading(true);
    try {
      const tx = await sendPaymentFromOwnDevice(password, { recipient, amount, asset });
      Alert.alert('Payment sent', `Transaction ${tx.txHash ?? 'submitted'} confirmed.`);
      setPassword('');
      setRecipient('');
      setAmount('');
    } catch (error) {
      Alert.alert('Payment failed', error instanceof Error ? error.message : 'Unable to send payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Pay</Text>
      <Text style={styles.hint}>Tap your NFC card on this phone when prompted.</Text>

      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={theme.colors.textSecondary}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        value={recipient}
        onChangeText={setRecipient}
        placeholder="Recipient address"
        placeholderTextColor={theme.colors.textSecondary}
      />
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="Amount"
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType="decimal-pad"
      />

      <View style={styles.assetRow}>
        {assets.map((option) => (
          <Text
            key={option}
            onPress={() => setAsset(option)}
            style={[styles.assetChip, asset === option && styles.assetChipActive]}
          >
            {option}
          </Text>
        ))}
      </View>

      <PrimaryButton title="Confirm & Broadcast" onPress={submit} loading={loading} disabled={!canSubmit} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  hint: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.textPrimary,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  assetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.lg,
  },
  assetChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.textSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    marginRight: 8,
    marginBottom: 8,
  },
  assetChipActive: {
    borderColor: theme.colors.accent,
    color: theme.colors.accent,
  },
});
