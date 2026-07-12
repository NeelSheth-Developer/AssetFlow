import 'dotenv/config';

const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET'] as const;

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const config = {
  appName: process.env.APP_NAME ?? 'AssetFlow',
  port: Number(process.env.PORT ?? 3000),
  nodeEnv,
  isProd: nodeEnv === 'production',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL!,
  accessSecret: process.env.JWT_ACCESS_SECRET!,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  mail: {
    user: process.env.MAIL_USER ?? process.env.GMAIL_USER,
    pass: (process.env.MAIL_PASS ?? process.env.GMAIL_APP_PASSWORD)?.replace(/\s+/g, ''),
  },
} as const;
