import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number.parseInt(process.env.PORT ?? '4000', 10),
  databaseUrl: process.env.DATABASE_URL,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  useInMemoryStore: !process.env.DATABASE_URL,
};
