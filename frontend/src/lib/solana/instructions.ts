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
const PROGRAM_ID = new PublicKey('9p1X1hkMwYRaVfknfQGEdqvph9VQmKjkeRhzKCaz3PeQ');  // Replace with actual program ID
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
  // Derive PDA for the bounty account
  const [bountyPDA] = await PublicKey.findProgramAddress(
    [
      Buffer.from(BOUNTY_PDA_SEED),
      Buffer.from(issueHash),
      creator.toBuffer()
    ],
    PROGRAM_ID
  );

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

  // Create instruction data buffer
  const instructionData = Buffer.alloc(1 + 32 + 8 + 1); // 1 byte for instruction, 32 for hash, 8 for amount, 1 for currency
  
  // Write instruction index
  instructionData.writeUInt8(0, 0); // create_bounty instruction
  
  // Write issue hash (32 bytes)
  Buffer.from(issueHash, 'hex').copy(instructionData, 1);
  
  // Write amount (8 bytes)
  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(BigInt(amount), 0);
  amountBuffer.copy(instructionData, 33);
  
  // Write currency type (1 byte)
  instructionData.writeUInt8(currency === 'USDC' ? 1 : 0, 41);

  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data: instructionData,
  });
}

export async function findBountyPDA(issueHash: string): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [Buffer.from(issueHash), Buffer.from('bounty')],
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