declare module 'ethereumjs-wallet';
declare module 'shamirs-secret-sharing';
declare module 'ed25519-hd-key';
declare module 'react-native-vector-icons/Feather';
declare module 'text-encoding' {
  export class TextEncoder {
    encode(input?: string): Uint8Array;
  }
  export class TextDecoder {
    decode(input?: ArrayBufferView | ArrayBuffer, options?: { stream?: boolean }): string;
  }
}
