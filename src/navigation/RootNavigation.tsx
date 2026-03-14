import React from 'react';
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { WalletScreen } from '../screens/WalletScreen';
import { PayScreen } from '../screens/PayScreen';
import { ReceiveScreen } from '../screens/ReceiveScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TabIcon, TabIconName } from '../components/TabIcon';
import { theme } from '../constants/theme';

export type RootTabParamList = {
  Wallet: undefined;
  Pay: undefined;
  Receive: {
    autoOpenPos?: boolean;
    shareABase64?: string;
    payerUserId?: string | null;
    posToken?: string | null;
  } | undefined;
  Settings: undefined;
};

export const rootNavigationRef = createNavigationContainerRef<RootTabParamList>();

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
    <NavigationContainer ref={rootNavigationRef} theme={walletTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            height: 62,
            paddingBottom: 10,
            paddingTop: 8,
          },
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
          tabBarIcon: ({ color, size }) => (
            <TabIcon
              name={route.name.toLowerCase() as TabIconName}
              color={color}
              size={size}
            />
          ),
        })}
      >
        <Tab.Screen name="Wallet" component={WalletScreen} />
        <Tab.Screen name="Pay" component={PayScreen} />
        <Tab.Screen name="Receive" component={ReceiveScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
