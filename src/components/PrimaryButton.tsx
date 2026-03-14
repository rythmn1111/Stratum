import React from 'react';
import { OrangeButton } from './ui/OrangeButton';

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
  return <OrangeButton label={title} onPress={onPress} loading={loading} disabled={disabled} size="lg" />;
};
