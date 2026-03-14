import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Colors, Spacing } from '../theme/colors';
import { Typography } from '../theme/typography';

export const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <Text allowFontScaling={false} style={styles.label}>{label.toUpperCase()}</Text>
);

const styles = StyleSheet.create({
  label: {
    ...Typography.overline,
    color: Colors.textMuted,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
});
