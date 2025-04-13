# Bounty Program

This is a Solana program that allows users to create, claim, and complete bounties using either SOL or SPL tokens.

## Features

- Create bounties with SOL
- Create bounties with SPL tokens
- Claim available bounties
- Complete claimed bounties and transfer funds to claimants

## Project Structure

- `src/` - Rust source code for the Solana program
  - `lib.rs` - Program entrypoint
  - `instruction.rs` - Instruction definitions
  - `processor.rs` - Instruction processing logic
  - `state.rs` - Program state definitions
  - `error.rs` - Custom error definitions
- `tests/` - JS tests for the program

## Building the Program

1. Install Solana CLI tools: https://docs.solana.com/cli/install-solana-cli-tools
2. Build the program:

```bash
cargo build-bpf
```

## Deploying the Program

```bash
solana program deploy target/deploy/bounty_program.so
```

Make sure to update the program ID in `lib.rs` after deployment.

## Running Tests

1. Install dependencies:

```bash
npm install
```

2. Start a local Solana test validator:

```bash
solana-test-validator
```

3. Run the tests:

```bash
npm test
```

## Usage

### Creating a SOL Bounty

A creator can create a bounty by specifying an amount of SOL and a description.

### Creating a Token Bounty

A creator can create a bounty using SPL tokens by specifying a token mint, amount, and description.

### Claiming a Bounty

A user can claim an available bounty, which will mark it as claimed and record their public key.

### Completing a Bounty

The creator of a bounty can mark a claimed bounty as completed, which will transfer the funds to the claimant.

## License

ISC 