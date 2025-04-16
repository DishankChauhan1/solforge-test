import { z } from 'zod';
import * as dotenv from 'dotenv';

/**
 * Centralized configuration system with validation
 * 
 * This module:
 * 1. Loads environment variables
 * 2. Defines validation schemas for each config section
 * 3. Creates a typed config object
 * 4. Validates the config against the schemas
 * 5. Provides helper functions to access config values
 */

// Load environment variables
dotenv.config();

const ENV = process.env.NODE_ENV || 'development';
const isProd = ENV === 'production';

// Add stricter validation for production
const nonEmptyString = (fieldName: string) =>
  z.string().refine(val => !isProd || val.length > 0, {
    message: `${fieldName} is required in production environment`
  });

/**
 * Solana blockchain configuration schema
 */
const SolanaConfigSchema = z.object({
  rpcUrl: z.string().url(),
  programId: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
  cluster: z.enum(['mainnet-beta', 'testnet', 'devnet']),
  adminPrivateKey: nonEmptyString('Solana admin private key'),
  maxTransactionFee: z.string().regex(/^\d*\.?\d*$/),
});

/**
 * GitHub integration configuration schema
 */
const GitHubConfigSchema = z.object({
  webhookSecret: nonEmptyString('GitHub webhook secret').refine(val => val.length >= 32, {
    message: 'GitHub webhook secret must be at least 32 characters long'
  }),
  appId: nonEmptyString('GitHub app ID'),
  privateKey: nonEmptyString('GitHub private key'),
  clientId: nonEmptyString('GitHub client ID'),
  clientSecret: nonEmptyString('GitHub client secret'),
  installationId: nonEmptyString('GitHub installation ID'),
});

const FirebaseConfigSchema = z.object({
  projectId: z.string(),
  storageBucket: z.string(),
  databaseURL: z.string().optional(),
});

const BountyConfigSchema = z.object({
  minAmount: z.number().positive(),
  maxAmount: z.number().positive(),
  defaultFeePercentage: z.number().min(0).max(100),
  defaultDeadlineDays: z.number().positive(),
  allowedTokens: z.array(z.string()),
});

const LoggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug', 'verbose']),
  verbose: z.boolean(),
  maxPayloadSize: z.number().positive(),
});

const RateLimitConfigSchema = z.object({
  windowMs: z.number().positive(),
  maxRequests: z.number().positive(),
});

const ConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  solana: SolanaConfigSchema,
  github: GitHubConfigSchema,
  firebase: FirebaseConfigSchema,
  bounty: BountyConfigSchema,
  logging: LoggingConfigSchema,
  rateLimit: RateLimitConfigSchema,
});

// Type inference from schema
type Config = z.infer<typeof ConfigSchema>;

// Configuration values
const config: Config = {
  environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    programId: process.env.PROGRAM_ID || 'dGBsodouKiYTUyFudwbHdfXJaHWbUEyXhyw7jj4BBeY',
    cluster: (process.env.SOLANA_CLUSTER as 'mainnet-beta' | 'testnet' | 'devnet') || 'devnet',
    adminPrivateKey: process.env.ADMIN_PRIVATE_KEY || '',
    maxTransactionFee: process.env.MAX_TRANSACTION_FEE || '0.001',
  },
  
  github: {
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
    appId: process.env.GITHUB_APP_ID || '',
    privateKey: process.env.GITHUB_PRIVATE_KEY || '',
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    installationId: process.env.GITHUB_INSTALLATION_ID || '',
  },
  
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  },
  
  bounty: {
    minAmount: Number(process.env.MIN_BOUNTY_AMOUNT) || 0.1,
    maxAmount: Number(process.env.MAX_BOUNTY_AMOUNT) || 1000,
    defaultFeePercentage: Number(process.env.DEFAULT_FEE_PERCENTAGE) || 2,
    defaultDeadlineDays: Number(process.env.DEFAULT_DEADLINE_DAYS) || 30,
    allowedTokens: process.env.ALLOWED_TOKENS?.split(',') || ['SOL'],
  },
  
  logging: {
    level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug' | 'verbose') || 'info',
    verbose: process.env.VERBOSE_LOGGING === 'true',
    maxPayloadSize: Number(process.env.MAX_PAYLOAD_SIZE) || 1024,
  },
  
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
};

// Validate configuration
try {
  ConfigSchema.parse(config);
} catch (error: unknown) {
  if (error instanceof z.ZodError) {
    console.error('Configuration validation failed:');
    error.errors.forEach((err: z.ZodIssue) => {
      console.error(`- ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

// Helper functions to access config values safely
export function getConfig(): Readonly<Config> {
  return Object.freeze({ ...config });
}

export function getSolanaConfig(): Readonly<Config['solana']> {
  return Object.freeze({ ...config.solana });
}

export function getGitHubConfig(): Readonly<Config['github']> {
  return Object.freeze({ ...config.github });
}

export function getFirebaseConfig(): Readonly<Config['firebase']> {
  return Object.freeze({ ...config.firebase });
}

export function getBountyConfig(): Readonly<Config['bounty']> {
  return Object.freeze({ ...config.bounty });
}

export function getLoggingConfig(): Readonly<Config['logging']> {
  return Object.freeze({ ...config.logging });
}

export function getRateLimitConfig(): Readonly<Config['rateLimit']> {
  return Object.freeze({ ...config.rateLimit });
}

// Export individual config sections and full config
export default Object.freeze(config); 