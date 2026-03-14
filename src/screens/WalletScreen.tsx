import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { AddressChip } from '../components/ui/AddressChip';
import { GradientCard } from '../components/ui/GradientCard';
import { TokenRow } from '../components/ui/TokenRow';
import { TransactionRow } from '../components/ui/TransactionRow';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Typography } from '../theme/typography';
import { useWallet } from '../context/WalletContext';

const PRICES = {
  ETH: 2501.61,
  SOL: 52,
  USDC_ETH: 1,
  USDC_SOL: 1,
} as const;

const CHANGE = {
  ETH: 1.4,
  SOL: 3.2,
  USDC_ETH: 0,
  USDC_SOL: 0,
} as const;

const buildChartPath = (values: number[], width: number, height: number) => {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const spread = Math.max(max - min, 1);
  return values
    .map((value, index) => {
      const x = (width / (values.length - 1)) * index;
      const y = height - ((value - min) / spread) * height;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
};

export const WalletScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { balances, addresses, recentTransactions, refreshBalances } = useWallet();
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [activeAction, setActiveAction] = useState<'send' | 'receive' | 'scan' | 'history' | null>('send');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const shimmer = useRef(new Animated.Value(-260)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2400),
        Animated.timing(shimmer, { toValue: 260, duration: 1100, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: -260, duration: 1, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, shimmer, translateY]);

  useEffect(() => {
    if (!addresses) {
      return;
    }

    setLoading(true);
    refreshBalances()
      .catch((refreshError) => setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh balances.'))
      .finally(() => setLoading(false));
  }, [addresses, refreshBalances]);

  const assetData = useMemo(() => {
    const rows = [
      { symbol: 'ETH', name: 'Ethereum', balance: `${balances.eth} ETH`, usdValue: `$${(parseFloat(balances.eth || '0') * PRICES.ETH).toFixed(2)}`, usdNumeric: parseFloat(balances.eth || '0') * PRICES.ETH, change24h: CHANGE.ETH },
      { symbol: 'SOL', name: 'Solana', balance: `${balances.sol} SOL`, usdValue: `$${(parseFloat(balances.sol || '0') * PRICES.SOL).toFixed(2)}`, usdNumeric: parseFloat(balances.sol || '0') * PRICES.SOL, change24h: CHANGE.SOL },
      { symbol: 'USDC', name: 'USDC (ETH)', balance: `${balances.usdcEth} USDC`, usdValue: `$${parseFloat(balances.usdcEth || '0').toFixed(2)}`, usdNumeric: parseFloat(balances.usdcEth || '0'), change24h: CHANGE.USDC_ETH },
      { symbol: 'USDC', name: 'USDC (SOL)', balance: `${balances.usdcSol} USDC`, usdValue: `$${parseFloat(balances.usdcSol || '0').toFixed(2)}`, usdNumeric: parseFloat(balances.usdcSol || '0'), change24h: CHANGE.USDC_SOL },
    ];

    return hideSmallBalances ? rows.filter((row) => row.usdNumeric >= 1) : rows;
  }, [balances.eth, balances.sol, balances.usdcEth, balances.usdcSol, hideSmallBalances]);

  const totalBalance = useMemo(() => assetData.reduce((sum, item) => sum + item.usdNumeric, 0), [assetData]);
  const chartValues = useMemo(() => [4522, 4580, 4621, 4710, 4668, 4775, Math.max(totalBalance, 4821.34)], [totalBalance]);
  const chartPath = useMemo(() => buildChartPath(chartValues, 300, 72), [chartValues]);
  const recent = recentTransactions.slice(0, 4);
  const initials = addresses?.eth ? addresses.eth.slice(2, 4).toUpperCase() : 'MW';

  const onActionPress = (action: 'send' | 'receive' | 'scan' | 'history') => {
    setActiveAction(action);
    if (action === 'send') {
      navigation.navigate('Pay');
    }
    if (action === 'receive' || action === 'scan') {
      navigation.navigate('Receive');
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <Animated.View style={[styles.flex, { opacity, transform: [{ translateY }] }]}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View style={styles.headerSide}>
              <View style={styles.avatar}>
                <Text allowFontScaling={false} style={styles.avatarText}>{initials}</Text>
              </View>
            </View>
            <Text allowFontScaling={false} style={styles.headerTitle}>My Wallet</Text>
            <View style={styles.headerActions}>
              <Pressable style={styles.iconButton}><Feather color={Colors.offWhite} name="bell" size={18} /></Pressable>
              <Pressable onPress={() => navigation.navigate('Settings')} style={styles.iconButton}><Feather color={Colors.offWhite} name="settings" size={18} /></Pressable>
            </View>
          </View>
          <View style={styles.divider} />

          <GradientCard glowColor={Colors.orangeGlow} style={styles.heroCard}>
            <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmer }, { rotate: '16deg' }] }]} />
            <Text allowFontScaling={false} style={styles.heroOverline}>TOTAL BALANCE</Text>
            <Text allowFontScaling={false} style={styles.heroBalance}>${totalBalance.toFixed(2)}</Text>
            <Text allowFontScaling={false} style={styles.heroChange}>+$124.50 (2.6%)</Text>
            <View style={styles.heroFooter}>
              <AddressChip address={addresses?.eth ?? '0x0000000000000000'} chain="ETH" />
              <Pressable onPress={() => refreshBalances().catch(() => undefined)} style={styles.refreshButton}><Feather color={Colors.brandOrange} name="rotate-cw" size={16} /></Pressable>
            </View>
          </GradientCard>

          <GradientCard>
            <Svg height={100} viewBox="0 0 320 100" width="100%">
              <Defs>
                <SvgLinearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                  <Stop offset="0" stopColor={Colors.orangeMid} />
                  <Stop offset="1" stopColor={Colors.transparent} />
                </SvgLinearGradient>
              </Defs>
              <Path d={`${chartPath} L 300 72 L 0 72 Z`} fill="url(#chartFill)" opacity={0.8} />
              <Path d={chartPath} fill="none" stroke={Colors.brandOrange} strokeLinecap="round" strokeWidth={3} />
            </Svg>
            <View style={styles.chartLabels}>
              <Text allowFontScaling={false} style={styles.chartLabel}>6h ago</Text>
              <Text allowFontScaling={false} style={styles.chartLabel}>Now</Text>
            </View>
          </GradientCard>

          <View style={styles.actionsRow}>
            {[
              ['send', 'arrow-up-right', 'Send'],
              ['receive', 'arrow-down-left', 'Receive'],
              ['scan', 'maximize', 'Scan'],
              ['history', 'clock', 'History'],
            ].map(([key, icon, label]) => {
              const active = activeAction === key;
              return (
                <Pressable key={key} onPress={() => onActionPress(key as any)} style={styles.actionItem}>
                  <View style={[styles.actionCircle, active && styles.actionCircleActive]}>
                    <Feather color={active ? Colors.brandOrange : Colors.offWhite} name={icon as any} size={18} />
                  </View>
                  <Text allowFontScaling={false} style={[styles.actionLabel, active && styles.actionLabelActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sectionHeader}>
            <Text allowFontScaling={false} style={styles.sectionTitle}>Your Assets</Text>
            <View style={styles.toggleRow}>
              <Text allowFontScaling={false} style={styles.toggleLabel}>Hide small balances</Text>
              <Switch
                onValueChange={setHideSmallBalances}
                thumbColor={hideSmallBalances ? Colors.brandOrange : Colors.offWhite}
                trackColor={{ false: Colors.borderMid, true: Colors.orangeMid }}
                value={hideSmallBalances}
              />
            </View>
          </View>

          {loading ? <Text allowFontScaling={false} style={styles.helperText}>Refreshing balances...</Text> : null}
          {error ? <Text allowFontScaling={false} style={styles.errorText}>{error}</Text> : null}
          {!addresses ? <Text allowFontScaling={false} style={styles.helperText}>Wallet addresses will appear after setup completes.</Text> : null}
          {assetData.map((item) => (
            <TokenRow key={item.name} balance={item.balance} change24h={item.change24h} name={item.name} symbol={item.symbol} usdValue={item.usdValue} />
          ))}

          <View style={styles.sectionHeader}>
            <Text allowFontScaling={false} style={styles.sectionTitle}>Recent Activity</Text>
            <Text allowFontScaling={false} style={styles.seeAll}>See All</Text>
          </View>
          <GradientCard>
            {recent.length === 0 ? (
              <Text allowFontScaling={false} style={styles.helperText}>No transactions yet. Your latest payments will appear here.</Text>
            ) : (
              recent.map((tx, index) => {
                const received = tx.to === addresses?.eth || tx.to === addresses?.sol;
                return (
                  <View key={tx.id} style={[styles.txWrap, index > 0 && styles.txDivider]}>
                    <TransactionRow address={tx.to} amount={tx.amount} asset={tx.asset} direction={received ? 'received' : 'sent'} status={tx.status} timestamp={tx.timestamp} />
                  </View>
                );
              })
            )}
          </GradientCard>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: Colors.deepDark, flex: 1 },
  flex: { flex: 1 },
  container: { paddingHorizontal: Spacing.lg, paddingBottom: 80, paddingTop: Spacing.sm },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerSide: { width: 64 },
  avatar: { alignItems: 'center', backgroundColor: Colors.brandOrange, borderRadius: Radius.full, height: 32, justifyContent: 'center', width: 32 },
  avatarText: { ...Typography.labelSm, color: Colors.offWhite },
  headerTitle: { ...Typography.heading3, color: Colors.offWhite },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end', width: 64 },
  iconButton: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.full, height: 30, justifyContent: 'center', width: 30 },
  divider: { backgroundColor: Colors.borderFaint, height: 1, marginBottom: Spacing.lg, marginTop: Spacing.md },
  heroCard: { overflow: 'hidden' },
  shimmer: { backgroundColor: Colors.orangeDim, height: 220, left: 0, position: 'absolute', top: -80, width: 80 },
  heroOverline: { ...Typography.overline, color: Colors.textMuted, marginBottom: Spacing.sm },
  heroBalance: { ...Typography.heroBalance, color: Colors.offWhite },
  heroChange: { ...Typography.label, color: Colors.success, marginTop: Spacing.sm },
  heroFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.lg },
  refreshButton: { alignItems: 'center', backgroundColor: Colors.orangeDim, borderColor: Colors.orangeMid, borderRadius: Radius.full, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  chartLabel: { ...Typography.caption, color: Colors.textFaint },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg, marginTop: Spacing.sm },
  actionItem: { alignItems: 'center', width: '24%' },
  actionCircle: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.full, height: 52, justifyContent: 'center', marginBottom: Spacing.sm, width: 52 },
  actionCircleActive: { backgroundColor: Colors.orangeDim },
  actionLabel: { ...Typography.labelSm, color: Colors.textMuted },
  actionLabelActive: { color: Colors.brandOrange },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm, marginTop: Spacing.sm },
  sectionTitle: { ...Typography.heading3, color: Colors.offWhite },
  toggleRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm },
  toggleLabel: { ...Typography.caption, color: Colors.textMuted },
  helperText: { ...Typography.bodySm, color: Colors.textMuted, marginBottom: Spacing.md },
  errorText: { ...Typography.bodySm, color: Colors.error, marginBottom: Spacing.md },
  seeAll: { ...Typography.labelSm, color: Colors.brandOrange },
  txWrap: { paddingVertical: 2 },
  txDivider: { borderTopColor: Colors.borderSubtle, borderTopWidth: 1 },
});
