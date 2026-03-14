import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';

export const WalletScreen: React.FC = () => {
  const { balances, addresses, recentTransactions } = useWallet();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Wallet</Text>

      <GlassCard>
        <Text style={styles.cardTitle}>Balances</Text>
        <Text style={styles.row}>ETH: {balances.eth}</Text>
        <Text style={styles.row}>SOL: {balances.sol}</Text>
        <Text style={styles.row}>USDC (ETH): {balances.usdcEth}</Text>
        <Text style={styles.row}>USDC (SOL): {balances.usdcSol}</Text>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Addresses</Text>
        <Text style={styles.address} numberOfLines={1}>ETH: {addresses?.eth ?? '-'}</Text>
        <Text style={styles.address} numberOfLines={1}>SOL: {addresses?.sol ?? '-'}</Text>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Recent Transactions</Text>
        {recentTransactions.length === 0 && <Text style={styles.empty}>No transactions yet.</Text>}
        {recentTransactions.map((tx) => (
          <View key={tx.id} style={styles.txRow}>
            <Text style={styles.row}>{tx.asset} {tx.amount}</Text>
            <Text style={styles.meta}>{tx.status}</Text>
          </View>
        ))}
      </GlassCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  row: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  address: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  empty: {
    color: theme.colors.textSecondary,
  },
  txRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  meta: {
    color: theme.colors.accent,
  },
});
