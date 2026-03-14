import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

export type TabIconName = 'wallet' | 'pay' | 'receive' | 'settings';

interface TabIconProps {
  name: TabIconName;
  color: string;
  size?: number;
  focused?: boolean;
  label?: string;
}

const icons: Record<TabIconName, string> = {
  wallet: 'credit-card',
  pay: 'arrow-up-right',
  receive: 'arrow-down-left',
  settings: 'settings',
};

export const TabIcon: React.FC<TabIconProps> = ({ name, color, size = 22, focused = false, label }) => (
  <View style={styles.wrap}>
    {focused ? <View style={styles.dot} /> : <View style={styles.dotSpacer} />}
    <Feather color={color} name={icons[name]} size={size} />
    {label ? (
      <Text allowFontScaling={false} style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>
        {label}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    backgroundColor: Colors.brandOrange,
    borderRadius: 4,
    height: 6,
    marginBottom: 4,
    width: 6,
  },
  dotSpacer: {
    height: 10,
  },
  label: {
    marginTop: 4,
  },
  labelActive: {
    ...Typography.tabActive,
    color: Colors.brandOrange,
  },
  labelInactive: {
    ...Typography.tabInactive,
    color: Colors.textMuted,
  },
});
