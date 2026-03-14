import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgLinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { OrangeButton } from '../../components/ui/OrangeButton';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { Typography } from '../../theme/typography';

type WelcomeScreenProps = {
  onCreate: () => void;
  onImport: () => void;
};

const FeaturePill: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.featurePill}>
    <Text allowFontScaling={false} style={styles.featurePillText}>
      {label}
    </Text>
  </View>
);

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onCreate, onImport }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <Animated.View style={[styles.flex, { opacity, transform: [{ translateY }] }]}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.illustrationWrap}>
            <Svg height={360} viewBox="0 0 360 360" width="100%">
              <Defs>
                <SvgLinearGradient id="cardGradient" x1="0" x2="1" y1="0" y2="1">
                  <Stop offset="0" stopColor={Colors.surface} />
                  <Stop offset="1" stopColor={Colors.surfaceLow} />
                </SvgLinearGradient>
              </Defs>
              <Circle cx="56" cy="72" fill={Colors.borderSubtle} r="3" />
              <Circle cx="302" cy="58" fill={Colors.orangeDim} r="4" />
              <Circle cx="88" cy="286" fill={Colors.textFaint} r="2.5" />
              <Circle cx="314" cy="282" fill={Colors.borderMid} r="3.5" />
              <Circle cx="270" cy="118" fill={Colors.orangeDim} r="2.5" />
              <Ellipse cx="180" cy="286" fill={Colors.overlay} rx="108" ry="22" />
              <Rect fill="url(#cardGradient)" height="176" rx="28" transform="rotate(-12 180 170)" width="244" x="58" y="84" />
              <Rect fill={Colors.brandOrange} height="14" rx="7" transform="rotate(-12 180 170)" width="160" x="102" y="224" />
              <Path
                d="M164 132c20 0 36 16 36 36m-36-16c11 0 20 9 20 20m-20-4c4 0 8 4 8 8"
                fill="none"
                stroke={Colors.brandOrange}
                strokeLinecap="round"
                strokeWidth="6"
              />
              <Circle cx="88" cy="94" fill={Colors.brandOrange} r="24" />
              <SvgText fill={Colors.offWhite} fontFamily="Inter-Bold" fontSize="16" x="79" y="100">ETH</SvgText>
              <Circle cx="302" cy="148" fill={Colors.success} r="22" />
              <SvgText fill={Colors.deepDark} fontFamily="Inter-Bold" fontSize="16" x="293" y="154">SOL</SvgText>
              <Circle cx="274" cy="266" fill={Colors.offWhite} r="20" />
              <SvgText fill={Colors.deepDark} fontFamily="Inter-Bold" fontSize="14" x="262" y="271">USDC</SvgText>
            </Svg>
          </View>

          <View style={styles.bottomSection}>
            <Text allowFontScaling={false} style={styles.headline}>
              The Smartest{`\n`}Crypto Wallet
            </Text>
            <Text allowFontScaling={false} style={styles.subheadline}>
              Your NFC card + your password = your keys. No seed phrases to lose. No hardware wallet needed.
            </Text>

            <View style={styles.featureRow}>
              <FeaturePill label="🔒 Split-Key Security" />
              <FeaturePill label="⚡ Instant Payments" />
              <FeaturePill label="📱 Any Phone is a POS" />
            </View>

            <View style={styles.actionStack}>
              <OrangeButton label="Create New Wallet" onPress={onCreate} size="lg" />
              <OrangeButton label="I Already Have a Card" onPress={onImport} size="lg" variant="outline" />
            </View>

            <Text allowFontScaling={false} style={styles.footerText}>
              Secured by AES-256 + Shamir&apos;s Secret Sharing
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.deepDark,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: Spacing.xl,
  },
  illustrationWrap: {
    minHeight: 360,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  bottomSection: {
    paddingHorizontal: Spacing.xl,
  },
  headline: {
    ...Typography.heroBalance,
    color: Colors.offWhite,
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
  },
  subheadline: {
    ...Typography.bodyLg,
    color: Colors.textMuted,
    marginTop: Spacing.md,
    maxWidth: 320,
    paddingHorizontal: Spacing.sm,
    textAlign: 'center',
    alignSelf: 'center',
  },
  featureRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  featurePill: {
    backgroundColor: Colors.surface,
    borderColor: Colors.orangeGlow,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  featurePillText: {
    ...Typography.labelSm,
    color: Colors.offWhite,
  },
  actionStack: {
    gap: Spacing.md,
    marginTop: Spacing['2xl'],
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textFaint,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
});
