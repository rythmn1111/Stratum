import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionLabel } from '../components/SectionLabel';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { nfcService, NfcDiagnosticsResult } from '../services/nfcService';
import { truncateAddress } from '../utils/format';

export const SettingsScreen: React.FC = () => {
  const { addresses, logout } = useWallet();
  const [diagnostics, setDiagnostics] = useState<NfcDiagnosticsResult | null>(null);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [probingCard, setProbingCard] = useState(false);

  const runDiagnostics = async () => {
    setRunningDiagnostics(true);
    try {
      const result = await nfcService.getDiagnostics();
      setDiagnostics(result);
    } catch (error) {
      Alert.alert('NFC diagnostics failed', error instanceof Error ? error.message : 'Unable to run diagnostics.');
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const probeCard = async () => {
    setProbingCard(true);
    try {
      const result = await nfcService.readCardDataFromCard();
      Alert.alert(
        'Card probe success',
        `Share bytes: ${result.shareA.length}\nPayer user ID: ${result.userId ?? 'not found (legacy card)'}`,
      );
    } catch (error) {
      Alert.alert('Card probe failed', error instanceof Error ? error.message : 'Unable to read card.');
    } finally {
      setProbingCard(false);
    }
  };

  const openNfcSettings = async () => {
    try {
      await nfcService.openNfcSettings();
    } catch (error) {
      Alert.alert('NFC settings', error instanceof Error ? error.message : 'Unable to open NFC settings.');
    }
  };

  const onLostCardFlow = () => {
    Alert.alert(
      'Re-setup NFC Card',
      'Card-loss recovery requires identity verification, server-share escrow controls, and full key rotation. This feature is coming soon.',
    );
  };

  const onLogout = () => {
    Alert.alert(
      'Logout',
      'This will clear your local session. Your funds remain safe on-chain.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <ScreenHeader title="Settings" />

      <SectionLabel label="My Addresses" />
      <GlassCard>
        <View style={styles.addrRow}>
          <View style={styles.addrInfo}>
            <Text style={styles.addrChainLabel}>Ethereum</Text>
            <Text style={styles.addrValue} selectable>
              {truncateAddress(addresses?.eth ?? '—', 10, 6)}
            </Text>
          </View>
          <View style={[styles.chainBadge, styles.ethBadge]}>
            <Text style={[styles.chainBadgeText, styles.ethBadgeText]}>ETH</Text>
          </View>
        </View>

        <View style={styles.separator} />

        <View style={styles.addrRow}>
          <View style={styles.addrInfo}>
            <Text style={styles.addrChainLabel}>Solana</Text>
            <Text style={styles.addrValue} selectable>
              {truncateAddress(addresses?.sol ?? '—', 10, 6)}
            </Text>
          </View>
          <View style={[styles.chainBadge, styles.solBadge]}>
            <Text style={[styles.chainBadgeText, styles.solBadgeText]}>SOL</Text>
          </View>
        </View>
      </GlassCard>

      <SectionLabel label="Security" />
      <GlassCard>
        <Pressable style={styles.settingsRow} onPress={onLostCardFlow}>
          <View>
            <Text style={styles.settingsRowTitle}>Re-setup NFC Card</Text>
            <Text style={styles.settingsRowDesc}>Replace or rotate your NFC card share</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </GlassCard>

      <SectionLabel label="NFC Diagnostics" />
      <GlassCard>
        <Text style={styles.settingsRowDesc}>
          Run NFC health checks and probe a card to validate read compatibility.
        </Text>

        {diagnostics ? (
          <View style={styles.diagBlock}>
            <Text style={styles.diagItem}>Platform: {diagnostics.platform}</Text>
            <Text style={styles.diagItem}>Supported: {diagnostics.supported ? 'yes' : 'no'}</Text>
            <Text style={styles.diagItem}>Enabled: {diagnostics.enabled ? 'yes' : 'no'}</Text>
            <Text style={styles.diagItem}>Initialized: {diagnostics.initialized ? 'yes' : 'no'}</Text>
          </View>
        ) : null}

        <PrimaryButton title="Run NFC Diagnostics" onPress={runDiagnostics} loading={runningDiagnostics} />
        <View style={styles.diagSpacer} />
        <PrimaryButton title="Probe NFC Card" onPress={probeCard} loading={probingCard} />
        <Pressable style={styles.inlineAction} onPress={openNfcSettings}>
          <Text style={styles.inlineActionText}>Open NFC System Settings</Text>
        </Pressable>
      </GlassCard>

      <SectionLabel label="Account" />
      <Pressable style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
    backgroundColor: theme.colors.background,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addrInfo: { flex: 1, marginRight: theme.spacing.sm },
  addrChainLabel: { color: theme.colors.textSecondary, fontSize: 12, marginBottom: 2 },
  addrValue: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  chainBadge: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chainBadgeText: { fontWeight: '800', fontSize: 12 },
  ethBadge: { backgroundColor: 'rgba(98,126,234,0.15)' },
  ethBadgeText: { color: '#627EEA' },
  solBadge: { backgroundColor: 'rgba(153,69,255,0.15)' },
  solBadgeText: { color: '#9945FF' },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsRowTitle: { color: theme.colors.textPrimary, fontWeight: '600', fontSize: 15, marginBottom: 2 },
  settingsRowDesc: { color: theme.colors.textSecondary, fontSize: 12 },
  diagBlock: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
  },
  diagItem: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    marginBottom: 2,
  },
  diagSpacer: { height: theme.spacing.sm },
  inlineAction: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
  },
  inlineActionText: {
    color: theme.colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  chevron: { color: theme.colors.textSecondary, fontSize: 24, lineHeight: 28 },
  logoutBtn: {
    backgroundColor: 'rgba(244,91,105,0.12)',
    borderWidth: 1.5,
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: theme.colors.danger, fontWeight: '800', fontSize: 16 },
});
