"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferSPLToken = exports.transferSOL = exports.completeBounty = exports.claimBounty = exports.createSolBounty = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
// Initialize Solana connection
const connection = new web3_js_1.Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");
// Load program ID from environment variable
const PROGRAM_ID = new web3_js_1.PublicKey(process.env.PROGRAM_ID || "dGBsodouKiYTUyFudwbHdfXJaHWbUEyXhyw7jj4BBeY");
// Load admin wallet from environment
const loadAdminWallet = () => {
    const privateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("Admin private key not found in environment variables");
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
        return { signature };
    }
    catch (error) {
        console.error("Error completing bounty:", error);
        throw error;
    }
};
exports.completeBounty = completeBounty;
const transferSOL = async (fromPubkey, toPubkey, amount) => {
    try {
        const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: amount
        }));
        const signature = await connection.sendTransaction(transaction, []);
        await connection.confirmTransaction(signature);
        return signature;
    }
    catch (error) {
        console.error('Error transferring SOL:', error);
        throw error;
    }
};
exports.transferSOL = transferSOL;
const transferSPLToken = async (fromPubkey, toPubkey, tokenMint, amount) => {
    // Implementation here
    return '';
};
exports.transferSPLToken = transferSPLToken;
//# sourceMappingURL=solana.js.map