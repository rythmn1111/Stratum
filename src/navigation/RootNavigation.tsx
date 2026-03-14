import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { WalletScreen } from '../screens/WalletScreen';
import { PayScreen } from '../screens/PayScreen';
import { ReceiveScreen } from '../screens/ReceiveScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { theme } from '../constants/theme';

export type RootTabParamList = {
  Wallet: undefined;
  Pay: undefined;
  Receive: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const walletTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.textPrimary,
    border: theme.colors.border,
    primary: theme.colors.accent,
  },
};

export const RootNavigation: React.FC = () => {
  return (
    <NavigationContainer theme={walletTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
          },
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.colors.textSecondary,
        }}
      >
        <Tab.Screen name="Wallet" component={WalletScreen} />
        <Tab.Screen name="Pay" component={PayScreen} />
        <Tab.Screen name="Receive" component={ReceiveScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
