const assert = require('assert');
const { SystemProgram, PublicKey, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, Token } = require('@solana/spl-token');
const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const { 
    Connection, 
    Transaction, 
    TransactionInstruction,
    sendAndConfirmTransaction
} = web3;

describe('bounty-program', () => {
  // Configure the client to use the local cluster
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.BountyProgram;
  const creator = anchor.web3.Keypair.generate();
  const claimant = anchor.web3.Keypair.generate();
  const bountyAccount = anchor.web3.Keypair.generate();
  
  // For token tests
  let mint;
  let creatorToken;
  let bountyToken;
  let claimantToken;

  const connection = new Connection('http://localhost:8899', 'confirmed');
  const programId = new PublicKey('8Z549f1KnB17k3WEqwgizNrMd5QigkzAUdAVvQ3wAARb');
  
  // Helper functions
  async function fundAccount(account, solAmount) {
    const signature = await connection.requestAirdrop(
      account.publicKey,
      solAmount * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);
  }

  async function findBountyPDA(creator) {
    return await PublicKey.findProgramAddress(
      [Buffer.from('bounty'), creator.publicKey.toBuffer()],
      programId
    );
  }

  async function createBounty(creator, amount, deadline, issueUrl) {
    const [bountyPDA] = await findBountyPDA(creator);
    
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: bountyPDA, isSigner: false, isWritable: true },
        { pubkey: creator.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: encodeInstruction('initialize', {
        amount,
        deadline,
        issueUrl
      })
    });

    const tx = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [creator]
    );

    return { bountyPDA, signature };
  }

  async function createTokenBounty(creator, mint, creatorToken, amount, deadline, issueUrl) {
    const [bountyPDA] = await findBountyPDA(creator);
    
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: bountyPDA, isSigner: false, isWritable: true },
        { pubkey: creator.publicKey, isSigner: true, isWritable: true },
        { pubkey: mint.publicKey, isSigner: false, isWritable: false },
        { pubkey: creatorToken, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: encodeInstruction('initialize_token', {
        amount,
        deadline,
        issueUrl
      })
    });

    const tx = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [creator]
    );

    return { bountyPDA, signature };
  }

  async function submitClaim(bountyPubkey, claimant, prUrl) {
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: bountyPubkey, isSigner: false, isWritable: true },
        { pubkey: claimant.publicKey, isSigner: true, isWritable: false }
      ],
      programId,
      data: encodeInstruction('submit_claim', { prUrl })
    });

    const tx = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [claimant]
    );

    return signature;
  }

  async function approveClaim(bountyPubkey, creator, claimant) {
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: bountyPubkey, isSigner: false, isWritable: true },
        { pubkey: creator.publicKey, isSigner: true, isWritable: false },
        { pubkey: claimant.publicKey, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: encodeInstruction('approve_submission', {})
    });

    const tx = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [creator]
    );

    return signature;
  }

  async function cancelBounty(bountyPubkey, caller) {
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: bountyPubkey, isSigner: false, isWritable: true },
        { pubkey: caller.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: encodeInstruction('cancel_bounty', {})
    });

    const tx = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [caller]
    );

    return signature;
  }

  async function extendDeadline(bountyPubkey, caller, newDeadline) {
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: bountyPubkey, isSigner: false, isWritable: true },
        { pubkey: caller.publicKey, isSigner: true, isWritable: false }
      ],
      programId,
      data: encodeInstruction('extend_deadline', { newDeadline })
    });

    const tx = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [caller]
    );

    return signature;
  }

  // Transaction log parser to verify events
  async function getTransactionLogs(signature) {
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });
    
    return tx?.meta?.logMessages || [];
  }

  function assertEventEmitted(logs, eventName) {
    const eventLog = logs.find(log => log.includes(`Program log: ${eventName}`));
    assert.ok(eventLog, `Expected ${eventName} event to be emitted`);
    return eventLog;
  }

  before(async () => {
    // Fund creator and claimant with SOL
    await fundAccount(creator, 10);
    await fundAccount(claimant, 5);

    // Setup tokens for token bounty tests
    mint = await Token.createMint(
      connection,
      creator,
      creator.publicKey,
      null,
      9,
      TOKEN_PROGRAM_ID
    );

    creatorToken = await mint.createAccount(creator.publicKey);
    bountyToken = await mint.createAccount(program.programId);
    claimantToken = await mint.createAccount(claimant.publicKey);

    // Mint some tokens to creator
    await mint.mintTo(
      creatorToken,
      creator.publicKey,
      [creator],
      1000 * LAMPORTS_PER_SOL
    );
  });

  describe('initialize_bounty', () => {
    it('Valid bounty initialization', async () => {
      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const deadline = new anchor.BN(Date.now() / 1000 + 10); // 10 seconds from now
      const issueUrl = 'https://github.com/example/issue/1';

      const { bountyPDA, signature } = await createBounty(
        creator,
        amount,
        deadline,
        issueUrl
      );

      // Verify state
      const accountInfo = await connection.getAccountInfo(bountyPDA);
      const bountyData = decodeBountyData(accountInfo.data);
      
      assert.equal(bountyData.creator, creator.publicKey.toBase58());
      assert.equal(bountyData.amount, amount.toNumber());
      assert.equal(bountyData.deadline, deadline.toNumber());
      assert.equal(bountyData.issueUrl, issueUrl);
      assert.equal(bountyData.status, 'Open');

      // Verify event
      const logs = await getTransactionLogs(signature);
      const eventLog = assertEventEmitted(logs, 'BountyInitialized');
      assert.ok(eventLog.includes(bountyPDA.toBase58()));
      assert.ok(eventLog.includes(creator.publicKey.toBase58()));
    });

    it('Duplicate bounty ID', async () => {
      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const deadline = new anchor.BN(Date.now() / 1000 + 10);
      const issueUrl = 'https://github.com/example/issue/1';

      await program.rpc.initializeBounty(amount, deadline, issueUrl, {
        accounts: {
          bounty: bountyAccount.publicKey,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator, bountyAccount],
      });

      try {
        await program.rpc.initializeBounty(amount, deadline, issueUrl, {
          accounts: {
            bounty: bountyAccount.publicKey,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator, bountyAccount],
        });
        assert.fail('Expected duplicate bounty ID error');
      } catch (err) {
        assert.equal(err.message, 'Bounty already exists');
      }
    });

    it('Invalid deadline', async () => {
      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const deadline = new anchor.BN(Date.now() / 1000 - 10); // 10 seconds in the past
      const issueUrl = 'https://github.com/example/issue/4';

      try {
        await program.rpc.initializeBounty(amount, deadline, issueUrl, {
          accounts: {
            bounty: bountyAccount.publicKey,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator, bountyAccount],
        });
        assert.fail('Expected invalid deadline error');
      } catch (err) {
        assert.equal(err.message, 'Invalid deadline');
      }
    });

    it('Emits correct event', async () => {
      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const deadline = new anchor.BN(Date.now() / 1000 + 10);
      const issueUrl = 'https://github.com/example/issue/5';

      const tx = await program.rpc.initializeBounty(amount, deadline, issueUrl, {
        accounts: {
          bounty: bountyAccount.publicKey,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator, bountyAccount],
      });

      const event = tx.events.find((e) => e.name === 'BountyInitialized');
      assert.ok(event, 'BountyInitialized event not emitted');
      assert.ok(event.data.bounty.equals(bountyAccount.publicKey));
      assert.ok(event.data.creator.equals(creator.publicKey));
      assert.ok(event.data.amount.eq(amount));
      assert.ok(event.data.deadline.eq(deadline));
      assert.equal(event.data.issueUrl, issueUrl);
    });
  });

  describe('submit_claim', () => {
    let bountyPubkey;

    beforeEach(async () => {
      // Initialize a bounty for each test case
      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const deadline = new anchor.BN(Date.now() / 1000 + 10);
      const issueUrl = 'https://github.com/example/issue/1';

      bountyPubkey = (await PublicKey.findProgramAddress(
        [Buffer.from('bounty'), creator.publicKey.toBuffer()],
        program.programId
      ))[0];

      await program.rpc.initializeBounty(amount, deadline, issueUrl, {
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator],
      });
    });

    it('Valid claim submission', async () => {
      const prUrl = 'https://github.com/example/pr/1';

      await program.rpc.submitClaim(prUrl, {
        accounts: {
          bounty: bountyPubkey,
          claimant: claimant.publicKey,
        },
        signers: [claimant],
      });

      const bounty = await program.account.bounty.fetch(bountyPubkey);
      assert.equal(bounty.claimant, claimant.publicKey);
      assert.equal(bounty.prUrl, prUrl);
      assert.equal(bounty.status, 'Claimed');
    });

    it('Invalid bounty ID', async () => {
      const invalidBountyPubkey = Keypair.generate().publicKey;
      const prUrl = 'https://github.com/example/pr/2';

      try {
        await program.rpc.submitClaim(prUrl, {
          accounts: {
            bounty: invalidBountyPubkey,
            claimant: claimant.publicKey,
          },
          signers: [claimant],
        });
        assert.fail('Expected invalid bounty ID error');
      } catch (err) {
        assert.equal(err.message, 'Invalid bounty ID');
      }
    });

    it('After deadline', async () => {
      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const deadline = new anchor.BN(Date.now() / 1000 - 10); // 10 seconds in the past
      const issueUrl = 'https://github.com/example/issue/6';

      await program.rpc.initializeBounty(amount, deadline, issueUrl, {
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator],
      });

      const prUrl = 'https://github.com/example/pr/3';

      try {
        await program.rpc.submitClaim(prUrl, {
          accounts: {
            bounty: bountyPubkey,
            claimant: claimant.publicKey,
          },
          signers: [claimant],
        });
        assert.fail('Expected submission after deadline error');
      } catch (err) {
        assert.equal(err.message, 'Submission after deadline');
      }
    });

    it('Re-submission allowed (optional)', async () => {
      const prUrl1 = 'https://github.com/example/pr/4';
      const prUrl2 = 'https://github.com/example/pr/5';

      await program.rpc.submitClaim(prUrl1, {
        accounts: {
          bounty: bountyPubkey,
          claimant: claimant.publicKey,
        },
        signers: [claimant],
      });

      await program.rpc.submitClaim(prUrl2, {
        accounts: {
          bounty: bountyPubkey,
          claimant: claimant.publicKey,
        },
        signers: [claimant],
      });

      const bounty = await program.account.bounty.fetch(bountyPubkey);
      assert.equal(bounty.prUrl, prUrl2);
    });

    it('Emits correct event', async () => {
      const prUrl = 'https://github.com/example/pr/6';

      const tx = await program.rpc.submitClaim(prUrl, {
        accounts: {
          bounty: bountyPubkey,
          claimant: claimant.publicKey,
        },
        signers: [claimant],
      });

      const event = tx.events.find((e) => e.name === 'ClaimSubmitted');
      assert.ok(event, 'ClaimSubmitted event not emitted');
      assert.ok(event.data.bounty.equals(bountyPubkey));
      assert.ok(event.data.claimant.equals(claimant.publicKey));
      assert.equal(event.data.prUrl, prUrl);
    });
  });

  describe('approve_submission', () => {
    let bountyPubkey;

    beforeEach(async () => {
      // Initialize a bounty and submit a claim for each test case
      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const deadline = new anchor.BN(Date.now() / 1000 + 10);
      const issueUrl = 'https://github.com/example/issue/7';

      bountyPubkey = (await PublicKey.findProgramAddress(
        [Buffer.from('bounty'), creator.publicKey.toBuffer()],
        program.programId
      ))[0];

      await program.rpc.initializeBounty(amount, deadline, issueUrl, {
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator],
      });

      const prUrl = 'https://github.com/example/pr/7';

      await program.rpc.submitClaim(prUrl, {
        accounts: {
          bounty: bountyPubkey,
          claimant: claimant.publicKey,
        },
        signers: [claimant],
      });
    });

    it('Valid approval', async () => {
      await program.rpc.approveSubmission({
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
          claimant: claimant.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator],
      });

      const bounty = await program.account.bounty.fetch(bountyPubkey);
      assert.equal(bounty.status, 'Completed');

      const claimantBalance = await provider.connection.getBalance(claimant.publicKey);
      assert.ok(claimantBalance > 0);
    });

    it('Non-creator tries to approve', async () => {
      const nonCreator = Keypair.generate();

      try {
        await program.rpc.approveSubmission({
          accounts: {
            bounty: bountyPubkey,
            creator: nonCreator.publicKey,
            claimant: claimant.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [nonCreator],
        });
        assert.fail('Expected non-creator approval error');
      } catch (err) {
        assert.equal(err.message, 'Only bounty creator can approve');
      }
    });

    it('Already paid out', async () => {
      await program.rpc.approveSubmission({
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
          claimant: claimant.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator],
      });

      try {
        await program.rpc.approveSubmission({
          accounts: {
            bounty: bountyPubkey,
            creator: creator.publicKey,
            claimant: claimant.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator],
        });
        assert.fail('Expected already paid out error');
      } catch (err) {
        assert.equal(err.message, 'Already paid out');
      }
    });

    it('Invalid bounty ID', async () => {
      const invalidBountyPubkey = Keypair.generate().publicKey;

      try {
        await program.rpc.approveSubmission({
          accounts: {
            bounty: invalidBountyPubkey,
            creator: creator.publicKey,
            claimant: claimant.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator],
        });
        assert.fail('Expected invalid bounty ID error');
      } catch (err) {
        assert.equal(err.message, 'Invalid bounty ID');
      }
    });

    it('Emits correct event', async () => {
      const tx = await program.rpc.approveSubmission({
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
          claimant: claimant.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator],
      });

      const event = tx.events.find((e) => e.name === 'SubmissionApproved');
      assert.ok(event, 'SubmissionApproved event not emitted');
      assert.ok(event.data.bounty.equals(bountyPubkey));
      assert.ok(event.data.creator.equals(creator.publicKey));
      assert.ok(event.data.claimant.equals(claimant.publicKey));
    });
  });

  describe('cancel_bounty', () => {
    let bountyPubkey;

    beforeEach(async () => {
      // Initialize a bounty for each test case
      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const deadline = new anchor.BN(Date.now() / 1000 + 10);
      const issueUrl = 'https://github.com/example/issue/8';

      bountyPubkey = (await PublicKey.findProgramAddress(
        [Buffer.from('bounty'), creator.publicKey.toBuffer()],
        program.programId
      ))[0];

      await program.rpc.initializeBounty(amount, deadline, issueUrl, {
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator],
      });
    });

    it('Valid cancellation by creator', async () => {
      await program.rpc.cancelBounty({
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator],
      });

      const bounty = await program.account.bounty.fetch(bountyPubkey);
      assert.equal(bounty.status, 'Canceled');

      const creatorBalance = await provider.connection.getBalance(creator.publicKey);
      assert.ok(creatorBalance > 0);
    });

    it('Deadline expired & not claimed', async () => {
      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const deadline = new anchor.BN(Date.now() / 1000 - 10); // 10 seconds in the past
      const issueUrl = 'https://github.com/example/issue/9';

      await program.rpc.initializeBounty(amount, deadline, issueUrl, {
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator],
      });

      await program.rpc.cancelBounty({
        accounts: {
          bounty: bountyPubkey,
          creator: claimant.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [claimant],
      });

      const bounty = await program.account.bounty.fetch(bountyPubkey);
      assert.equal(bounty.status, 'Canceled');

      const creatorBalance = await provider.connection.getBalance(creator.publicKey);
      assert.ok(creatorBalance > 0);
    });

    it('Already paid out', async () => {
      const prUrl = 'https://github.com/example/pr/8';

      await program.rpc.submitClaim(prUrl, {
        accounts: {
          bounty: bountyPubkey,
          claimant: claimant.publicKey,
        },
        signers: [claimant],
      });

      await program.rpc.approveSubmission({
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
          claimant: claimant.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator],
      });

      try {
        await program.rpc.cancelBounty({
          accounts: {
            bounty: bountyPubkey,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator],
        });
        assert.fail('Expected already paid out error');
      } catch (err) {
        assert.equal(err.message, 'Bounty already paid out');
      }
    });

    it('Unauthorized cancellation', async () => {
      const unauthorized = Keypair.generate();

      try {
        await program.rpc.cancelBounty({
          accounts: {
            bounty: bountyPubkey,
            creator: unauthorized.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [unauthorized],
        });
        assert.fail('Expected unauthorized cancellation error');
      } catch (err) {
        assert.equal(err.message, 'Only bounty creator can cancel');
      }
    });

    it('Emits correct event', async () => {
      const tx = await program.rpc.cancelBounty({
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator],
      });

      const event = tx.events.find((e) => e.name === 'BountyCanceled');
      assert.ok(event, 'BountyCanceled event not emitted');
      assert.ok(event.data.bounty.equals(bountyPubkey));
      assert.ok(event.data.creator.equals(creator.publicKey));
    });
  });

  describe('extend_deadline', () => {
    let bountyPubkey;

    beforeEach(async () => {
      // Initialize a bounty for each test case
      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const deadline = new anchor.BN(Date.now() / 1000 + 10);
      const issueUrl = 'https://github.com/example/issue/10';

      bountyPubkey = (await PublicKey.findProgramAddress(
        [Buffer.from('bounty'), creator.publicKey.toBuffer()],
        program.programId
      ))[0];

      await program.rpc.initializeBounty(amount, deadline, issueUrl, {
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator],
      });
    });

    it('Valid extension', async () => {
      const newDeadline = new anchor.BN(Date.now() / 1000 + 20); // 20 seconds from now

      await program.rpc.extendDeadline(newDeadline, {
        accounts: {
          bounty: bountyPubkey,
          creator: creator.publicKey,
        },
        signers: [creator],
      });

      const bounty = await program.account.bounty.fetch(bountyPubkey);
      assert.ok(bounty.deadline.eq(newDeadline));
    });

    it('Unauthorized caller', async () => {
      const newDeadline = new anchor.BN(Date.now() / 1000 + 20);
      const unauthorized = Keypair.generate();

      try {
        await program.rpc.extendDeadline(newDeadline, {
          accounts: {
            bounty: bountyPubkey,
            creator: unauthorized.publicKey,
          },
          signers: [unauthorized],
        });
        assert.fail('Expected unauthorized caller error');
      } catch (err) {
        assert.equal(err.message, 'Only bounty creator can extend deadline');
      }
    });

    it('Invalid new deadline', async () => {
      const newDeadline = new anchor.BN(Date.now() / 1000 - 10); // 10 seconds in the past

      try {
        await program.rpc.extendDeadline(newDeadline, {
          accounts: {
            bounty: bountyPubkey,
            creator: creator.publicKey,
          },
          signers: [creator],
        });
        assert.fail('Expected invalid new deadline error');
      } catch (err) {
        assert.equal(err.message, 'New deadline must be in the future');
      }
    });
  });

  describe('Additional Edge Cases & Checks', () => {
    describe('Escrow Validations', () => {
      it('Funds held in PDA', async () => {
        const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
        const deadline = new anchor.BN(Date.now() / 1000 + 10);
        const issueUrl = 'https://github.com/example/issue/11';

        await program.rpc.initializeBounty(amount, deadline, issueUrl, {
          accounts: {
            bounty: bountyAccount.publicKey,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator, bountyAccount],
        });

        const bountyBalance = await provider.connection.getBalance(bountyAccount.publicKey);
        assert.ok(bountyBalance === amount.toNumber());
      });

      it('PDA balance zero after payout', async () => {
        const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
        const deadline = new anchor.BN(Date.now() / 1000 + 10);
        const issueUrl = 'https://github.com/example/issue/12';

        await program.rpc.initializeBounty(amount, deadline, issueUrl, {
          accounts: {
            bounty: bountyAccount.publicKey,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator, bountyAccount],
        });

        const prUrl = 'https://github.com/example/pr/9';

        await program.rpc.submitClaim(prUrl, {
          accounts: {
            bounty: bountyAccount.publicKey,
            claimant: claimant.publicKey,
          },
          signers: [claimant],
        });

        await program.rpc.approveSubmission({
          accounts: {
            bounty: bountyAccount.publicKey,
            creator: creator.publicKey,
            claimant: claimant.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator],
        });

        const bountyBalance = await provider.connection.getBalance(bountyAccount.publicKey);
        assert.ok(bountyBalance === 0);
      });

      it('Re-entrancy attack prevention', async () => {
        // TODO: Implement test case
        // Attempt to exploit a potential re-entrancy vulnerability
        // Assert that the program is protected against such attacks
      });
    });

    describe('Refund Logic', () => {
      it('Refunds to correct wallet', async () => {
        const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
        const deadline = new anchor.BN(Date.now() / 1000 + 10);
        const issueUrl = 'https://github.com/example/issue/13';

        await program.rpc.initializeBounty(amount, deadline, issueUrl, {
          accounts: {
            bounty: bountyAccount.publicKey,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator, bountyAccount],
        });

        const initialCreatorBalance = await provider.connection.getBalance(creator.publicKey);

        await program.rpc.cancelBounty({
          accounts: {
            bounty: bountyAccount.publicKey,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator],
        });

        const finalCreatorBalance = await provider.connection.getBalance(creator.publicKey);
        assert.ok(finalCreatorBalance > initialCreatorBalance);
      });

      it('Prevent stuck funds', async () => {
        const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
        const deadline = new anchor.BN(Date.now() / 1000 + 10);
        const issueUrl = 'https://github.com/example/issue/14';

        await program.rpc.initializeBounty(amount, deadline, issueUrl, {
          accounts: {
            bounty: bountyAccount.publicKey,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator, bountyAccount],
        });

        await program.rpc.cancelBounty({
          accounts: {
            bounty: bountyAccount.publicKey,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator],
        });

        const bountyBalance = await provider.connection.getBalance(bountyAccount.publicKey);
        assert.ok(bountyBalance === 0);
      });
    });

    describe('Invalid Token Transfers', () => {
      it('Only valid tokens allowed', async () => {
        const invalidMint = await Token.createMint(
          provider.connection,
          creator,
          creator.publicKey,
          null,
          9,
          TOKEN_PROGRAM_ID
        );

        const invalidTokenAccount = await invalidMint.createAccount(creator.publicKey);
        await invalidMint.mintTo(invalidTokenAccount, creator.publicKey, [], 1000);

        const amount = new anchor.BN(100);
        const deadline = new anchor.BN(Date.now() / 1000 + 10);
        const issueUrl = 'https://github.com/example/issue/15';

        try {
          await program.rpc.initializeBounty(amount, deadline, issueUrl, {
            accounts: {
              bounty: bountyAccount.publicKey,
              creator: creator.publicKey,
              mint: invalidMint.publicKey,
              creatorTokenAccount: invalidTokenAccount,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [creator, bountyAccount],
          });
          assert.fail('Expected invalid token mint error');
        } catch (err) {
          assert.equal(err.message, 'Invalid token mint');
        }
      });

      it('Prevent non-whitelisted tokens', async () => {
        // TODO: Implement test case
        // Attempt to use a non-whitelisted token for bounty creation
        // Assert that the program rejects the use of non-whitelisted tokens
      });
    });

    describe('Access Control', () => {
      it('Sensitive functions check creator authority', async () => {
        const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
        const deadline = new anchor.BN(Date.now() / 1000 + 10);
        const issueUrl = 'https://github.com/example/issue/16';

        await program.rpc.initializeBounty(amount, deadline, issueUrl, {
          accounts: {
            bounty: bountyAccount.publicKey,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [creator, bountyAccount],
        });

        const prUrl = 'https://github.com/example/pr/10';

        await program.rpc.submitClaim(prUrl, {
          accounts: {
            bounty: bountyAccount.publicKey,
            claimant: claimant.publicKey,
          },
          signers: [claimant],
        });

        const unauthorized = Keypair.generate();

        try {
          await program.rpc.approveSubmission({
            accounts: {
              bounty: bountyAccount.publicKey,
              creator: unauthorized.publicKey,
              claimant: claimant.publicKey,
              systemProgram: SystemProgram.programId,
            },
            signers: [unauthorized],
          });
          assert.fail('Expected unauthorized approval error');
        } catch (err) {
          assert.equal(err.message, 'Only bounty creator can approve');
        }

        try {
          await program.rpc.cancelBounty({
            accounts: {
              bounty: bountyAccount.publicKey,
              creator: unauthorized.publicKey,
              systemProgram: SystemProgram.programId,
            },
            signers: [unauthorized],
          });
          assert.fail('Expected unauthorized cancellation error');
        } catch (err) {
          assert.equal(err.message, 'Only bounty creator can cancel');
        }
      });
    });
  });

  // Data encoding/decoding functions
  function encodeInstruction(method, params) {
    const buffer = Buffer.alloc(1024);
    let offset = 0;
    
    const methodMap = {
      initialize: 0,
      initialize_test: 0, // Same as initialize but for testing
      initialize_token: 1,
      submit_claim: 2,
      approve_submission: 3,
      approve_token_submission: 4,
      cancel_bounty: 5,
      extend_deadline: 6
    };
    
    buffer.writeUInt8(methodMap[method], offset++);

    switch(method) {
      case 'initialize':
      case 'initialize_test':
      case 'initialize_token':
        buffer.writeBigUInt64LE(BigInt(params.amount), offset);
        offset += 8;
        buffer.writeBigUInt64LE(BigInt(params.deadline), offset);
        offset += 8;
        buffer.write(params.issueUrl, offset, 'utf8');
        offset += params.issueUrl.length;
        break;
        
      case 'submit_claim':
        buffer.write(params.prUrl, offset, 'utf8');
        offset += params.prUrl.length;
        break;
        
      case 'extend_deadline':
        buffer.writeBigUInt64LE(BigInt(params.newDeadline), offset);
        offset += 8;
        break;
    }

    return buffer.slice(0, offset);
  }

  function decodeBountyData(data) {
    return {
      creator: new PublicKey(data.slice(0, 32)).toString(),
      amount: Number(data.readBigUInt64LE(32)),
      deadline: Number(data.readBigUInt64LE(40)),
      status: ['Open', 'Claimed', 'Completed', 'Canceled'][data[48]],
      claimant: new PublicKey(data.slice(49, 81)).toString(),
      prUrl: data.slice(81, 181).toString('utf8').replace(/\0/g, ''),
      issueUrl: data.slice(181, 281).toString('utf8').replace(/\0/g, '')
    };
  }
}); 