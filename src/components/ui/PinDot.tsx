import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Colors, Radius, Spacing } from '../../theme/colors';

type PinDotProps = {
  filled: number;
  total?: number;
};

export const PinDot: React.FC<PinDotProps> = ({ filled, total = 6 }) => {
  const animations = useRef(Array.from({ length: total }, () => new Animated.Value(0.8))).current;

  useEffect(() => {
    animations.forEach((value, index) => {
      Animated.spring(value, {
        toValue: index < filled ? 1 : 0.8,
        useNativeDriver: true,
        friction: 5,
        tension: 140,
      }).start();
    });
  }, [animations, filled]);

  const dots = useMemo(() => Array.from({ length: total }, (_, index) => index), [total]);

  return (
    <View style={styles.row}>
      {dots.map((index) => {
        const active = index < filled;
        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              active ? styles.dotFilled : styles.dotEmpty,
              { transform: [{ scale: animations[index] }] },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dot: {
    borderRadius: Radius.full,
    height: 12,
    width: 12,
  },
  dotFilled: {
    backgroundColor: Colors.brandOrange,
    shadowColor: Colors.brandOrange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  dotEmpty: {
    backgroundColor: Colors.borderMid,
  },
});
