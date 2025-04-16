# SolForge Backend Functions

This directory contains Firebase Cloud Functions that power the SolForge bounty platform.

## Configuration System

SolForge uses a centralized, validated configuration system to ensure consistent and error-free configuration across environments.

### Setup

1. Copy `.env.example` to `.env` in this directory
2. Fill in all required configuration values
3. Run `npm run validate-env` to verify your configuration

### Environment Variables

The configuration is divided into logical sections:

#### Environment
- `NODE_ENV`: Environment name ('development', 'staging', 'production')

#### Solana Configuration
- `SOLANA_RPC_URL`: URL of the Solana RPC endpoint
- `PROGRAM_ID`: Program ID of the deployed bounty program
- `SOLANA_CLUSTER`: Solana cluster ('mainnet-beta', 'testnet', 'devnet')
- `ADMIN_PRIVATE_KEY`: Base64-encoded private key for the admin wallet
- `MAX_TRANSACTION_FEE`: Maximum transaction fee (in SOL)

#### GitHub Configuration
- `GITHUB_WEBHOOK_SECRET`: Secret used to verify webhook signatures
- `GITHUB_APP_ID`: GitHub App ID
- `GITHUB_PRIVATE_KEY`: GitHub App private key
- `GITHUB_CLIENT_ID`: GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth client secret
- `GITHUB_INSTALLATION_ID`: GitHub App installation ID

#### Firebase Configuration
- `FIREBASE_PROJECT_ID`: Firebase project ID
- `FIREBASE_STORAGE_BUCKET`: Firebase storage bucket
- `FIREBASE_DATABASE_URL`: Firebase Realtime Database URL (optional)

#### Bounty Configuration
- `MIN_BOUNTY_AMOUNT`: Minimum bounty amount
- `MAX_BOUNTY_AMOUNT`: Maximum bounty amount
- `DEFAULT_FEE_PERCENTAGE`: Default platform fee percentage
- `DEFAULT_DEADLINE_DAYS`: Default deadline in days
- `ALLOWED_TOKENS`: Comma-separated list of allowed token types

#### Logging Configuration
- `LOG_LEVEL`: Logging level ('error', 'warn', 'info', 'debug', 'verbose')
- `VERBOSE_LOGGING`: Whether to enable verbose logging
- `MAX_PAYLOAD_SIZE`: Maximum payload size to log

#### Rate Limiting
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window

### Validation

The configuration is validated at build and deployment time. If any required values are missing or invalid, the build or deployment will fail.

In production, additional validation rules are applied to ensure critical values are set.

### Accessing Configuration

In your code, you can access the configuration using the helper functions:

```typescript
import { getConfig, getSolanaConfig, getGitHubConfig } from '../config';

// Get the entire config
const config = getConfig();

// Get a specific section
const solanaConfig = getSolanaConfig();

// Use specific values
const rpcUrl = solanaConfig.rpcUrl;
```

The configuration values are frozen (immutable) to prevent accidental modification.

## Scripts

- `npm run validate-env`: Validate the environment configuration
- `npm run build`: Build the functions (includes validation)
- `npm run deploy`: Deploy the functions (includes validation)
- `npm run serve`: Run functions locally for development

## Development Best Practices

1. Always use the configuration system instead of hardcoded values
2. Add new configuration options to both the schema and the `.env.example` file
3. Document new configuration options in this README
4. Use the helper functions to access configuration values
5. Never log sensitive configuration values

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
- Copy `.env.example` to `.env`
- Fill in your configuration values

3. Configure Firebase:
- Enable Firebase Authentication with GitHub provider
- Enable Firestore
- Set up Firebase Functions

## Environment Variables

### Firebase Config
- `FIREBASE_PROJECT_ID`: Your Firebase project ID
- `FIREBASE_PRIVATE_KEY`: Your Firebase admin SDK private key
- `FIREBASE_CLIENT_EMAIL`: Your Firebase admin SDK client email

### Solana Config
- `SOLANA_RPC_URL`: Your Solana RPC URL (e.g., devnet, mainnet, or local)
- `PROGRAM_ID`: Your deployed Solana program ID
- `ADMIN_PRIVATE_KEY`: Base64-encoded private key for the admin wallet

### GitHub Config
- `GITHUB_CLIENT_ID`: Your GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET`: Your GitHub OAuth app client secret

## Available Functions

### Authentication
- `handleGithubAuth`: Handles GitHub authentication and stores user data
- `updateWallet`: Updates user's Solana wallet address

### Bounty Management
- `createBounty`: Creates a new bounty
- `claimBounty`: Claims an open bounty
- `completeBounty`: Completes a claimed bounty with PR verification

## Development

1. Run locally:
```bash
npm run serve
```

2. Deploy:
```bash
npm run deploy
```

## Testing

Run tests:
```bash
npm test
```

## Security

- All functions require authentication
- PR verification ensures only merged PRs can complete bounties
- Solana program interactions are signed by admin wallet
- GitHub tokens are securely stored in Firestore

## Architecture

1. **Authentication Flow**:
   - User authenticates with GitHub
   - User data stored in Firestore
   - Wallet address linked to user profile

2. **Bounty Flow**:
   - Create: User creates bounty with SOL deposit
   - Claim: Developer claims bounty
   - Complete: Developer submits PR and completes bounty
   - Verification: System verifies PR is merged
   - Payment: SOL transferred to developer

3. **Security Measures**:
   - All functions require authentication
   - Firestore rules enforce access control
   - Solana program validates transactions
   - GitHub API verifies PR status 