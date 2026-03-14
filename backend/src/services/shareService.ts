import { randomUUID } from 'crypto';
import { randomBytes } from 'crypto';
import { pool } from '../config/db';
import { env } from '../config/env';

export interface UserShareRecord {
  userId: string;
  sessionToken: string;
  deviceFingerprint: string;
  shareB: string;
}

const memoryStore = new Map<string, UserShareRecord>();

export const createUserShare = async (
  deviceFingerprint: string,
  shareB: string,
): Promise<{ userId: string; sessionToken: string }> => {
  const userId = randomUUID();
  const sessionToken = randomBytes(32).toString('hex');

  if (!pool || env.useInMemoryStore) {
    memoryStore.set(userId, {
      userId,
      sessionToken,
      deviceFingerprint,
      shareB,
    });
    return { userId, sessionToken };
  }

  await pool.query(
    `
      INSERT INTO user_shares (user_id, session_token, device_fingerprint, share_b)
      VALUES ($1, $2, $3, $4)
    `,
    [userId, sessionToken, deviceFingerprint, shareB],
  );

  return { userId, sessionToken };
};

export const fetchShareB = async (
  userId: string,
  deviceFingerprint: string,
  sessionToken: string,
): Promise<string | null> => {
  if (!pool || env.useInMemoryStore) {
    const record = memoryStore.get(userId);
    if (!record) {
      return null;
    }

    if (record.deviceFingerprint !== deviceFingerprint || record.sessionToken !== sessionToken) {
      return null;
    }

    return record.shareB;
  }

  const result = await pool.query(
    `
      SELECT share_b
      FROM user_shares
      WHERE user_id = $1
      AND device_fingerprint = $2
      AND session_token = $3
      LIMIT 1
    `,
    [userId, deviceFingerprint, sessionToken],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0].share_b as string;
};

export const updateShareB = async (
  userId: string,
  deviceFingerprint: string,
  sessionToken: string,
  nextShareB: string,
): Promise<boolean> => {
  if (!pool || env.useInMemoryStore) {
    const record = memoryStore.get(userId);
    if (!record) {
      return false;
    }

    if (record.deviceFingerprint !== deviceFingerprint || record.sessionToken !== sessionToken) {
      return false;
    }

    memoryStore.set(userId, {
      ...record,
      shareB: nextShareB,
    });

    return true;
  }

  const result = await pool.query(
    `
      UPDATE user_shares
      SET share_b = $4,
          updated_at = NOW()
      WHERE user_id = $1
      AND device_fingerprint = $2
      AND session_token = $3
    `,
    [userId, deviceFingerprint, sessionToken, nextShareB],
  );

  return (result.rowCount ?? 0) > 0;
};
