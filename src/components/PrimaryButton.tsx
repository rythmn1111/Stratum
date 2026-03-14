import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../constants/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, (disabled || loading) && styles.disabled]}
      disabled={disabled || loading}
    >
      {loading ? <ActivityIndicator color={theme.colors.background} /> : <Text style={styles.label}>{title}</Text>}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    color: theme.colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
});
