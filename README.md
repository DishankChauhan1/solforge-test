#SolForge: Decentralized GitHub Bounty Platform

## Why We Built SolForge

The open-source ecosystem faces a significant challenge: while there are millions of open issues across GitHub repositories, there's no standardized way to incentivize developers to solve them. Traditional bounty platforms either lack proper integration with development workflows or suffer from centralized payment systems that create friction and trust issues.

SolForge bridges this gap by directly connecting GitHub's collaborative development environment with Solana's fast, low-cost blockchain infrastructure. This creates a seamless experience where:

1. Project maintainers can easily fund issues and attract talented developers
2. Contributors can work within their familiar GitHub workflow
3. Payments are processed automatically and transparently through smart contracts
4. The entire process is trustless, removing the need for third-party escrow services

Our mission is to accelerate open-source development by creating a merit-based ecosystem where quality contributions are properly rewarded and recognized.

## Architecture Diagram

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  GitHub         │<─────│  SolForge       │<─────│  Solana         │
│  Integration    │      │  Application    │      │  Blockchain     │
│                 │      │                 │      │                 │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ - OAuth Auth    │      │ - Firebase      │      │ - Smart         │
│ - Webhooks      │      │   Functions     │      │   Contracts     │
│ - Issue/PR      │      │ - Next.js       │      │ - Fund Escrow   │
│   Tracking      │      │   Frontend      │      │ - Auto Payments │
└─────────────────┘      └─────────────────┘      └─────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                         Data Flow Architecture                      │
│                                                                     │
├─────────────────┬─────────────────────────────┬─────────────────────┤
│                 │                             │                     │
│  Creator Flow   │   Contributor Flow          │  Payment Flow       │
│                 │                             │                     │
├─────────────────┼─────────────────────────────┼─────────────────────┤
│ 1. Auth         │ 1. Browse Bounties          │ 1. PR Merged        │
│ 2. Create Bounty│ 2. Claim Bounty             │ 2. Webhook Trigger  │
│ 3. Fund Escrow  │ 3. Submit PR                │ 3. Verification     │
│ 4. Review PRs   │ 4. Get Approved             │ 4. Smart Contract   │
│                 │                             │    Payment          │
└─────────────────┴─────────────────────────────┴─────────────────────┘
```

## Technology Stack

### Frontend
- **Next.js**: React framework for the web application
- **TypeScript**: Type-safe code
- **Tailwind CSS**: Utility-first styling
- **Firebase Auth**: User authentication with GitHub OAuth
- **Wallet Adapter**: Solana wallet integration

### Backend
- **Firebase Functions**: Serverless API endpoints
- **Firestore**: NoSQL database for bounty and user data
- **GitHub API**: Repository and PR integration
- **Webhook Listeners**: Automated event processing

### Blockchain
- **Solana Program**: Custom smart contract for bounty management
- **Web3.js**: JavaScript library for blockchain interaction
- **SPL Token**: Support for SOL and custom token payments

### DevOps
- **Firebase Hosting**: Frontend deployment
- **GitHub Actions**: CI/CD pipeline
- **Solana CLI**: Contract deployment and testing

## Links

- **Live Demo**: [https://solforge.app](https://solforge.app)
- **Deployed Contract**: [8Z549f1KnB17k3WEqwgizNrMd5QigkzAUdAVvQ3wAARb](https://explorer.solana.com/address/8Z549f1KnB17k3WEqwgizNrMd5QigkzAUdAVvQ3wAARb?cluster=devnet)
- **GitHub Repository**: [https://github.com/yourusername/solforge](https://github.com/yourusername/solforge)

## Completed Features

### For Creators
- **GitHub OAuth Integration**: Seamless authentication via GitHub
- **Bounty Creation System**: Create bounties with GitHub issue links and SOL/USDC amounts
- **Fund Locking via Smart Contract**: Securely lock funds during bounty lifetime
- **Submission Management**: View, approve, and reject submissions
- **Manual Approval System**: Approve submissions to trigger automatic payments
- **GitHub Integration**: Automatic verification of PRs and issue status updates

### For Contributors
- **Bounty Discovery**: Browse and search available bounties
- **Submission System**: Submit GitHub PRs or commit hashes as proof of work
- **Auto-payment on Approval**: Receive payments automatically when PRs are merged or approved
- **Leaderboard**: View top contributors ranked by earnings and completed bounties
- **Achievement Badges**: Earn badges for milestones (first bounty, 5 bounties, 10 bounties)
- **GitHub Contribution History**: View and showcase your contribution history

## Deployment Instructions

SolForge can be deployed entirely using Firebase's ecosystem:

### Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Solana CLI installed
- GitHub OAuth application created

### Backend Deployment
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Set Firebase configuration:
   ```bash
   firebase functions:config:set github.app_webhook_secret="YOUR_WEBHOOK_SECRET" github.client_id="YOUR_CLIENT_ID" github.client_secret="YOUR_CLIENT_SECRET" solana.admin_private_key="YOUR_ADMIN_WALLET_KEY"
   ```

4. Deploy the functions:
   ```bash
   firebase deploy --only functions
   ```

### Frontend Deployment
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Build the application:
   ```bash
   npm run build
   ```

3. Deploy to Firebase Hosting:
   ```bash
   firebase deploy --only hosting
   ```

### Solana Program Deployment
1. Set your cluster to devnet:
   ```bash
   solana config set --url https://api.devnet.solana.com
   ```

2. Deploy the program:
   ```bash
   solana program deploy target/deploy/bounty_program.so --program-id program-keypair.json
   ```

## Future Roadmap

- Multi-signature approvals for enhanced security
- DAO integration for community-managed bounty programs
- Advanced analytics and contributor statistics
- Mobile application for on-the-go management

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 
