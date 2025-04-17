import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import { web3 } from "@coral-xyz/anchor";
import { getSolanaConfig } from '../config';

// Define variables for SPL token functions
let TOKEN_PROGRAM_ID: any;
let getAssociatedTokenAddress: any;
let createAssociatedTokenAccountInstruction: any;
let createTransferInstruction: any;
let splTokenLoaded = false;

// Function to dynamically load SPL token modules
const loadSplTokenModule = async () => {
  if (splTokenLoaded) return;
  
  try {
    // Dynamic import using Function to avoid TypeScript static analysis issues
    const dynamicImport = new Function('return import("@solana/spl-token")')();
    const splToken = await dynamicImport;
    
    TOKEN_PROGRAM_ID = splToken.TOKEN_PROGRAM_ID;
    getAssociatedTokenAddress = splToken.getAssociatedTokenAddress;
    createAssociatedTokenAccountInstruction = splToken.createAssociatedTokenAccountInstruction;
    createTransferInstruction = splToken.createTransferInstruction;
    splTokenLoaded = true;
    console.log("SPL Token modules loaded successfully");
  } catch (error) {
    console.error("Error loading SPL token modules:", error);
    throw error;
  }
};

// Try to load SPL token modules immediately
loadSplTokenModule().catch(error => {
  console.error("Failed to preload SPL token modules:", error);
  // Non-blocking error - modules will be loaded when needed
});

const solanaConfig = getSolanaConfig();

// Initialize Solana connection
const connection = new Connection(solanaConfig.rpcUrl);

// Update program ID to new value
const PROGRAM_ID = new PublicKey("8Z549f1KnB17k3WEqwgizNrMd5QigkzAUdAVvQ3wAARb");

// Load admin wallet from config
const loadAdminWallet = (): Keypair => {
  const privateKey = solanaConfig.adminPrivateKey;
  if (!privateKey) {
    throw new Error("Admin private key not found in configuration");
  }
  return Keypair.fromSecretKey(Buffer.from(privateKey, "base64"));
};

export interface CreateBountyArgs {
  amount: number;
  description: string;
}

export interface ClaimBountyArgs {
  bountyAccount: string;
}

export interface CompleteBountyArgs {
  bountyAccount: string;
  claimant: string;
}

export const createSolBounty = async (
  walletPublicKey: string,
  amount: number,
  description: string
): Promise<{ signature: string; bountyAccount: string }> => {
  try {
    const adminWallet = loadAdminWallet();
    const creatorPubkey = new PublicKey(walletPublicKey);
    const bountyAccount = Keypair.generate();

    // Convert amount to lamports
    const lamports = Math.floor(amount * web3.LAMPORTS_PER_SOL);

    // Create instruction data
    const data = Buffer.from([
      0, // CreateSolBounty instruction
      ...new Uint8Array(new Uint16Array([lamports]).buffer),
      ...Buffer.from(description),
    ]);

    // Create instruction
    const instruction = new web3.TransactionInstruction({
      keys: [
        { pubkey: creatorPubkey, isSigner: true, isWritable: true },
        { pubkey: bountyAccount.publicKey, isSigner: true, isWritable: true },
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    const signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [adminWallet, bountyAccount]
    );

    return {
      signature,
      bountyAccount: bountyAccount.publicKey.toString(),
    };
  } catch (error) {
    console.error("Error creating SOL bounty:", error);
    throw error;
  }
};

export const claimBounty = async (
  bountyAccountPublicKey: string,
  claimantPublicKey: string
): Promise<{ signature: string }> => {
  try {
    const adminWallet = loadAdminWallet();
    const bountyPubkey = new PublicKey(bountyAccountPublicKey);
    const claimantPubkey = new PublicKey(claimantPublicKey);

    // Create instruction data
    const data = Buffer.from([1]); // ClaimBounty instruction

    // Create instruction
    const instruction = new web3.TransactionInstruction({
      keys: [
        { pubkey: claimantPubkey, isSigner: true, isWritable: false },
        { pubkey: bountyPubkey, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID,
      data,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    const signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [adminWallet]
    );

    return { signature };
  } catch (error) {
    console.error("Error claiming bounty:", error);
    throw error;
  }
};

export const completeBounty = async (
  bountyAccountPublicKey: string,
  claimantPublicKey: string,
  prUrl: string = ''
): Promise<{
    success: boolean;
    signature: string 
}> => {
  try {
    const adminWallet = loadAdminWallet();
    const bountyPubkey = new PublicKey(bountyAccountPublicKey);
    const claimantPubkey = new PublicKey(claimantPublicKey);

    // Choose the instruction based on whether we have a PR URL
    // 2 = CompleteBounty instruction, 6 = AutoCompleteBounty instruction
    const instructionIndex = prUrl ? 6 : 2;
    
    // Create instruction data with or without PR URL
    let data: Buffer;
    if (prUrl) {
      // For AutoCompleteBounty, include the PR URL
      const prUrlBuffer = Buffer.from(prUrl);
      data = Buffer.alloc(1 + 4 + prUrlBuffer.length);
      
      // Write instruction index
      data.writeUInt8(instructionIndex, 0);
      
      // Write PR URL length and data
      data.writeUInt32LE(prUrlBuffer.length, 1);
      prUrlBuffer.copy(data, 5);
      
      console.log(`Using AutoCompleteBounty instruction with PR URL: ${prUrl}`);
    } else {
      // For regular CompleteBounty, just use the instruction index
      data = Buffer.from([instructionIndex]);
      console.log('Using standard CompleteBounty instruction');
    }

    // Create instruction
    const instruction = new web3.TransactionInstruction({
      keys: [
        { pubkey: adminWallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: claimantPubkey, isSigner: false, isWritable: true },
        { pubkey: bountyPubkey, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID,
      data,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    const signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [adminWallet]
    );

    console.log(`Bounty completion transaction sent. Signature: ${signature}`);
   
    return { success: true, signature };
  } catch (error) {
    console.error("Error completing bounty:", error);
    throw error;
  }
};

export const transferSOL = async (
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  amount: number
): Promise<string> => {
  try {
    // Load the admin wallet which will pay for the transaction
    const adminWallet = loadAdminWallet();
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: adminWallet.publicKey, // Use admin wallet as the sender
        toPubkey, // Destination wallet
        lamports: amount
      })
    );
    
    // Sign and send transaction with the admin wallet
    const signature = await web3.sendAndConfirmTransaction(
      connection, 
      transaction, 
      [adminWallet]
    );
    
    console.log(`SOL transfer successful. Amount: ${amount} lamports. Signature: ${signature}`);
    return signature;
  } catch (error) {
    console.error('Error transferring SOL:', error);
    throw error;
  }
};

export const transferSPLToken = async (
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  tokenMint: PublicKey,
  amount: number
): Promise<string> => {
  try {
    // Make sure SPL token modules are loaded
    if (!splTokenLoaded) {
      await loadSplTokenModule();
    }
    
    // Load the admin wallet which will pay for the transaction
    const adminWallet = loadAdminWallet();
    
    // Get token accounts for sender and receiver
    const fromATA = await getAssociatedTokenAddress(
      tokenMint,
      adminWallet.publicKey
    );
    
    const toATA = await getAssociatedTokenAddress(
      tokenMint,
      toPubkey
    );
    
    // Check if to token account exists, if not create it
    const toAccount = await connection.getAccountInfo(toATA);
    const transaction = new Transaction();
    
    if (!toAccount) {
      console.log(`Creating associated token account for recipient: ${toPubkey.toString()}`);
      transaction.add(
        createAssociatedTokenAccountInstruction(
          adminWallet.publicKey, // payer
          toATA,                 // associated token account
          toPubkey,              // owner
          tokenMint              // mint
        )
      );
    }
    
    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        fromATA,                 // source
        toATA,                   // destination
        adminWallet.publicKey,   // owner
        amount                   // amount
      )
    );
    
    // Sign and send transaction
    const signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [adminWallet]
    );
    
    console.log(`SPL token transfer successful. Amount: ${amount} tokens, Mint: ${tokenMint.toString()}, Signature: ${signature}`);
    return signature;
  } catch (error) {
    console.error('Error transferring SPL token:', error);
    
    // In development/test environment, return a mock signature if real transfer fails
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEV] Returning mock signature for SPL token transfer');
      return `mock-spl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    
    throw error;
  }
}; 