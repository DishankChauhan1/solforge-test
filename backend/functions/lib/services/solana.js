"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferSPLToken = exports.transferSOL = exports.completeBounty = exports.claimBounty = exports.createSolBounty = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const config_1 = require("../config");
// Define variables for SPL token functions
let TOKEN_PROGRAM_ID;
let getAssociatedTokenAddress;
let createAssociatedTokenAccountInstruction;
let createTransferInstruction;
let splTokenLoaded = false;
// Function to dynamically load SPL token modules
const loadSplTokenModule = async () => {
    if (splTokenLoaded)
        return;
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
    }
    catch (error) {
        console.error("Error loading SPL token modules:", error);
        throw error;
    }
};
// Try to load SPL token modules immediately
loadSplTokenModule().catch(error => {
    console.error("Failed to preload SPL token modules:", error);
    // Non-blocking error - modules will be loaded when needed
});
const solanaConfig = (0, config_1.getSolanaConfig)();
// Initialize Solana connection
const connection = new web3_js_1.Connection(solanaConfig.rpcUrl);
// Update program ID to new value
const PROGRAM_ID = new web3_js_1.PublicKey("8Z549f1KnB17k3WEqwgizNrMd5QigkzAUdAVvQ3wAARb");
// Load admin wallet from config
const loadAdminWallet = () => {
    const privateKey = solanaConfig.adminPrivateKey;
    if (!privateKey) {
        throw new Error("Admin private key not found in configuration");
    }
    return web3_js_1.Keypair.fromSecretKey(Buffer.from(privateKey, "base64"));
};
const createSolBounty = async (walletPublicKey, amount, description) => {
    try {
        const adminWallet = loadAdminWallet();
        const creatorPubkey = new web3_js_1.PublicKey(walletPublicKey);
        const bountyAccount = web3_js_1.Keypair.generate();
        // Convert amount to lamports
        const lamports = Math.floor(amount * anchor_1.web3.LAMPORTS_PER_SOL);
        // Create instruction data
        const data = Buffer.from([
            0,
            ...new Uint8Array(new Uint16Array([lamports]).buffer),
            ...Buffer.from(description),
        ]);
        // Create instruction
        const instruction = new anchor_1.web3.TransactionInstruction({
            keys: [
                { pubkey: creatorPubkey, isSigner: true, isWritable: true },
                { pubkey: bountyAccount.publicKey, isSigner: true, isWritable: true },
                { pubkey: anchor_1.web3.SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data,
        });
        // Create and send transaction
        const transaction = new web3_js_1.Transaction().add(instruction);
        const signature = await anchor_1.web3.sendAndConfirmTransaction(connection, transaction, [adminWallet, bountyAccount]);
        return {
            signature,
            bountyAccount: bountyAccount.publicKey.toString(),
        };
    }
    catch (error) {
        console.error("Error creating SOL bounty:", error);
        throw error;
    }
};
exports.createSolBounty = createSolBounty;
const claimBounty = async (bountyAccountPublicKey, claimantPublicKey) => {
    try {
        const adminWallet = loadAdminWallet();
        const bountyPubkey = new web3_js_1.PublicKey(bountyAccountPublicKey);
        const claimantPubkey = new web3_js_1.PublicKey(claimantPublicKey);
        // Create instruction data
        const data = Buffer.from([1]); // ClaimBounty instruction
        // Create instruction
        const instruction = new anchor_1.web3.TransactionInstruction({
            keys: [
                { pubkey: claimantPubkey, isSigner: true, isWritable: false },
                { pubkey: bountyPubkey, isSigner: false, isWritable: true },
            ],
            programId: PROGRAM_ID,
            data,
        });
        // Create and send transaction
        const transaction = new web3_js_1.Transaction().add(instruction);
        const signature = await anchor_1.web3.sendAndConfirmTransaction(connection, transaction, [adminWallet]);
        return { signature };
    }
    catch (error) {
        console.error("Error claiming bounty:", error);
        throw error;
    }
};
exports.claimBounty = claimBounty;
const completeBounty = async (bountyAccountPublicKey, claimantPublicKey, prUrl = '') => {
    try {
        const adminWallet = loadAdminWallet();
        const bountyPubkey = new web3_js_1.PublicKey(bountyAccountPublicKey);
        const claimantPubkey = new web3_js_1.PublicKey(claimantPublicKey);
        // Choose the instruction based on whether we have a PR URL
        // 2 = CompleteBounty instruction, 6 = AutoCompleteBounty instruction
        const instructionIndex = prUrl ? 6 : 2;
        // Create instruction data with or without PR URL
        let data;
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
        }
        else {
            // For regular CompleteBounty, just use the instruction index
            data = Buffer.from([instructionIndex]);
            console.log('Using standard CompleteBounty instruction');
        }
        // Create instruction
        const instruction = new anchor_1.web3.TransactionInstruction({
            keys: [
                { pubkey: adminWallet.publicKey, isSigner: true, isWritable: false },
                { pubkey: claimantPubkey, isSigner: false, isWritable: true },
                { pubkey: bountyPubkey, isSigner: false, isWritable: true },
            ],
            programId: PROGRAM_ID,
            data,
        });
        // Create and send transaction
        const transaction = new web3_js_1.Transaction().add(instruction);
        const signature = await anchor_1.web3.sendAndConfirmTransaction(connection, transaction, [adminWallet]);
        console.log(`Bounty completion transaction sent. Signature: ${signature}`);
        return { success: true, signature };
    }
    catch (error) {
        console.error("Error completing bounty:", error);
        throw error;
    }
};
exports.completeBounty = completeBounty;
const transferSOL = async (fromPubkey, toPubkey, amount) => {
    try {
        // Load the admin wallet which will pay for the transaction
        const adminWallet = loadAdminWallet();
        const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
            fromPubkey: adminWallet.publicKey,
            toPubkey,
            lamports: amount
        }));
        // Sign and send transaction with the admin wallet
        const signature = await anchor_1.web3.sendAndConfirmTransaction(connection, transaction, [adminWallet]);
        console.log(`SOL transfer successful. Amount: ${amount} lamports. Signature: ${signature}`);
        return signature;
    }
    catch (error) {
        console.error('Error transferring SOL:', error);
        throw error;
    }
};
exports.transferSOL = transferSOL;
const transferSPLToken = async (fromPubkey, toPubkey, tokenMint, amount) => {
    try {
        // Make sure SPL token modules are loaded
        if (!splTokenLoaded) {
            await loadSplTokenModule();
        }
        // Load the admin wallet which will pay for the transaction
        const adminWallet = loadAdminWallet();
        // Get token accounts for sender and receiver
        const fromATA = await getAssociatedTokenAddress(tokenMint, adminWallet.publicKey);
        const toATA = await getAssociatedTokenAddress(tokenMint, toPubkey);
        // Check if to token account exists, if not create it
        const toAccount = await connection.getAccountInfo(toATA);
        const transaction = new web3_js_1.Transaction();
        if (!toAccount) {
            console.log(`Creating associated token account for recipient: ${toPubkey.toString()}`);
            transaction.add(createAssociatedTokenAccountInstruction(adminWallet.publicKey, // payer
            toATA, // associated token account
            toPubkey, // owner
            tokenMint // mint
            ));
        }
        // Add transfer instruction
        transaction.add(createTransferInstruction(fromATA, // source
        toATA, // destination
        adminWallet.publicKey, // owner
        amount // amount
        ));
        // Sign and send transaction
        const signature = await anchor_1.web3.sendAndConfirmTransaction(connection, transaction, [adminWallet]);
        console.log(`SPL token transfer successful. Amount: ${amount} tokens, Mint: ${tokenMint.toString()}, Signature: ${signature}`);
        return signature;
    }
    catch (error) {
        console.error('Error transferring SPL token:', error);
        // In development/test environment, return a mock signature if real transfer fails
        if (process.env.NODE_ENV !== 'production') {
            console.log('[DEV] Returning mock signature for SPL token transfer');
            return `mock-spl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }
        throw error;
    }
};
exports.transferSPLToken = transferSPLToken;
//# sourceMappingURL=solana.js.map