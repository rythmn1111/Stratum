import React from 'react';
import { StatusBar } from 'react-native';
import { WalletProvider } from './context/WalletContext';
import { AppNavigator } from './navigation/AppNavigator';

export const AppRoot: React.FC = () => {
  return (
    <WalletProvider>
      <StatusBar barStyle="light-content" />
      <AppNavigator />
    </WalletProvider>
  );
};
