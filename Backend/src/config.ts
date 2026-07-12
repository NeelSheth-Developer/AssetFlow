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
    brevoApiKey: process.env.BREVO_API_KEY,
    senderEmail: process.env.BREVO_SENDER_EMAIL ?? process.env.MAIL_USER,
    senderName: process.env.BREVO_SENDER_NAME ?? process.env.APP_NAME ?? 'AssetFlow',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
} as const;
