import React, { PropsWithChildren } from 'react';
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius, Shadows, Spacing } from '../../theme/colors';

const gradientStart = { x: 0, y: 0 };
const gradientEnd = { x: 1, y: 1 };

type GradientCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  glowColor?: string;
}>;

const resolveGlowStyle = (glowColor?: string): ViewStyle => {
  if (!glowColor || glowColor === Colors.transparent) {
    return styles.noGlow;
  }

  if (glowColor === Colors.brandOrange || glowColor === Colors.orangeGlow) {
    return styles.orangeGlow;
  }

  if (glowColor === Colors.success) {
    return styles.successGlow;
  }

  if (glowColor === Colors.error) {
    return styles.errorGlow;
  }

  if (glowColor === Colors.warning) {
    return styles.warningGlow;
  }

  return styles.orangeGlow;
};

export const GradientCard: React.FC<GradientCardProps> = ({
  children,
  style,
  glowColor = Colors.transparent,
}) => {
  return (
    <View style={[styles.shell, resolveGlowStyle(glowColor), style]}>
      <LinearGradient
        colors={[Colors.surface, Colors.surfaceLow]}
        start={gradientStart}
        end={gradientEnd}
        style={styles.card}
      >
        {children}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
  },
  noGlow: {
    ...Shadows.card,
  },
  orangeGlow: {
    ...Shadows.card,
    shadowColor: Colors.brandOrange,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  successGlow: {
    ...Shadows.card,
    shadowColor: Colors.success,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 11,
  },
  errorGlow: {
    ...Shadows.card,
    shadowColor: Colors.error,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 11,
  },
  warningGlow: {
    ...Shadows.card,
    shadowColor: Colors.warning,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 11,
  },
});