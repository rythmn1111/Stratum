import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '../theme/colors';
import { Typography } from '../theme/typography';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle }) => (
  <View style={styles.container}>
    <Text allowFontScaling={false} style={styles.title}>{title}</Text>
    {subtitle ? <Text allowFontScaling={false} style={styles.subtitle}>{subtitle}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
    paddingTop: Spacing.md,
  },
  title: {
    ...Typography.displayTitle,
    color: Colors.offWhite,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: 6,
  },
});
