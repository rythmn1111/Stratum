import dotenv from 'dotenv';

dotenv.config();

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};

export const env = {
  port: Number.parseInt(process.env.PORT ?? '4000', 10),
  databaseUrl: required(process.env.DATABASE_URL, 'DATABASE_URL'),
  supabaseUrl: required(process.env.SUPABASE_URL, 'SUPABASE_URL'),
  supabaseServiceRoleKey: required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
};
