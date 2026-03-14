import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { truncateAddress } from '../../utils/format';

type TransactionRowProps = {
  direction: 'sent' | 'received';
  amount: string;
  asset: string;
  address: string;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
};

const relativeTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < day * 2) return 'Yesterday';

  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const TransactionRow: React.FC<TransactionRowProps> = ({
  direction,
  amount,
  asset,
  address,
  timestamp,
  status,
}) => {
  const pulse = useRef(new Animated.Value(1)).current;
  const isSent = direction === 'sent';
  const amountColor = isSent ? Colors.error : Colors.success;
  const iconColor = isSent ? Colors.brandOrange : Colors.success;
  const iconName = isSent ? 'arrow-up-right' : 'arrow-down-left';

  useEffect(() => {
    if (status !== 'pending') {
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse, status]);

  return (
    <View style={styles.row}>
      <View style={styles.leftBlock}>
        <Animated.View style={[styles.iconShell, { transform: [{ scale: status === 'pending' ? pulse : 1 }] }]}>
          <Feather color={iconColor} name={iconName} size={16} />
        </Animated.View>

        <View style={styles.metaBlock}>
          <Text allowFontScaling={false} style={styles.directionText}>
            {isSent ? 'Sent' : 'Received'} {asset}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={styles.addressText}>
            {truncateAddress(address, 6, 4)}
          </Text>
          <Text allowFontScaling={false} style={styles.timeText}>
            {relativeTime(timestamp)}
          </Text>
        </View>
      </View>

      <View style={styles.rightBlock}>
        <Text allowFontScaling={false} style={[styles.amountText, { color: amountColor }]}>
          {isSent ? '-' : '+'}{amount} {asset}
        </Text>
        <Text allowFontScaling={false} style={styles.statusText}>
          {status}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  leftBlock: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  iconShell: {
    alignItems: 'center',
    backgroundColor: Colors.orangeDim,
    borderRadius: Radius.full,
    height: 36,
    justifyContent: 'center',
    marginRight: Spacing.md,
    width: 36,
  },
  metaBlock: {
    flex: 1,
  },
  directionText: {
    ...Typography.label,
    color: Colors.offWhite,
  },
  addressText: {
    ...Typography.bodySm,
    color: Colors.textFaint,
    marginTop: 2,
  },
  timeText: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
  },
  rightBlock: {
    alignItems: 'flex-end',
    marginLeft: Spacing.md,
  },
  amountText: {
    ...Typography.monoSm,
  },
  statusText: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
    textTransform: 'capitalize',
  },
});
