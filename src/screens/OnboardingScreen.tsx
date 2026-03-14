import React, { useState } from 'react';
import { SetupWalletScreen } from './onboarding/SetupWalletScreen';
import { WelcomeScreen } from './onboarding/WelcomeScreen';

type OnboardingScreenProps = {
  onSetupStart: () => void;
  onSetupComplete: () => void;
};

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onSetupStart, onSetupComplete }) => {
  const [mode, setMode] = useState<'create' | 'import' | null>(null);

  if (!mode) {
    return <WelcomeScreen onCreate={() => setMode('create')} onImport={() => setMode('import')} />;
  }

  return (
    <SetupWalletScreen
      mode={mode}
      onBack={() => setMode(null)}
      onSetupComplete={onSetupComplete}
      onSetupStart={onSetupStart}
    />
  );
};
