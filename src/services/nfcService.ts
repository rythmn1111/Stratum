import NfcManager, { Ndef, NfcTech, NfcError, NfcEvents } from 'react-native-nfc-manager';

const WALLET_RECORD_TYPE = 'sw:1';
const LEGACY_WALLET_RECORD_TYPE = 'application/vnd.nfc-split-wallet.share';
const WALLET_RECORD_TNF = Ndef.TNF_EXTERNAL_TYPE;

const buildPayload = (bytes: Uint8Array): number[] => {
  return Array.from(bytes);
};

export const nfcService = {
  async initialize(): Promise<void> {
    try{
          const supported = await NfcManager.isSupported();
    if (!supported) {
      throw new Error('NFC is not supported on this device.');
    }

    const enabled = await NfcManager.isEnabled();
    if (!enabled) {
      throw new Error('NFC is turned off. Please enable NFC in system settings.');
    }

    await NfcManager.start();
    }catch(err){
      console.warn('NFC initialization error (ignored):', err);
    }

  },

  async writeShareToCard(shareA: Uint8Array, tagPassword?: string): Promise<void> {
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();

      const records = [
        Ndef.record(WALLET_RECORD_TNF, WALLET_RECORD_TYPE, [], buildPayload(shareA)),
      ];

      const bytes = Ndef.encodeMessage(records);

      if (!bytes) {
        throw new Error('Unable to encode NFC payload.');
      }

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
          return decodedType === WALLET_RECORD_TYPE || decodedType === LEGACY_WALLET_RECORD_TYPE;
        } catch (_err) {
          return false;
        }
      });

      if (!record?.payload) {
        throw new Error('Wallet share record not found on this NFC card.');
      }

      return Uint8Array.from(record.payload);
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
