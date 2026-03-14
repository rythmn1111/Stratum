import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { Typography } from '../../theme/typography';

type BalancePillProps = {
  asset: string;
  balance: string;
};

export const BalancePill: React.FC<BalancePillProps> = ({ asset, balance }) => {
  return (
    <View style={styles.container}>
      <Feather color={Colors.brandOrange} name="disc" size={10} />
      <Text allowFontScaling={false} style={styles.text}>
        {balance} {asset}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.orangeDim,
    borderColor: Colors.orangeMid,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
  },
  text: {
    ...Typography.monoSm,
    color: Colors.offWhite,
  },
});
