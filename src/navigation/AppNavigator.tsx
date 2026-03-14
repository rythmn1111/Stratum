import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Buffer } from 'buffer';
import { TabIcon } from '../components/TabIcon';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { secureStorage } from '../services/secureStorage';
import { nfcService } from '../services/nfcService';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PayScreen } from '../screens/PayScreen';
import { POSScreen } from '../screens/POSScreen';
import { ReceiveScreen } from '../screens/ReceiveScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { WalletScreen } from '../screens/WalletScreen';

export type AppTabParamList = {
  Wallet: undefined;
  Pay: undefined;
  POS: undefined;
  Receive: undefined;
  Settings: undefined;
};

export const rootNavigationRef = createNavigationContainerRef<AppTabParamList>();

const Tab = createBottomTabNavigator<AppTabParamList>();

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

const AppLockOverlay: React.FC<{
  visible: boolean;
  onUnlock: () => void;
  onLogout: () => void;
}> = ({ visible, onUnlock, onLogout }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.lockBackdrop}>
        <View style={styles.lockCard}>
          <Text style={styles.lockTitle}>App Locked</Text>
          <Text style={styles.lockBody}>App moved to background. Unlock to continue wallet usage.</Text>
          <Pressable style={styles.unlockBtn} onPress={onUnlock}>
            <Text style={styles.unlockBtnText}>Unlock App</Text>
          </Pressable>
          <Pressable style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>Logout</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export const AppNavigator: React.FC = () => {
  const { isSetupComplete, hydrateWallet, initializeNfc, logout, userId, posToken } = useWallet();

  const [booting, setBooting] = useState(true);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [appLocked, setAppLocked] = useState(false);

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

      const movedToBackground = prev === 'active' && (nextState === 'background' || nextState === 'inactive');
      if (movedToBackground) {
        setAppLocked(true);
      }
    });

    return () => {
      sub.remove();
    };
  }, [isSetupComplete]);

  const runRelinkFlow = useCallback(async () => {
    try {
      const localShare = await secureStorage.getLocalShareA();
      if (!localShare) {
        Alert.alert('Relink failed', 'No local Share A found. Setup wallet again to relink card.');
        return;
      }

      const shareBytes = Uint8Array.from(Buffer.from(localShare, 'base64'));
      await nfcService.writeShareToCard(shareBytes, {
        metadata: {
          userId: userId ?? undefined,
          posToken: posToken ?? undefined,
        },
      });

      Alert.alert('Relink complete', 'NFC card has been relinked successfully.');
    } catch (error) {
      Alert.alert('Relink failed', error instanceof Error ? error.message : 'Unable to relink NFC card.');
    }
  }, [posToken, userId]);

  const runClearFlow = useCallback(() => {
    Alert.alert('Clear local wallet', 'This clears local auth and profile data from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear Now',
        style: 'destructive',
        onPress: () => {
          logout().catch(() => undefined);
        },
      },
    ]);
  }, [logout]);

  const onSettingsTabLongPress = useCallback(() => {
    Alert.alert('Settings Actions', 'Choose a quick action.', [
      { text: 'Relink NFC Card', onPress: () => runRelinkFlow().catch(() => undefined) },
      { text: 'Clear Local Wallet', style: 'destructive', onPress: runClearFlow },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [runClearFlow, runRelinkFlow]);

  const tabScreens = useMemo(() => {
    return (
      <Tab.Navigator
        screenOptions={({ route }) => {
          const routeToIcon: Record<keyof AppTabParamList, 'wallet' | 'pay' | 'receive' | 'settings'> = {
            Wallet: 'wallet',
            Pay: 'pay',
            POS: 'receive',
            Receive: 'receive',
            Settings: 'settings',
          };

          return {
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
              <TabIcon name={routeToIcon[route.name]} color={color} size={size} />
            ),
          };
        }}
      >
        <Tab.Screen name="Wallet" component={WalletScreen} />
        <Tab.Screen name="Pay" component={PayScreen} />
        <Tab.Screen name="POS" component={POSScreen} />
        <Tab.Screen name="Receive" component={ReceiveScreen} />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          listeners={{
            tabLongPress: () => {
              onSettingsTabLongPress();
            },
          }}
        />
      </Tab.Navigator>
    );
  }, [onSettingsTabLongPress]);

  if (booting) {
    return (
      <View style={styles.bootWrap}>
        <Text style={styles.bootText}>Loading wallet profile...</Text>
      </View>
    );
  }

  if (!isSetupComplete) {
    return <OnboardingScreen />;
  }

  return (
    <View style={styles.root}>
      {nfcError ? <Text style={styles.errorBanner}>{nfcError}</Text> : null}
      <NavigationContainer ref={rootNavigationRef} theme={walletTheme}>
        {tabScreens}
      </NavigationContainer>
      <AppLockOverlay
        visible={appLocked}
        onUnlock={() => setAppLocked(false)}
        onLogout={() => {
          setAppLocked(false);
          logout().catch(() => undefined);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  bootWrap: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  errorBanner: {
    color: theme.colors.warning,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    textAlign: 'center',
  },
  lockBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  lockCard: {
    width: '100%',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  lockTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  lockBody: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  unlockBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  unlockBtnText: {
    color: theme.colors.background,
    fontWeight: '800',
    fontSize: 14,
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(244,91,105,0.12)',
  },
  logoutBtnText: {
    color: theme.colors.danger,
    fontWeight: '800',
    fontSize: 14,
  },
});
