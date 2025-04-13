# Bounty Board Firebase Functions

This directory contains the Firebase Functions implementation for the Bounty Board application.

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