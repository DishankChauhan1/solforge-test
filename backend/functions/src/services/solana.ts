import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import { web3 } from "@coral-xyz/anchor";


// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");

// Load program ID from environment variable
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || "dGBsodouKiYTUyFudwbHdfXJaHWbUEyXhyw7jj4BBeY");

// Load admin wallet from environment
const loadAdminWallet = (): Keypair => {
  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Admin private key not found in environment variables");
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
): Promise<{ signature: string }> => {
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
    
    return { signature };
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
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: amount
      })
    );

    const signature = await connection.sendTransaction(transaction, []);
    await connection.confirmTransaction(signature);
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
  // Implementation here
  return '';
}; 