"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRateLimitConfig = exports.getLoggingConfig = exports.getBountyConfig = exports.getFirebaseConfig = exports.getGitHubConfig = exports.getSolanaConfig = exports.getConfig = void 0;
const zod_1 = require("zod");
const dotenv = __importStar(require("dotenv"));
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
const nonEmptyString = (fieldName) => zod_1.z.string().refine(val => !isProd || val.length > 0, {
    message: `${fieldName} is required in production environment`
});
/**
 * Solana blockchain configuration schema
 */
const SolanaConfigSchema = zod_1.z.object({
    rpcUrl: zod_1.z.string().url(),
    programId: zod_1.z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    cluster: zod_1.z.enum(['mainnet-beta', 'testnet', 'devnet']),
    adminPrivateKey: nonEmptyString('Solana admin private key'),
    maxTransactionFee: zod_1.z.string().regex(/^\d*\.?\d*$/),
});
/**
 * GitHub integration configuration schema
 */
const GitHubConfigSchema = zod_1.z.object({
    webhookSecret: zod_1.z.string()
        .refine(val => !isProd || val.length >= 32, {
        message: 'GitHub webhook secret must be at least 32 characters long in production'
    }),
    appId: nonEmptyString('GitHub app ID'),
    privateKey: nonEmptyString('GitHub private key'),
    clientId: nonEmptyString('GitHub client ID'),
    clientSecret: nonEmptyString('GitHub client secret'),
    installationId: nonEmptyString('GitHub installation ID'),
});
const FirebaseConfigSchema = zod_1.z.object({
    projectId: zod_1.z.string(),
    storageBucket: zod_1.z.string(),
    databaseURL: zod_1.z.string().optional(),
});
const BountyConfigSchema = zod_1.z.object({
    minAmount: zod_1.z.number().positive(),
    maxAmount: zod_1.z.number().positive(),
    defaultFeePercentage: zod_1.z.number().min(0).max(100),
    defaultDeadlineDays: zod_1.z.number().positive(),
    allowedTokens: zod_1.z.array(zod_1.z.string()),
});
const LoggingConfigSchema = zod_1.z.object({
    level: zod_1.z.enum(['error', 'warn', 'info', 'debug', 'verbose']),
    verbose: zod_1.z.boolean(),
    maxPayloadSize: zod_1.z.number().positive(),
});
const RateLimitConfigSchema = zod_1.z.object({
    windowMs: zod_1.z.number().positive(),
    maxRequests: zod_1.z.number().positive(),
});
const ConfigSchema = zod_1.z.object({
    environment: zod_1.z.enum(['development', 'staging', 'production']),
    solana: SolanaConfigSchema,
    github: GitHubConfigSchema,
    firebase: FirebaseConfigSchema,
    bounty: BountyConfigSchema,
    logging: LoggingConfigSchema,
    rateLimit: RateLimitConfigSchema,
});
// Configuration values
const config = {
    environment: process.env.NODE_ENV || 'development',
    solana: {
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        programId: process.env.PROGRAM_ID || '8Z549f1KnB17k3WEqwgizNrMd5QigkzAUdAVvQ3wAARb',
        cluster: process.env.SOLANA_CLUSTER || 'devnet',
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
        level: process.env.LOG_LEVEL || 'info',
        verbose: process.env.VERBOSE_LOGGING === 'true',
        maxPayloadSize: Number(process.env.MAX_PAYLOAD_SIZE) || 1024,
    },
    rateLimit: {
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    },
};
// Validate configuration
try {
    ConfigSchema.parse(config);
}
catch (error) {
    if (error instanceof zod_1.z.ZodError) {
        console.error('Configuration validation failed:');
        error.errors.forEach((err) => {
            console.error(`- ${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
    }
    throw error;
}
// Helper functions to access config values safely
function getConfig() {
    return Object.freeze({ ...config });
}
exports.getConfig = getConfig;
function getSolanaConfig() {
    return Object.freeze({ ...config.solana });
}
exports.getSolanaConfig = getSolanaConfig;
function getGitHubConfig() {
    return Object.freeze({ ...config.github });
}
exports.getGitHubConfig = getGitHubConfig;
function getFirebaseConfig() {
    return Object.freeze({ ...config.firebase });
}
exports.getFirebaseConfig = getFirebaseConfig;
function getBountyConfig() {
    return Object.freeze({ ...config.bounty });
}
exports.getBountyConfig = getBountyConfig;
function getLoggingConfig() {
    return Object.freeze({ ...config.logging });
}
exports.getLoggingConfig = getLoggingConfig;
function getRateLimitConfig() {
    return Object.freeze({ ...config.rateLimit });
}
exports.getRateLimitConfig = getRateLimitConfig;
// Export individual config sections and full config
exports.default = Object.freeze(config);
//# sourceMappingURL=index.js.map