import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';

export const OnboardingScreen: React.FC = () => {
  const { setupWallet } = useWallet();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSetup = async () => {
    if (password.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters for your wallet password.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords must match to continue.');
      return;
    }

    setLoading(true);
    try {
      await setupWallet(password);
      Alert.alert('Wallet ready', 'Your split-key wallet is now configured.');
    } catch (error) {
      Alert.alert('Setup failed', error instanceof Error ? error.message : 'Unable to setup wallet.');
    } finally {
      setLoading(false);
      setPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NFC Split-Key Wallet</Text>
      <Text style={styles.subtitle}>
        Your wallet is split into two cryptographic shares: one on your NFC card, one on the server.
      </Text>

      <GlassCard>
        <Text style={styles.body}>
          Threat model: a stolen card alone is useless, and a server breach alone is useless. Both are required.
        </Text>
        <Text style={styles.body}>Tap Setup Wallet to generate your seed, split shares, and bind your card.</Text>
      </GlassCard>

      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Create password or PIN"
        placeholderTextColor={theme.colors.textSecondary}
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Confirm password"
        placeholderTextColor={theme.colors.textSecondary}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <PrimaryButton title="Setup Wallet" onPress={onSetup} loading={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  body: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    lineHeight: 20,
  },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.textPrimary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
});
