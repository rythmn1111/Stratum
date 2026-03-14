import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { Typography } from '../../theme/typography';

type StepIndicatorProps = {
  steps: string[];
  currentStep: number;
};

export const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, currentStep }) => {
  return (
    <View style={styles.row}>
      {steps.map((step, index) => {
        const completed = index < currentStep;
        const active = index === currentStep;

        return (
          <React.Fragment key={step}>
            <View style={styles.stepBlock}>
              <View style={[styles.circle, completed || active ? styles.circleActive : styles.circleInactive]}>
                {completed ? (
                  <Feather color={Colors.offWhite} name="check" size={14} />
                ) : (
                  <Text allowFontScaling={false} style={[styles.number, (completed || active) && styles.numberActive]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
                {step}
              </Text>
            </View>
            {index < steps.length - 1 ? (
              <View style={styles.lineTrack}>
                <View style={[styles.lineFill, index < currentStep && styles.lineFillActive]} />
              </View>
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  stepBlock: {
    alignItems: 'center',
    maxWidth: 90,
  },
  circle: {
    alignItems: 'center',
    borderRadius: Radius.full,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  circleActive: {
    backgroundColor: Colors.brandOrange,
  },
  circleInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.borderMid,
    borderWidth: 1,
  },
  number: {
    ...Typography.labelSm,
    color: Colors.textMuted,
  },
  numberActive: {
    color: Colors.offWhite,
  },
  label: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  labelActive: {
    color: Colors.offWhite,
  },
  lineTrack: {
    backgroundColor: Colors.borderMid,
    flex: 1,
    height: 2,
    marginHorizontal: Spacing.sm,
  },
  lineFill: {
    backgroundColor: Colors.transparent,
    height: 2,
    width: '100%',
  },
  lineFillActive: {
    backgroundColor: Colors.brandOrange,
  },
});
