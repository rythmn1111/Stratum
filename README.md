# NFC Split-Key Wallet + Mobile POS

React Native mobile wallet that splits wallet secret into two parts:

- Share A on NFC card
- Share B on backend

Both shares are required to decrypt and sign transactions.

## Current Network Targets

- Ethereum: Sepolia
- Solana: Devnet

Configured in src/config.ts.

## What Is Working

### Mobile app

- Onboarding wizard with 3 steps (Choose, Seed Phrase, Password)
- Create wallet and import wallet flow
- Seed phrase reveal/hide
- Seed phrase copy button (clipboard)
- Password-protected setup
- NFC write/read for card share
- Pay flow (ETH, SOL, USDC on Ethereum)
- Receive/POS screen with QR and POS mode
- POS NFC flow auto-resolves payer userId from card metadata on newly issued cards
- Wallet screen with network-labeled balances and addresses
- Bottom-tab app navigation with custom icons
- Settings screen NFC diagnostics (support/enabled/init checks + probe card read)

### Security flow

- BIP39 mnemonic generation/validation
- HD derivation for Ethereum and Solana
- AES-256-GCM encryption
- PBKDF2 SHA-512 (310000 iterations)
- 2-of-2 Shamir split
- Sensitive data wiping in memory after use
- Startup wallet profile hydration from secure storage (session-safe resume)
- Input validation for chain-specific recipient formats and positive amounts
- Retry/backoff for transient backend share-fetch failures

### Backend

- Express API routes for register/fetch/update share
- Health endpoint
- PostgreSQL mode supported
- In-memory fallback mode supported (for demos when DATABASE_URL is not set)

### Smart contracts

- Separate Hardhat workspace in contracts/
- See contracts/README.md

## High-Level Architecture

1. User creates/imports mnemonic on mobile.
2. App encrypts mnemonic payload with password.
3. Encrypted blob is split into Share A and Share B.
4. Share A is written to NFC card.
5. Share B is stored on backend with device fingerprint and session token.
6. To sign a transaction, app reads Share A + fetches Share B + reconstructs + decrypts + signs.

## Repository Structure

```text
ethmumbai/
  src/                 # React Native app code
  backend/             # Express backend
  contracts/           # Hardhat smart contracts workspace
```

## Prerequisites

- Node.js 20+
- npm 10+
- React Native CLI toolchain
- Android Studio (for Android)
- Xcode + CocoaPods (for iOS)
- NFC-enabled Android/iOS device for NFC flows

## Quick Start

### 1) Install app dependencies

```bash
npm install
```

### 2) Install backend dependencies

```bash
npm --prefix backend install
```

### 3) Configure API URL for physical device

If testing on a real phone, set src/config.ts apiBaseUrl to your laptop LAN IP:

```ts
apiBaseUrl: 'http://YOUR_LAN_IP:4000'
```

Do not use localhost on a physical phone.

### 4) Start backend

```bash
npm run backend:dev
```

Verify:

```bash
curl http://127.0.0.1:4000/health
```

Expected:

```json
{"ok":true}
```

### 5) Start Metro

```bash
npm start -- --reset-cache
```

### 6) Run app

Android:

```bash
npm run android
```

iOS:

```bash
cd ios && pod install
npm run ios
```

## Backend Modes

### Demo mode (no DB)

If DATABASE_URL is missing, backend automatically runs with in-memory store.

- Good for demos
- Data resets when server restarts

### PostgreSQL mode

Create backend/.env (from backend/.env.example) and set DATABASE_URL.

Optional Supabase vars can also be set:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

For persistent DB schema:

```bash
psql "$DATABASE_URL" -f backend/sql/schema.sql
```

## API Endpoints

### POST /api/user/register

Request:

```json
{
  "deviceFingerprint": "string",
  "shareB": "base64-string"
}
```

Response:

```json
{
  "userId": "uuid",
  "sessionToken": "string"
}
```

### POST /api/share/fetch

Request:

```json
{
  "userId": "uuid",
  "deviceFingerprint": "string",
  "sessionToken": "string"
}
```

Response:

```json
{
  "shareB": "base64-string"
}
```

### POST /api/share/update

Request:

```json
{
  "userId": "uuid",
  "deviceFingerprint": "string",
  "sessionToken": "string",
  "nextShareB": "base64-string"
}
```

Response:

```json
{
  "success": true
}
```

## NFC Notes

- Use writable NDEF cards.
- Small cards can fail with capacity limits.
- App now uses compact payload + compact record type to reduce size.
- Recommended tags: NTAG215 or NTAG216 for reliable capacity headroom.
- Android write supports NDEF-formatable fallback for unformatted tags.
- New cards also include a metadata record with payer userId for POS auto-resolution.
- Legacy cards without metadata still work, but POS may require manual payer userId entry.

## NFC QA Checklist

Use this checklist before release:

1. Confirm app startup NFC diagnostics show supported = yes and enabled = yes.
2. Run setup on a fresh tag and verify write succeeds first try.
3. Probe the newly written card in Settings and verify share bytes > 0 and payer userId is present.
4. Verify POS mode auto-fills payer identity after scanning a new card.
5. Verify legacy card scan still works and manual payer userId fallback is available.
6. Verify Android unformatted tag path writes successfully using formatable fallback.
7. Verify wrong password path returns generic authentication error without leak details.
8. Verify network outage during share fetch shows clear error and retry behavior.
9. Verify pay flow for ETH, SOL, USDC on Ethereum, and USDC on Solana on real devices.
10. Verify key material is cleared after signing by following debug logs and memory wipe hooks.

## Chain Configuration Details

From src/config.ts:

- ethRpcUrl: Sepolia public RPC
- solRpcUrl: Solana Devnet RPC
- usdcEthContract: Sepolia USDC contract
- usdcSolMint: Devnet USDC mint

Wallet screen labels balances by chain/network so users can see Ethereum vs Solana context.

## Known Limitations

- Legacy cards that were written before metadata support may still require manual payer userId entry in POS mode.
- Recovery and key rotation flows are placeholder-level.
- Demo backend in-memory mode is not persistent.
- Public RPC endpoints may rate-limit under heavy usage.

## Troubleshooting

### Cannot reach backend API from phone

- Ensure backend is running on port 4000
- Ensure phone and laptop are on same Wi-Fi
- Use LAN IP in src/config.ts, not localhost
- Check macOS firewall allows incoming connections

### NFC write capacity too small

- Try a larger NDEF tag (NTAG215/216)
- Ensure card is writable and not locked read-only

### TypeScript checks

App:

```bash
npx tsc --noEmit
```

Backend:

```bash
cd backend && npx tsc --noEmit
```

## Scripts

Root package.json:

- npm start
- npm run android
- npm run ios
- npm run typecheck
- npm run backend:dev

Backend package.json:

- npm run dev
- npm run build
- npm run start
