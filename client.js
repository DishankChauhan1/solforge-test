const { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, Token } = require('@solana/spl-token');
const fs = require('fs');
const borsh = require('borsh');

// Connect to the Solana devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Load keypair from file
const loadKeypair = () => {
  const keypairJSON = JSON.parse(fs.readFileSync('/Users/dishankchauhan/.config/solana/id.json', 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairJSON));
};

// Program ID - Replace with your deployed program ID
const PROGRAM_ID = new PublicKey('9p1X1hkMwYRaVfknfQGEdqvph9VQmKjkeRhzKCaz3PeQ');

// Define BountyState enum
const BountyState = {
  Available: { available: {} },
  Claimed: { claimed: {} },
  Completed: { completed: {} }
};

// Define BountyInstruction enum
const BountyInstruction = {
  CreateSolBounty: 0,
  CreateTokenBounty: 1,
  ClaimBounty: 2,
  CompleteBounty: 3
};

// Borsh schema for instructions
const createSolBountySchema = {
  struct: {
    instruction: 'u8',
    amount: 'u64',
    description: 'string'
  }
};

// Borsh schema for Bounty
const bountySchema = {
  struct: {
    creator: { array: { type: 'u8', len: 32 } },
    amount: 'u64',
    description: 'string',
    state: 'u8',  // 0: Available, 1: Claimed, 2: Completed
    claimant: { array: { type: 'u8', len: 32 } },
    token_mint: { array: { type: 'u8', len: 32 } }
  }
};

// Function to check bounty details
async function checkBounty(bountyPubkey) {
  try {
    console.log(`\nChecking bounty: ${bountyPubkey}`);
    const accountInfo = await connection.getAccountInfo(new PublicKey(bountyPubkey));
    
    if (!accountInfo) {
      console.log('Bounty account not found or not initialized.');
      return;
    }
    
    console.log('Bounty account exists, owner:', accountInfo.owner.toString());
    console.log('Account data length:', accountInfo.data.length, 'bytes');
    
    // TODO: When program is fully functional, uncomment to parse actual bounty data
    // const bountyData = borsh.deserialize(bountySchema, accountInfo.data);
    // console.log('Bounty details:');
    // console.log('- Creator:', new PublicKey(bountyData.creator).toString());
    // console.log('- Amount:', Number(bountyData.amount) / 1_000_000_000, 'SOL');
    // console.log('- Description:', bountyData.description);
    // console.log('- State:', ['Available', 'Claimed', 'Completed'][bountyData.state]);
    // if (bountyData.state > 0) {
    //   console.log('- Claimant:', new PublicKey(bountyData.claimant).toString());
    // }
  } catch (error) {
    console.error('Error checking bounty:', error);
  }
}

// Main function
async function main() {
  // Load payer keypair
  const payer = loadKeypair();
  console.log('Using account:', payer.publicKey.toString());

  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`Account balance: ${balance / 1_000_000_000} SOL`);

  // Create a new bounty account
  const bountyAccount = Keypair.generate();
  console.log('Created new bounty account:', bountyAccount.publicKey.toString());

  // Create a bounty with 0.1 SOL
  const description = "Fix bug in authentication system";
  const amount = 100_000_000; // 0.1 SOL in lamports

  // Serialize instruction data
  const instructionData = Buffer.from(
    borsh.serialize(
      createSolBountySchema,
      {
        instruction: BountyInstruction.CreateSolBounty,
        amount: BigInt(amount),
        description: description
      }
    )
  );

  try {
    // Create transaction
    const transaction = new Transaction().add({
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: bountyAccount.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: PROGRAM_ID,
      data: instructionData
    });

    // Send transaction
    console.log('Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, bountyAccount]
    );
    console.log('Transaction confirmed with signature:', signature);
    console.log('Bounty created successfully!');
  } catch (error) {
    console.error('Error creating bounty:', error);
  }

  console.log('To create another transaction, modify this script and run it again.');
  
  // Check the bounty account
  await checkBounty(bountyAccount.publicKey.toString());
}

main().catch(console.error); 