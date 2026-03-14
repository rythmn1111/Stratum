import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { PrimaryButton } from '../components/PrimaryButton';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { ChainAsset } from '../types';

const receiveAssets: ChainAsset[] = ['ETH', 'SOL', 'USDC_ETH', 'USDC_SOL'];

export const ReceiveScreen: React.FC = () => {
  const { addresses, receiveAmount, setReceiveAmount, sendPaymentInPosMode } = useWallet();

  const [payerUserId, setPayerUserId] = useState('');
  const [payerPassword, setPayerPassword] = useState('');
  const [asset, setAsset] = useState<ChainAsset>('ETH');
  const [loading, setLoading] = useState(false);

  const receiveAddress = useMemo(() => {
    return asset.includes('SOL') || asset === 'SOL' ? addresses?.sol ?? '' : addresses?.eth ?? '';
  }, [addresses?.eth, addresses?.sol, asset]);

  const onProcessPosPayment = async () => {
    if (!receiveAddress) {
      Alert.alert('Address missing', 'Merchant wallet address is unavailable.');
      return;
    }

    setLoading(true);
    try {
      const tx = await sendPaymentInPosMode(payerPassword, payerUserId, {
        recipient: receiveAddress,
        amount: receiveAmount || '0',
        asset,
      });
      Alert.alert('POS payment confirmed', `Transaction ${tx.txHash ?? 'submitted'} confirmed.`);
      setPayerPassword('');
      setPayerUserId('');
    } catch (error) {
      Alert.alert('POS payment failed', error instanceof Error ? error.message : 'Unable to process payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Receive / POS Mode</Text>
      <Text style={styles.subtitle}>QR is active and NFC reader should be enabled on this device.</Text>

      <TextInput
        style={styles.input}
        value={receiveAmount}
        onChangeText={setReceiveAmount}
        placeholder="Amount (optional)"
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType="decimal-pad"
      />

      <View style={styles.assetRow}>
        {receiveAssets.map((option) => (
          <Text
            key={option}
            onPress={() => setAsset(option)}
            style={[styles.assetChip, asset === option && styles.assetChipActive]}
          >
            {option}
          </Text>
        ))}
      </View>

      <View style={styles.qrWrap}>
        {receiveAddress ? <QRCode value={receiveAddress} size={180} /> : <Text style={styles.fallback}>No address available</Text>}
      </View>

      <Text style={styles.status}>NFC Reader Mode: Active</Text>

      <TextInput
        style={styles.input}
        value={payerUserId}
        onChangeText={setPayerUserId}
        placeholder="Payer user ID"
        placeholderTextColor={theme.colors.textSecondary}
      />
      <TextInput
        style={styles.input}
        value={payerPassword}
        onChangeText={setPayerPassword}
        placeholder="Payer password"
        placeholderTextColor={theme.colors.textSecondary}
        secureTextEntry
      />

      <PrimaryButton title="Process POS Payment" onPress={onProcessPosPayment} loading={loading} />
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
  subtitle: {
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
  qrWrap: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: theme.radius.md,
    alignSelf: 'center',
    marginVertical: theme.spacing.md,
  },
  fallback: {
    color: theme.colors.background,
  },
  status: {
    color: theme.colors.success,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  assetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.sm,
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
