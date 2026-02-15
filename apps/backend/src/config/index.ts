// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Backend Configuration
// ─────────────────────────────────────────────────────────────

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string(),
  DATABASE_POOL_SIZE: z.coerce.number().default(20),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Agent
  AGENT_HMAC_SECRET: z.string().min(32),
  AGENT_ENROLLMENT_SECRET: z.string().optional(),
  AGENT_NONCE_WINDOW_SEC: z.coerce.number().default(300),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Observability
  PROMETHEUS_PORT: z.coerce.number().default(9090),

  // Zabbix
  ZABBIX_API_URL: z.string().optional(),
  ZABBIX_API_TOKEN: z.string().optional(),

  // Agent Update
  AGENT_UPDATE_BASE_URL: z.string().default('https://updates.massvision.io'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof configSchema>;
