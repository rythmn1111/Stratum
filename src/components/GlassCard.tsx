import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GradientCard } from './ui/GradientCard';

export const GlassCard: React.FC<React.PropsWithChildren<{ style?: StyleProp<ViewStyle> }>> = ({ children, style }) => {
  return <GradientCard style={style}>{children}</GradientCard>;
};
