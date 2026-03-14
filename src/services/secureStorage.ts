import * as Keychain from 'react-native-keychain';
import { WalletAddresses } from '../types';

const SERVICE = 'nfc-split-wallet';
const SESSION_ACCOUNT = 'session-token';
const DEVICE_ACCOUNT = 'device-fingerprint';
const PROFILE_ACCOUNT = 'wallet-profile';
const POS_TOKEN_ACCOUNT = 'pos-token';
const LOCAL_SHARE_ACCOUNT = 'local-share-a';

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
      Keychain.resetGenericPassword({ service: `${SERVICE}-pos-token` }),
      Keychain.resetGenericPassword({ service: `${SERVICE}-local-share` }),
    ]);
  },

  async saveLocalShareA(shareABase64: string): Promise<void> {
    await Keychain.setGenericPassword(LOCAL_SHARE_ACCOUNT, shareABase64, {
      service: `${SERVICE}-local-share`,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async getLocalShareA(): Promise<string | null> {
    const creds = await Keychain.getGenericPassword({
      service: `${SERVICE}-local-share`,
    });
    if (!creds) {
      return null;
    }
    return creds.password;
  },

  async savePosToken(token: string): Promise<void> {
    await Keychain.setGenericPassword(POS_TOKEN_ACCOUNT, token, {
      service: `${SERVICE}-pos-token`,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async getPosToken(): Promise<string | null> {
    const creds = await Keychain.getGenericPassword({
      service: `${SERVICE}-pos-token`,
    });
    if (!creds) {
      return null;
    }
    return creds.password;
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
