# SolForge - Decentralized Bounty Platform

A decentralized bounty platform built on Solana, allowing developers to create, claim, and complete bounties for open-source contributions.

## Features

- User authentication with Email, Google, and GitHub
- Create and manage bounties
- Submit and review work
- Integration with GitHub for issue tracking
- Solana wallet integration for payments
- Real-time updates using Firebase

## Tech Stack used

- Frontend: Next.js 14 with TypeScript
- Authentication: Firebase Auth
- Database: Firebase Firestore
- Blockchain: Solana
- Styling: Tailwind CSS

## Prerequisites

- Node.js 18+ and npm
- Firebase account and project
- Solana wallet (Phantom recommended)
- GitHub account for OAuth

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Getting Started

1. Clone the repository
```bash
git clone https://github.com/yourusername/solforge.git
cd solforge
```

2. Install dependencies
```bash
npm install
```

3. Run the development server
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── frontend/               # Frontend Next.js application
│   ├── src/
│   │   ├── app/           # Next.js app directory
│   │   ├── components/    # React components
│   │   ├── context/       # React context providers
│   │   ├── lib/          # Utility functions and Firebase setup
│   │   └── types/        # TypeScript type definitions
│   └── public/           # Static assets
└── backend/              # Firebase Functions
    └── src/
        ├── routes/       # API route handlers
        ├── models/       # Data models
        └── services/     # Business logic and services
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 
