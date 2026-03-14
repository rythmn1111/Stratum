import { randomUUID } from 'crypto';
import { randomBytes } from 'crypto';
import { pool } from '../config/db';

export interface UserShareRecord {
  userId: string;
  sessionToken: string;
  deviceFingerprint: string;
  shareB: string;
}

export const createUserShare = async (
  deviceFingerprint: string,
  shareB: string,
): Promise<{ userId: string; sessionToken: string }> => {
  const userId = randomUUID();
  const sessionToken = randomBytes(32).toString('hex');

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

  return result.rowCount > 0;
};
