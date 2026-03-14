import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../constants/theme';

export const GlassCard: React.FC<React.PropsWithChildren> = ({ children }) => {
  return <View style={styles.card}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
});
