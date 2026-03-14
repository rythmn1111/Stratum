import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Buffer } from 'buffer';
import { TabIcon } from '../components/TabIcon';
import { GradientCard } from '../components/ui/GradientCard';
import { OrangeButton } from '../components/ui/OrangeButton';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { useWallet } from '../context/WalletContext';
import { secureStorage } from '../services/secureStorage';
import { nfcService } from '../services/nfcService';
import { OnboardingScreen, POSScreen, PayScreen, SettingsScreen, WalletScreen } from '../screens';

export type AppTabParamList = {
  Wallet: undefined;
  Pay: undefined;
  Receive: undefined;
  Settings: undefined;
};

export const rootNavigationRef = createNavigationContainerRef<AppTabParamList>();

const Tab = createBottomTabNavigator<AppTabParamList>();

const walletTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.deepDark,
    card: Colors.deepDark,
    text: Colors.offWhite,
    border: Colors.borderSubtle,
    primary: Colors.brandOrange,
  },
};

const AppLockOverlay: React.FC<{
  visible: boolean;
  onUnlock: () => void;
  onLogout: () => void;
}> = ({ visible, onUnlock, onLogout }) => (
  <Modal animationType="fade" statusBarTranslucent transparent visible={visible}>
    <View style={styles.lockBackdrop}>
      <GradientCard glowColor={Colors.orangeGlow} style={styles.lockCard}>
        <Text allowFontScaling={false} style={styles.lockTitle}>App Locked</Text>
        <Text allowFontScaling={false} style={styles.lockBody}>The wallet locked when the app moved to the background.</Text>
        <OrangeButton label="Unlock App" onPress={onUnlock} size="lg" />
        <View style={styles.lockSpacer} />
        <OrangeButton label="Logout" onPress={onLogout} size="md" variant="outline" />
      </GradientCard>
    </View>
  </Modal>
);

export const AppNavigator: React.FC = () => {
  const { isSetupComplete, hydrateWallet, initializeNfc, logout, userId, posToken } = useWallet();
  const [booting, setBooting] = useState(true);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [appLocked, setAppLocked] = useState(false);
  const [onboardingHold, setOnboardingHold] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        await hydrateWallet();
        await initializeNfc();
      } catch (error) {
        if (mounted) {
          setNfcError(error instanceof Error ? error.message : 'Unable to initialize NFC.');
        }
      } finally {
        if (mounted) {
          setBooting(false);
        }
      }
    };

    run().catch(() => {
      if (mounted) {
        setBooting(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [hydrateWallet, initializeNfc]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (!isSetupComplete) {
        return;
      }

      if (prev === 'active' && (nextState === 'background' || nextState === 'inactive')) {
        setAppLocked(true);
      }
    });

    return () => sub.remove();
  }, [isSetupComplete]);

  const runRelinkFlow = useCallback(async () => {
    try {
      const localShare = await secureStorage.getLocalShareA();
      if (!localShare) {
        Alert.alert('Relink failed', 'No local Share A found. Set up the wallet again to relink a card.');
        return;
      }

      const shareBytes = Uint8Array.from(Buffer.from(localShare, 'base64'));
      await nfcService.writeShareToCard(shareBytes, {
        metadata: {
          userId: userId ?? undefined,
          posToken: posToken ?? undefined,
        },
      });

      Alert.alert('Relink complete', 'Your NFC card has been relinked successfully.');
    } catch (error) {
      Alert.alert('Relink failed', error instanceof Error ? error.message : 'Unable to relink the NFC card.');
    }
  }, [posToken, userId]);

  const runClearFlow = useCallback(() => {
    Alert.alert('Clear local wallet', 'This removes local auth and profile data from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear Now', style: 'destructive', onPress: () => logout().catch(() => undefined) },
    ]);
  }, [logout]);

  const onSettingsTabLongPress = useCallback(() => {
    Alert.alert('Settings Actions', 'Choose a quick action.', [
      { text: 'Relink NFC Card', onPress: () => runRelinkFlow().catch(() => undefined) },
      { text: 'Clear Local Wallet', style: 'destructive', onPress: runClearFlow },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [runClearFlow, runRelinkFlow]);

  const tabs = useMemo(
    () => (
      <Tab.Navigator
        screenOptions={({ route }) => {
          const routeToIcon: Record<keyof AppTabParamList, 'wallet' | 'pay' | 'receive' | 'settings'> = {
            Wallet: 'wallet',
            Pay: 'pay',
            Receive: 'receive',
            Settings: 'settings',
          };

          return {
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: {
              backgroundColor: Colors.deepDark,
              borderTopColor: Colors.borderSubtle,
              height: 72,
              paddingBottom: 10,
              paddingTop: 8,
            },
            tabBarActiveTintColor: Colors.brandOrange,
            tabBarInactiveTintColor: Colors.textMuted,
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon color={color} focused={focused} label={route.name} name={routeToIcon[route.name]} size={size} />
            ),
            tabBarButton:
              route.name === 'Pay'
                ? ({ accessibilityLabel, accessibilityState, children, onLongPress, onPress, testID }) => (
                    <Pressable
                      accessibilityLabel={accessibilityLabel}
                      accessibilityRole="button"
                      accessibilityState={accessibilityState}
                      onLongPress={onLongPress}
                      onPress={onPress}
                      style={styles.payTabButton}
                      testID={testID}
                    >
                      <View style={styles.payFab}>
                        <TabIcon color={Colors.offWhite} name="pay" size={24} />
                        {children}
                      </View>
                    </Pressable>
                  )
                : undefined,
          };
        }}
      >
        <Tab.Screen name="Wallet" component={WalletScreen} />
        <Tab.Screen name="Pay" component={PayScreen} />
        <Tab.Screen name="Receive" component={POSScreen} />
        <Tab.Screen
          listeners={{ tabLongPress: () => onSettingsTabLongPress() }}
          name="Settings"
          component={SettingsScreen}
        />
      </Tab.Navigator>
    ),
    [onSettingsTabLongPress],
  );

  if (booting) {
    return (
      <View style={styles.bootWrap}>
        <Text allowFontScaling={false} style={styles.bootText}>Loading wallet profile...</Text>
      </View>
    );
  }

  if (!isSetupComplete || onboardingHold) {
    return <OnboardingScreen onSetupComplete={() => setOnboardingHold(false)} onSetupStart={() => setOnboardingHold(true)} />;
  }

  return (
    <View style={styles.root}>
      {nfcError ? <Text allowFontScaling={false} style={styles.errorBanner}>{nfcError}</Text> : null}
      <NavigationContainer ref={rootNavigationRef} theme={walletTheme}>
        {tabs}
      </NavigationContainer>
      <AppLockOverlay
        visible={appLocked}
        onLogout={() => {
          setAppLocked(false);
          logout().catch(() => undefined);
        }}
        onUnlock={() => setAppLocked(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    backgroundColor: Colors.deepDark,
    flex: 1,
  },
  bootWrap: {
    alignItems: 'center',
    backgroundColor: Colors.deepDark,
    flex: 1,
    justifyContent: 'center',
  },
  bootText: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  errorBanner: {
    ...Typography.labelSm,
    backgroundColor: Colors.errorDim,
    color: Colors.error,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  lockBackdrop: {
    alignItems: 'center',
    backgroundColor: Colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  lockCard: {
    maxWidth: 340,
    width: '100%',
  },
  lockTitle: {
    ...Typography.displayMd,
    color: Colors.offWhite,
    marginBottom: 8,
  },
  lockBody: {
    ...Typography.body,
    color: Colors.textMuted,
    marginBottom: 18,
  },
  lockSpacer: {
    height: 10,
  },
  payTabButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginTop: -10,
  },
  payFab: {
    alignItems: 'center',
    backgroundColor: Colors.brandOrange,
    borderRadius: 28,
    elevation: 10,
    height: 56,
    justifyContent: 'center',
    shadowColor: Colors.brandOrange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    width: 56,
  },
});
