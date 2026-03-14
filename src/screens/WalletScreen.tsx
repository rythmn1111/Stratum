import React, { useEffect } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionLabel } from '../components/SectionLabel';
import { CONFIG } from '../config';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { truncateAddress } from '../utils/format';

const ASSET_COLORS: Record<string, string> = {
  ETH: '#627EEA',
  SOL: '#9945FF',
  'USDC (ETH)': '#2775CA',
  'USDC (SOL)': '#2775CA',
};

export const WalletScreen: React.FC = () => {
  const { balances, addresses, recentTransactions, refreshBalances, userId, posToken } = useWallet();

  useEffect(() => {
    if (addresses) {
      refreshBalances().catch(() => undefined);
    }
  }, [addresses?.eth, addresses?.sol, refreshBalances]);

  const balanceRows = [
    { label: `ETH (${CONFIG.ethNetworkLabel})`, value: balances.eth },
    { label: `SOL (${CONFIG.solNetworkLabel})`, value: balances.sol },
    { label: `USDC (${CONFIG.ethNetworkLabel})`, value: balances.usdcEth },
    { label: `USDC (${CONFIG.solNetworkLabel})`, value: balances.usdcSol },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Portfolio" />

      {/* Balance hero */}
      <GlassCard>
        <Text style={styles.heroLabel}>{CONFIG.ethNetworkLabel}</Text>
        <Text style={styles.heroValue}>{balances.eth}</Text>
        <Text style={styles.heroUnit}>ETH</Text>
      </GlassCard>

      <GlassCard>
        <Text style={styles.networkTitle}>Networks</Text>
        <Text style={styles.networkText}>Ethereum: {CONFIG.ethNetworkLabel}</Text>
        <Text style={styles.networkText}>Solana: {CONFIG.solNetworkLabel}</Text>
      </GlassCard>

      {/* All assets */}
      <SectionLabel label="All Assets" />
      <GlassCard>
        {balanceRows.map((row, i) => (
          <View key={row.label} style={[styles.assetRow, i > 0 && styles.assetRowBorder]}>
            <View style={[styles.assetDot, { backgroundColor: ASSET_COLORS[row.label] ?? theme.colors.accent }]} />
            <Text style={styles.assetLabel}>{row.label}</Text>
            <Text style={styles.assetValue}>{row.value}</Text>
          </View>
        ))}
      </GlassCard>

      {/* User ID + POS Token for POS mode */}
      {(userId || posToken) ? (
        <>
          <SectionLabel label="POS Identity" />
          <GlassCard>
            <Text style={styles.userIdHint}>
              Share both values with a merchant or let them scan your NFC card to authorize payments.
            </Text>
            {userId ? (
              <View style={styles.posRow}>
                <Text style={styles.posRowLabel}>User ID</Text>
                <Text style={styles.posRowValue} selectable numberOfLines={1}>
                  {userId}
                </Text>
              </View>
            ) : null}
            {posToken ? (
              <View style={[styles.posRow, styles.posRowLast]}>
                <Text style={styles.posRowLabel}>POS Token</Text>
                <Text style={styles.posRowValue} selectable numberOfLines={1}>
                  {posToken}
                </Text>
              </View>
            ) : null}
          </GlassCard>
        </>
      ) : null}

      {/* Addresses */}
      <SectionLabel label="Addresses" />
      <GlassCard>
        <View style={styles.addrRow}>
          <Text style={styles.addrChain}>ETH ({CONFIG.ethNetworkLabel})</Text>
          <Text style={styles.addrValue} selectable>
            {truncateAddress(addresses?.eth ?? '—', 10, 6)}
          </Text>
        </View>
        <View style={[styles.addrRow, styles.addrRowBorder]}>
          <Text style={styles.addrChain}>SOL ({CONFIG.solNetworkLabel})</Text>
          <Text style={styles.addrValue} selectable>
            {truncateAddress(addresses?.sol ?? '—', 10, 6)}
          </Text>
        </View>
      </GlassCard>

      {/* Transactions */}
      <SectionLabel label="Recent Transactions" />
      <GlassCard>
        {recentTransactions.length === 0 ? (
          <Text style={styles.emptyTx}>No transactions yet.</Text>
        ) : (
          recentTransactions.map((tx, index) => (
            <View key={tx.id} style={[styles.txRow, index > 0 && styles.txRowBorder]}>
              <View style={styles.txLeft}>
                <Text style={styles.txAsset}>{tx.asset}</Text>
                <Text style={styles.txChain}>{tx.chain === 'ethereum' ? CONFIG.ethNetworkLabel : CONFIG.solNetworkLabel}</Text>
                <Text style={styles.txTo}>{truncateAddress(tx.to)}</Text>
              </View>
              <View style={styles.txRight}>
                <Text style={styles.txAmount}>{tx.amount}</Text>
                <View style={[styles.txBadge, tx.status === 'confirmed' && styles.txBadgeConfirmed]}>
                  <Text style={styles.txBadgeText}>{tx.status}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </GlassCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
    backgroundColor: theme.colors.background,
  },
  userIdHint: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: theme.spacing.sm,
    lineHeight: 17,
  },
  posRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  posRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  posRowLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  posRowValue: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.3,
  },
  heroLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  heroValue: {
    color: theme.colors.textPrimary,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 50,
  },
  heroUnit: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  networkTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  networkText: {
    color: theme.colors.textSecondary,
    marginBottom: 4,
    fontSize: 13,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  assetRowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  assetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  assetLabel: {
    color: theme.colors.textPrimary,
    flex: 1,
    fontSize: 14,
  },
  assetValue: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  addrRowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  addrChain: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    width: 140,
    letterSpacing: 0.5,
  },
  addrValue: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyTx: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: theme.spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  txRowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  txLeft: { flex: 1 },
  txAsset: { color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 },
  txChain: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 1 },
  txTo: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 },
  txBadge: {
    marginTop: 4,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: theme.colors.surfaceAlt,
  },
  txBadgeConfirmed: { backgroundColor: 'rgba(55,214,122,0.15)' },
  txBadgeText: {
    color: theme.colors.success,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
