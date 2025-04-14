import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Connection,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { Program, AnchorProvider } from '@project-serum/anchor';
import { BountyCurrency } from '@/types/bounty';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { IDL } from './idl';

interface CreateBountyInstructionParams {
  issueHash: string;
  amount: number;
  currency: BountyCurrency;
  creator: PublicKey;
}

interface ClaimBountyParams {
  issueHash: string;
  amount: number;
  currency: 'SOL' | 'USDC';
  creator: string;
  claimer: PublicKey;
}

// Program and token addresses
const PROGRAM_ID = new PublicKey('9p1X1hkMwYRaVfknfQGEdqvph9VQmKjkeRhzKCaz3PeQ');  // Replace with your actual program ID
const USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'); // Devnet USDC
const BOUNTY_PDA_SEED = 'bounty';

async function getBountyProgram() {
  // Get the provider
  const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);
  const provider = new AnchorProvider(
    connection,
    // @ts-ignore - wallet will be injected by the wallet adapter
    window.solana,
    { commitment: 'confirmed' }
  );

  // Create the program interface
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

export async function claimBountyInstruction({
  issueHash,
  amount,
  currency,
  creator,
  claimer
}: ClaimBountyParams): Promise<TransactionInstruction> {
  const program = await getBountyProgram();
  const [bountyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(issueHash), Buffer.from('bounty')],
    program.programId
  );

  const creatorPubkey = new PublicKey(creator);

  if (currency === 'SOL') {
    return program.methods
      .claimBounty(issueHash)
      .accounts({
        bounty: bountyPda,
        creator: creatorPubkey,
        claimer: claimer,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  } else {
    // For USDC, we need to handle token accounts
    const mint = new PublicKey(USDC_MINT);
    const creatorAta = await getAssociatedTokenAddress(mint, creatorPubkey);
    const claimerAta = await getAssociatedTokenAddress(mint, claimer);

    return program.methods
      .claimTokenBounty(issueHash)
      .accounts({
        bounty: bountyPda,
        creator: creatorPubkey,
        creatorTokenAccount: creatorAta,
        claimer: claimer,
        claimerTokenAccount: claimerAta,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }
} 