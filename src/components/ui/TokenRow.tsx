import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { GradientCard } from './GradientCard';

type TokenRowProps = {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  change24h: number;
  logoUrl?: string;
};

export const TokenRow: React.FC<TokenRowProps> = ({ symbol, name, balance, usdValue, change24h, logoUrl }) => {
  const positive = change24h > 0;
  const negative = change24h < 0;
  const changeColor = positive ? Colors.success : negative ? Colors.error : Colors.textMuted;
  const changeIcon = positive ? 'arrow-up-right' : negative ? 'arrow-down-right' : 'minus';

  return (
    <GradientCard style={styles.card}>
      <View style={styles.row}>
        <View style={styles.leftBlock}>
          <View style={styles.iconShell}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logo} />
            ) : (
              <Text allowFontScaling={false} style={styles.initialText}>
                {symbol.charAt(0)}
              </Text>
            )}
          </View>
          <View style={styles.metaBlock}>
            <Text allowFontScaling={false} style={styles.nameText}>
              {name}
            </Text>
            <Text allowFontScaling={false} style={styles.symbolText}>
              {symbol}
            </Text>
          </View>
        </View>

        <View style={styles.rightBlock}>
          <Text allowFontScaling={false} style={styles.balanceText}>
            {balance}
          </Text>
          <Text allowFontScaling={false} style={styles.usdText}>
            {usdValue}
          </Text>
          <View style={styles.changeRow}>
            <Feather color={changeColor} name={changeIcon} size={12} />
            <Text allowFontScaling={false} style={[styles.changeText, { color: changeColor }]}>
              {change24h === 0 ? '0.0%' : `${positive ? '+' : ''}${change24h.toFixed(1)}%`}
            </Text>
          </View>
        </View>
      </View>
    </GradientCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leftBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  iconShell: {
    alignItems: 'center',
    backgroundColor: Colors.borderSubtle,
    borderColor: Colors.borderMid,
    borderRadius: Radius.full,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    marginRight: Spacing.md,
    width: 44,
  },
  logo: {
    borderRadius: Radius.full,
    height: 44,
    width: 44,
  },
  initialText: {
    ...Typography.labelLg,
    color: Colors.offWhite,
  },
  metaBlock: {
    flex: 1,
  },
  nameText: {
    ...Typography.semiBold,
    color: Colors.offWhite,
  },
  symbolText: {
    ...Typography.bodySm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rightBlock: {
    alignItems: 'flex-end',
    marginLeft: Spacing.md,
  },
  balanceText: {
    ...Typography.mono,
    color: Colors.offWhite,
  },
  usdText: {
    ...Typography.bodySm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  changeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  changeText: {
    ...Typography.labelSm,
  },
});
