/**
 * Configuration settings for GitHub webhook handling
 */
module.exports = {
  // Webhook secret for GitHub signature verification
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "your-webhook-secret",
  
  // GitHub App details
  githubApp: {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY,
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    installationId: process.env.GITHUB_INSTALLATION_ID,
  },
  
  // Auto-payment settings
  autoPayment: {
    enabled: process.env.ENABLE_AUTO_PAYMENT === "true" || false,
    // Connection to Solana cluster
    solanaCluster: process.env.SOLANA_CLUSTER || "devnet",
    // Program ID for the bounty program
    programId: process.env.BOUNTY_PROGRAM_ID,
    // Webhook authority keypair (base58 encoded private key)
    webhookAuthorityKey: process.env.WEBHOOK_AUTHORITY_KEY,
    // Maximum transaction fee in SOL (as a string to avoid precision issues)
    maxTransactionFee: process.env.MAX_TRANSACTION_FEE || "0.001",
  },
  
  // Logging configuration
  logging: {
    // Set to true to enable detailed logging for debugging
    verbose: process.env.VERBOSE_LOGGING === "true" || false,
    // Maximum size of the payload to log (in bytes)
    maxPayloadSize: 1024,
  }
}; 