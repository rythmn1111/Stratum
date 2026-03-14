import { Pool } from 'pg';
import { env } from './env';

export const pool = env.databaseUrl
  ? new Pool({
      connectionString: env.databaseUrl,
    })
  : null;
