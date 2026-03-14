import * as Keychain from 'react-native-keychain';
import { WalletAddresses } from '../types';

const SERVICE = 'nfc-split-wallet';
const SESSION_ACCOUNT = 'session-token';
const DEVICE_ACCOUNT = 'device-fingerprint';
const PROFILE_ACCOUNT = 'wallet-profile';

interface WalletProfile {
  userId: string;
  addresses: WalletAddresses;
}

export const secureStorage = {
  async saveSessionToken(token: string): Promise<void> {
    await Keychain.setGenericPassword(SESSION_ACCOUNT, token, {
      service: `${SERVICE}-session`,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async getSessionToken(): Promise<string | null> {
    const creds = await Keychain.getGenericPassword({
      service: `${SERVICE}-session`,
    });

    if (!creds) {
      return null;
    }

    return creds.password;
  },

  async saveDeviceFingerprint(fingerprint: string): Promise<void> {
    await Keychain.setGenericPassword(DEVICE_ACCOUNT, fingerprint, {
      service: `${SERVICE}-device`,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async getDeviceFingerprint(): Promise<string | null> {
    const creds = await Keychain.getGenericPassword({
      service: `${SERVICE}-device`,
    });

    if (!creds) {
      return null;
    }

    return creds.password;
  },

  async clearAuth(): Promise<void> {
    await Promise.all([
      Keychain.resetGenericPassword({ service: `${SERVICE}-session` }),
      Keychain.resetGenericPassword({ service: `${SERVICE}-device` }),
      Keychain.resetGenericPassword({ service: `${SERVICE}-profile` }),
    ]);
  },

  async saveWalletProfile(profile: WalletProfile): Promise<void> {
    await Keychain.setGenericPassword(PROFILE_ACCOUNT, JSON.stringify(profile), {
      service: `${SERVICE}-profile`,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async getWalletProfile(): Promise<WalletProfile | null> {
    const creds = await Keychain.getGenericPassword({
      service: `${SERVICE}-profile`,
    });

    if (!creds) {
      return null;
    }

    try {
      const parsed = JSON.parse(creds.password) as WalletProfile;
      if (!parsed?.userId || !parsed?.addresses?.eth || !parsed?.addresses?.sol) {
        return null;
      }
      return parsed;
    } catch (_err) {
      return null;
    }
  },
};
