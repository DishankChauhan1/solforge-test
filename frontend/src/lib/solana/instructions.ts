import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Connection,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@project-serum/anchor';
import { BountyCurrency } from '@/types/bounty';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { IDL } from './idl';

interface CreateBountyInstructionParams {
  issueHash: string;
  amount: number;
  currency: BountyCurrency;
  creator: PublicKey;
}

export class TransactionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TransactionError';
  }
}

// Program and token addresses
const PROGRAM_ID = new PublicKey('dGBsodouKiYTUyFudwbHdfXJaHWbUEyXhyw7jj4BBeY');  // Replace with actual program ID
const USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'); // Devnet USDC
const BOUNTY_PDA_SEED = 'bounty';

async function getBountyProgram() {
  const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);
  const provider = new AnchorProvider(
    connection,
    // @ts-ignore - wallet will be injected by wallet adapter
    window.solana,
    { commitment: 'confirmed' }
  );
  return new Program(IDL, PROGRAM_ID, provider);
}

export async function createBountyInstruction({
  issueHash,
  amount,
  currency,
  creator,
}: CreateBountyInstructionParams): Promise<TransactionInstruction> {
  // Ensure hash is correctly formatted for the PDA seed
  const hashBuffer = Buffer.from(issueHash, 'hex');
  if (hashBuffer.length !== 32) {
    console.error(`Invalid hash length: ${hashBuffer.length}, expected 32`);
    throw new Error('Invalid hash format. Expected a 32-byte hash.');
  }
  
  // Convert to a Uint8Array (32 bytes) as expected by the contract
  const hashArray = new Uint8Array(hashBuffer);
  
  console.log('Creating bounty with:', {
    programId: PROGRAM_ID.toString(),
    issueHash: hashBuffer.toString('hex'),
    creator: creator.toString(),
    amount
  });
  
  // Derive PDA for the bounty account using the same logic as the smart contract
  const [bountyPDA, bump] = await PublicKey.findProgramAddress(
    [
      Buffer.from('bounty'),  // BOUNTY_SEED_PREFIX from smart contract
      hashBuffer,             // Raw hash bytes
      creator.toBuffer()      // Creator key
    ],
    PROGRAM_ID
  );
  
  console.log('Derived PDA:', {
    bountyPDA: bountyPDA.toString(),
    bump
  });

  // Base accounts required for both SOL and USDC
  const keys = [
    { pubkey: creator, isSigner: true, isWritable: true },
    { pubkey: bountyPDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  if (currency === 'USDC') {
    // Get creator's ATA for USDC
    const creatorATA = await getAssociatedTokenAddress(USDC_MINT, creator);
    
    // Get bounty PDA's ATA for USDC
    const bountyATA = await getAssociatedTokenAddress(USDC_MINT, bountyPDA, true);

    // Add USDC-specific accounts
    keys.push(
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: creatorATA, isSigner: false, isWritable: true },
      { pubkey: bountyATA, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    );
  }

  // Create a description placeholder - can be modified later
  const description = "Bounty from SolForge";
  
  // Create a fixed repository URL if none is provided
  const repositoryUrl = "https://github.com/user/repo";
  
  // Set deadline 30 days from now
  const deadline = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  
  // Create instruction data buffer - format must match Rust's BorshSerialize format
  // This needs careful formatting to match the Rust side expectations
  const descriptionBuffer = Buffer.from(description);
  const repositoryUrlBuffer = Buffer.from(repositoryUrl);
  const issueUrlBuffer = Buffer.from("https://github.com/issue/1");
  
  // Approximate size calculation - instruction tag (1) + fields 
  const dataSize = 1 + 8 + descriptionBuffer.length + 4 + hashBuffer.length + 
                  issueUrlBuffer.length + 4 + repositoryUrlBuffer.length + 4 + 8;
  
  const instructionData = Buffer.alloc(dataSize);
  let offset = 0;
  
  // Write instruction index (0 = CreateSolBounty)
  instructionData.writeUInt8(0, offset);
  offset += 1;
  
  // Write amount (u64 = 8 bytes)
  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(BigInt(amount), 0);
  amountBuffer.copy(instructionData, offset);
  offset += 8;
  
  // Write description (string prefixed with length)
  instructionData.writeUInt32LE(descriptionBuffer.length, offset);
  offset += 4;
  descriptionBuffer.copy(instructionData, offset);
  offset += descriptionBuffer.length;
  
  // Write issue hash (fixed 32 bytes)
  hashBuffer.copy(instructionData, offset);
  offset += 32;
  
  // Write issue URL (string prefixed with length)
  instructionData.writeUInt32LE(issueUrlBuffer.length, offset);
  offset += 4;
  issueUrlBuffer.copy(instructionData, offset);
  offset += issueUrlBuffer.length;
  
  // Write repository URL (string prefixed with length)
  instructionData.writeUInt32LE(repositoryUrlBuffer.length, offset);
  offset += 4;
  repositoryUrlBuffer.copy(instructionData, offset);
  offset += repositoryUrlBuffer.length;
  
  // Write deadline (i64 = 8 bytes)
  const deadlineBuffer = Buffer.alloc(8);
  deadlineBuffer.writeBigInt64LE(BigInt(deadline), 0);
  deadlineBuffer.copy(instructionData, offset);
  
  console.log('Instruction data details:', {
    instructionSize: instructionData.length,
    firstByte: instructionData[0],
    amountBytes: amountBuffer.toString('hex')
  });

  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data: instructionData.slice(0, offset + 8),  // Ensure we only send the needed bytes
  });
}

export async function findBountyPDA(issueHash: string): Promise<[PublicKey, number]> {
  // Convert hash to buffer
  const hashBuffer = Buffer.from(issueHash, 'hex');
  
  // Find the PDA using the same logic as in the smart contract
  return PublicKey.findProgramAddress(
    [
      Buffer.from('bounty'),
      hashBuffer,
      // Note: This doesn't include creator, so it won't find the exact PDA without creator
    ],
    PROGRAM_ID
  );
}

export interface ClaimBountyParams {
  issueHash: string;
  amount: number;
  currency: BountyCurrency;
  creator: string;
  claimer: PublicKey;
}

export async function claimBountyInstruction({
  issueHash,
  amount,
  currency,
  creator,
  claimer
}: ClaimBountyParams): Promise<TransactionInstruction> {
  const program = await getBountyProgram();
  const [bountyPda] = await findBountyPDA(issueHash);
  const creatorPubkey = new PublicKey(creator);

  try {
    if (currency === 'SOL') {
      return program.methods
        .claimBounty(issueHash, new BN(amount))
        .accounts({
          bounty: bountyPda,
          creator: creatorPubkey,
          claimer: claimer,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
    } else {
      // For USDC, handle token accounts
      const mint = new PublicKey(USDC_MINT);
      const creatorAta = await getAssociatedTokenAddress(mint, creatorPubkey);
      const claimerAta = await getAssociatedTokenAddress(mint, claimer);
      const bountyAta = await getAssociatedTokenAddress(mint, bountyPda, true);

      return program.methods
        .claimTokenBounty(issueHash, new BN(amount))
        .accounts({
          bounty: bountyPda,
          creator: creatorPubkey,
          creatorTokenAccount: creatorAta,
          claimer: claimer,
          claimerTokenAccount: claimerAta,
          bountyTokenAccount: bountyAta,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();
    }
  } catch (error: any) {
    console.error('Error creating claim instruction:', error);
    throw new TransactionError(
      error.message || 'Failed to create claim instruction',
      'CLAIM_INSTRUCTION_FAILED'
    );
  }
}

export async function simulateClaimTransaction(
  connection: Connection,
  transaction: Transaction,
  feePayer: PublicKey
): Promise<void> {
  try {
    const simulation = await connection.simulateTransaction(transaction);
    
    if (simulation.value.err) {
      const errorLogs = simulation.value.logs?.join('\n') || 'No error logs available';
      console.error('Transaction simulation failed:', errorLogs);
      
      // Parse common error cases
      if (errorLogs.includes('insufficient funds')) {
        throw new TransactionError('Insufficient funds for transaction', 'INSUFFICIENT_FUNDS');
      }
      if (errorLogs.includes('already claimed')) {
        throw new TransactionError('Bounty has already been claimed', 'ALREADY_CLAIMED');
      }
      if (errorLogs.includes('invalid bounty state')) {
        throw new TransactionError('Bounty is in an invalid state', 'INVALID_STATE');
      }
      
      throw new TransactionError(
        'Transaction simulation failed: ' + simulation.value.err.toString(),
        'SIMULATION_FAILED'
      );
    }
  } catch (error: any) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      error.message || 'Failed to simulate transaction',
      'SIMULATION_ERROR'
    );
  }
}

export async function sendAndConfirmClaimTransaction(
  connection: Connection,
  transaction: Transaction,
  feePayer: PublicKey
): Promise<string> {
  try {
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = feePayer;

    // Send transaction
    const signature = await window.solana.signAndSendTransaction(transaction);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    });

    if (confirmation.value.err) {
      throw new TransactionError(
        'Transaction failed to confirm: ' + confirmation.value.err.toString(),
        'CONFIRMATION_FAILED'
      );
    }

    return signature;
  } catch (error: any) {
    console.error('Transaction failed:', error);
    
    if (error instanceof TransactionError) {
      throw error;
    }

    // Handle wallet errors
    if (error.code === 4001) {
      throw new TransactionError('Transaction rejected by user', 'USER_REJECTED');
    }

    throw new TransactionError(
      error.message || 'Failed to send transaction',
      'SEND_TRANSACTION_FAILED'
    );
  }
} 