import React from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';

export const SettingsScreen: React.FC = () => {
  const { addresses, logout } = useWallet();

  const onLostCardFlow = () => {
    Alert.alert(
      'Recovery placeholder',
      'Card-loss recovery should require identity verification, server-share escrow controls, and full key rotation.',
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <GlassCard>
        <Text style={styles.label}>ETH Address</Text>
        <Text style={styles.value}>{addresses?.eth ?? '-'}</Text>
        <Text style={styles.label}>SOL Address</Text>
        <Text style={styles.value}>{addresses?.sol ?? '-'}</Text>
      </GlassCard>

      <PrimaryButton title="Re-setup NFC Card" onPress={onLostCardFlow} />

      <Text style={styles.spacing} />

      <PrimaryButton title="Logout" onPress={logout} />
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
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  spacing: {
    marginVertical: theme.spacing.xs,
  },
});
