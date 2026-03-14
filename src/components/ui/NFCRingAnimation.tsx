import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { Colors } from '../../theme/colors';

type NFCRingAnimationProps = {
  state: 'idle' | 'scanning' | 'success' | 'error';
};

const SIZE = 200;

export const NFCRingAnimation: React.FC<NFCRingAnimationProps> = ({ state }) => {
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const ringC = useRef(new Animated.Value(0)).current;
  const centerScale = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const ringColor = useMemo(() => {
    if (state === 'success') return Colors.success;
    if (state === 'error') return Colors.error;
    return Colors.brandOrange;
  }, [state]);

  useEffect(() => {
    const createRingLoop = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 1,
            useNativeDriver: true,
          }),
        ]),
      );

    const ringLoops = [createRingLoop(ringA, 0), createRingLoop(ringB, 420), createRingLoop(ringC, 840)];

    if (state === 'idle' || state === 'scanning') {
      ringLoops.forEach((loop) => loop.start());
      return () => ringLoops.forEach((loop) => loop.stop());
    }

    if (state === 'success') {
      Animated.sequence([
        Animated.spring(centerScale, { toValue: 1.14, useNativeDriver: true, friction: 5, tension: 120 }),
        Animated.spring(centerScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120 }),
      ]).start();
    }

    if (state === 'error') {
      Animated.sequence([
        Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 6, duration: 40, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -6, duration: 40, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start();
    }

    return undefined;
  }, [centerScale, ringA, ringB, ringC, shake, state]);

  const buildRingStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.3] }) }],
  });

  const centerIcon = state === 'success' ? 'check' : state === 'error' ? 'x' : 'wifi';

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ring, { borderColor: ringColor }, buildRingStyle(ringA)]} />
      <Animated.View style={[styles.ring, { borderColor: ringColor }, buildRingStyle(ringB)]} />
      <Animated.View style={[styles.ring, { borderColor: ringColor }, buildRingStyle(ringC)]} />
      <Animated.View
        style={[
          styles.center,
          {
            borderColor: `${ringColor}66`,
            transform: [{ scale: centerScale }, { translateX: shake }],
          },
        ]}
      >
        <Feather color={Colors.offWhite} name={centerIcon} size={32} style={state === 'idle' || state === 'scanning' ? styles.nfcIcon : undefined} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    height: SIZE,
    justifyContent: 'center',
    width: SIZE,
  },
  ring: {
    borderRadius: SIZE / 2,
    borderWidth: 2,
    height: SIZE,
    position: 'absolute',
    width: SIZE,
  },
  center: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 44,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  nfcIcon: {
    transform: [{ rotate: '-90deg' }],
  },
});
