import NfcManager, { Ndef, NfcTech, NfcError, NfcEvents } from 'react-native-nfc-manager';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';

const WALLET_RECORD_TYPE = 'sw:1';
const LEGACY_WALLET_RECORD_TYPE = 'application/vnd.nfc-split-wallet.share';
const DEMO_EXTERNAL_RECORD_TYPE = 'nfcwallet.app:keydata';
const WALLET_RECORD_TNF = Ndef.TNF_EXTERNAL_TYPE;
let initialized = false;

const buildPayload = (bytes: Uint8Array): number[] => {
  return Array.from(bytes);
};

const decodeNdefTextPayload = (payload: number[] | Uint8Array): string => {
  const bytes = Uint8Array.from(payload);
  if (bytes.length === 0) {
    return '';
  }

  const status = bytes[0] ?? 0;
  const langLen = status & 0x3f;
  const isUtf16 = (status & 0x80) !== 0;

  const textBytes = bytes.subarray(1 + langLen);
  const encoding = isUtf16 ? 'utf16le' : 'utf8';
  return Buffer.from(textBytes).toString(encoding);
};

const parseLegacyJsonShare = (rawText: string): Uint8Array | null => {
  try {
    const parsed = JSON.parse(rawText) as { nfcHalf?: string };
    if (!parsed?.nfcHalf) {
      return null;
    }

    const normalized = parsed.nfcHalf.trim();
    if (!normalized) {
      return null;
    }

    const isHex = /^[0-9a-fA-F]+$/.test(normalized) && normalized.length % 2 === 0;
    if (isHex) {
      return Uint8Array.from(Buffer.from(normalized, 'hex'));
    }

    return Uint8Array.from(Buffer.from(normalized, 'base64'));
  } catch (_err) {
    return null;
  }
};

const ensureInit = async (): Promise<void> => {
  if (initialized) {
    return;
  }

  const supported = await NfcManager.isSupported();
  if (!supported) {
    throw new Error('NFC is not supported on this device.');
  }

  const enabled = await NfcManager.isEnabled();
  if (!enabled) {
    throw new Error('NFC is turned off. Please enable NFC in system settings.');
  }

  await NfcManager.start();
  initialized = true;
};

export const nfcService = {
  async initialize(): Promise<void> {
    await ensureInit();
  },

  async writeShareToCard(shareA: Uint8Array, tagPassword?: string): Promise<void> {
    await ensureInit();

    const records = [
      Ndef.record(WALLET_RECORD_TNF, WALLET_RECORD_TYPE, [], buildPayload(shareA)),
    ];

    const bytes = Ndef.encodeMessage(records);
    if (!bytes) {
      throw new Error('Unable to encode NFC payload.');
    }

    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();

      const maxSize = (tag as any)?.maxSize;
      const isWritable = (tag as any)?.isWritable;

      if (isWritable === false) {
        throw new Error('Card is read-only. Use a writable NDEF NFC card.');
      }

      if (typeof maxSize === 'number' && bytes.length > maxSize) {
        throw new Error(`Card capacity too small. Need ${bytes.length} bytes, but card supports ${maxSize} bytes.`);
      }

      // Some enterprise tags allow additional password operations through vendor-specific commands.
      if (tagPassword) {
        // Placeholder: implement card-vendor specific APDU auth flow here when tag model is finalized.
      }

      await NfcManager.ndefHandler.writeNdefMessage(bytes);
    } catch (err) {
      // Demo parity: if the tag is not yet NDEF-formatted on Android, format and write once.
      if (Platform.OS === 'android') {
        try {
          await NfcManager.cancelTechnologyRequest();
          await NfcManager.requestTechnology(NfcTech.NdefFormatable);
          await NfcManager.ndefFormatableHandlerAndroid.formatNdef(bytes);
          return;
        } catch (_formatErr) {
          // Keep original error handling below to preserve user-friendly messaging.
        }
      }

      if (err instanceof NfcError.UserCancel) {
        throw new Error('NFC write canceled by user.');
      }
      if (err instanceof NfcError.Timeout) {
        throw new Error('NFC write timed out. Hold the card near the phone and retry.');
      }
      if (err instanceof Error) {
        if (err.message.includes('IOException')) {
          throw new Error(
            'NFC write failed (I/O). Keep the phone still on the card and use an NDEF-writable card with enough capacity (recommended NTAG215/216).',
          );
        }
        throw new Error(`Unable to write to NFC card: ${err.message}`);
      }
      throw new Error('Unable to write to NFC card. Please try again.');
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  },

  async readShareFromCard(): Promise<Uint8Array> {
    await ensureInit();

    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();

      const ndefMessage = tag?.ndefMessage;
      if (!ndefMessage || ndefMessage.length === 0) {
        throw new Error('No wallet share found on this NFC card.');
      }

      const record = ndefMessage.find((item) => {
        try {
          const decodedType = Ndef.util.bytesToString(item.type);
          return (
            decodedType === WALLET_RECORD_TYPE
            || decodedType === LEGACY_WALLET_RECORD_TYPE
            || decodedType === DEMO_EXTERNAL_RECORD_TYPE
          );
        } catch (_err) {
          return false;
        }
      });

      if (record?.payload) {
        const decodedType = (() => {
          try {
            return Ndef.util.bytesToString(record.type);
          } catch (_err) {
            return '';
          }
        })();

        if (decodedType === WALLET_RECORD_TYPE || decodedType === LEGACY_WALLET_RECORD_TYPE) {
          return Uint8Array.from(record.payload);
        }

        const externalJson = Buffer.from(record.payload).toString('utf8');
        const parsedExternal = parseLegacyJsonShare(externalJson);
        if (parsedExternal) {
          return parsedExternal;
        }
      }

      // Compatibility fallback for demo cards written as NDEF text records.
      for (const item of ndefMessage) {
        const textPayload = decodeNdefTextPayload(item.payload);
        const parsed = parseLegacyJsonShare(textPayload);
        if (parsed) {
          return parsed;
        }
      }

      throw new Error('Wallet share record not found on this NFC card.');
    } catch (err) {
      if (err instanceof NfcError.UserCancel) {
        throw new Error('NFC read canceled by user.');
      }
      if (err instanceof NfcError.Timeout) {
        throw new Error('NFC read timed out. Hold the card near the phone and retry.');
      }
      throw err instanceof Error ? err : new Error('Unable to read NFC card.');
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  },

  async startReaderMode(onDiscovered: () => void): Promise<void> {
    NfcManager.setEventListener(NfcEvents.DiscoverTag, onDiscovered);
    await NfcManager.registerTagEvent();
  },

  async stopReaderMode(): Promise<void> {
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    await NfcManager.unregisterTagEvent().catch(() => undefined);
  },
};
