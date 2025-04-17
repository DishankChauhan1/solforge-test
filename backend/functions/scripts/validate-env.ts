import { getConfig } from '../src/config';
import { logger } from 'firebase-functions';

const isDevelopment = process.env.NODE_ENV === 'development';

try {
  // This will throw if validation fails
  const config = getConfig();
  
  logger.info('Environment configuration is valid');
  logger.info('Current environment:', config.environment);
  logger.info('Solana cluster:', config.solana.cluster);
  logger.info('Firebase project:', config.firebase.projectId);
  
  // Additional checks for required services
  if (!config.github.webhookSecret && !isDevelopment) {
    throw new Error('GitHub webhook secret is required in non-development environments');
  }
  
  if (!config.solana.adminPrivateKey) {
    throw new Error('Solana admin private key is required');
  }
  
  if (config.environment === 'production') {
    // Additional production checks
    if (config.solana.cluster !== 'mainnet-beta') {
      logger.warn('Warning: Production environment is not using mainnet-beta');
    }
    
    if (!config.firebase.databaseURL) {
      logger.warn('Warning: Firebase Realtime Database URL is not configured');
    }
    
    // Check rate limiting configuration
    if (config.rateLimit.maxRequests > 1000) {
      logger.warn('Warning: High rate limit configured in production');
    }
  }
  
  process.exit(0);
} catch (error) {
  if (isDevelopment) {
    logger.warn('Environment validation issues in development mode (continuing anyway):', error);
    process.exit(0); // Exit with success in development mode
  } else {
    logger.error('Environment validation failed:', error);
    process.exit(1);
  }
} 