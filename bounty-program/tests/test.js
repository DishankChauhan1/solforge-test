const anchor = require('@project-serum/anchor');
const assert = require('assert');
const { SystemProgram, PublicKey, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, Token } = require('@solana/spl-token');

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

  before(async () => {
    // Fund creator and claimant with SOL
    const airdropCreator = await provider.connection.requestAirdrop(
      creator.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropCreator);

    const airdropClaimant = await provider.connection.requestAirdrop(
      claimant.publicKey,
      5 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropClaimant);

    // Setup tokens for token bounty tests
    mint = await Token.createMint(
      provider.connection,
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

  it('Can create a SOL bounty', async () => {
    const bountyAmount = 1 * LAMPORTS_PER_SOL;
    const description = "Fix bug in authentication system";

    await program.rpc.createSolBounty(
      new anchor.BN(bountyAmount),
      description,
      {
        accounts: {
          creator: creator.publicKey,
          bountyAccount: bountyAccount.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator, bountyAccount],
      }
    );

    // Verify the bounty was created correctly
    const bountyData = await program.account.bounty.fetch(bountyAccount.publicKey);
    assert.equal(bountyData.creator.toString(), creator.publicKey.toString());
    assert.equal(bountyData.amount.toString(), bountyAmount.toString());
    assert.equal(bountyData.description, description);
    assert.equal(bountyData.state, { available: {} });
    assert.equal(bountyData.claimant, null);
    assert.equal(bountyData.tokenMint, null);
  });

  it('Can claim a bounty', async () => {
    await program.rpc.claimBounty(
      {
        accounts: {
          claimant: claimant.publicKey,
          bountyAccount: bountyAccount.publicKey,
        },
        signers: [claimant],
      }
    );

    // Verify the bounty was claimed correctly
    const bountyData = await program.account.bounty.fetch(bountyAccount.publicKey);
    assert.equal(bountyData.state, { claimed: {} });
    assert.equal(bountyData.claimant.toString(), claimant.publicKey.toString());
  });

  it('Can complete a bounty', async () => {
    const claimantBalanceBefore = await provider.connection.getBalance(claimant.publicKey);

    await program.rpc.completeBounty(
      {
        accounts: {
          creator: creator.publicKey,
          claimant: claimant.publicKey,
          bountyAccount: bountyAccount.publicKey,
        },
        signers: [creator],
      }
    );

    // Verify bounty state
    const bountyData = await program.account.bounty.fetch(bountyAccount.publicKey);
    assert.equal(bountyData.state, { completed: {} });

    // Verify payment was made
    const claimantBalanceAfter = await provider.connection.getBalance(claimant.publicKey);
    const expectedBalance = claimantBalanceBefore + new anchor.BN(bountyData.amount);
    assert.equal(claimantBalanceAfter.toString(), expectedBalance.toString());
  });

  it('Can create a token bounty', async () => {
    const newBountyAccount = anchor.web3.Keypair.generate();
    const tokenAmount = 100 * LAMPORTS_PER_SOL;
    const description = "Implement new feature";

    await program.rpc.createTokenBounty(
      new anchor.BN(tokenAmount),
      description,
      mint.publicKey,
      {
        accounts: {
          creator: creator.publicKey,
          bountyAccount: newBountyAccount.publicKey,
          creatorToken: creatorToken,
          bountyToken: bountyToken,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        },
        signers: [creator, newBountyAccount],
      }
    );

    // Verify token bounty was created
    const bountyData = await program.account.bounty.fetch(newBountyAccount.publicKey);
    assert.equal(bountyData.creator.toString(), creator.publicKey.toString());
    assert.equal(bountyData.amount.toString(), tokenAmount.toString());
    assert.equal(bountyData.description, description);
    assert.equal(bountyData.state, { available: {} });
    assert.equal(bountyData.tokenMint.toString(), mint.publicKey.toString());
  });

  it('Sets up test accounts', async () => {
    // Airdrop SOL to the creator
    const airdropSig = await provider.connection.requestAirdrop(
      creator.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);
    
    // Airdrop SOL to the claimer
    const airdropSig2 = await provider.connection.requestAirdrop(
      claimant.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig2);
    
    // Airdrop SOL to the webhook authority
    const airdropSig3 = await provider.connection.requestAirdrop(
      bountyAccount.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig3);
  });
  
  it('Creates a bounty', async () => {
    // Build the bounty params
    const bountyAmount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);
    const description = 'Test Bounty';
    const issueUrl = 'https://github.com/test/repo/issues/1';
    const repositoryUrl = 'https://github.com/test/repo';
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 86400); // 1 day from now
    
    // Create bounty with a small platform fee (2%)
    const feePercentage = 200; // 2%
    const feeCollector = provider.wallet.publicKey;
    
    // Create the bounty
    await program.rpc.createSolBounty(
      bountyAmount,
      description,
      issueUrl,
      repositoryUrl,
      deadline,
      feeCollector,
      feePercentage,
      {
        accounts: {
          creator: creator.publicKey,
          bountyAccount: bountyAccount.publicKey,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [creator],
      }
    );
    
    // Verify the bounty was created correctly
    const bounty = await program.account.bounty.fetch(bountyAccount.publicKey);
    assert.equal(bounty.creator.toString(), creator.publicKey.toString());
    assert.equal(bounty.amount.toString(), bountyAmount.toString());
    assert.equal(bounty.description, description);
    assert.equal(bounty.issueUrl, issueUrl);
    assert.equal(bounty.repositoryUrl, repositoryUrl);
    assert.equal(bounty.state, { available: {} });
    assert.equal(bounty.feePercentage, feePercentage);
    assert.equal(bounty.feeCollector.toString(), feeCollector.toString());
  });
  
  it('Registers webhook authority', async () => {
    // Add the webhook authority
    await program.rpc.addWebhookAuthority(
      bountyAccount.publicKey,
      'Test Authority',
      {
        accounts: {
          admin: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [provider.wallet.payer],
      }
    );
    
    // Verify the authority was registered correctly
    const authority = await program.account.webhookAuthority.fetch(bountyAccount.publicKey);
    assert.equal(authority.authority.toString(), bountyAccount.publicKey.toString());
    assert.equal(authority.name, 'Test Authority');
    assert.equal(authority.isActive, true);
  });
  
  it('Locks a bounty with PR URL', async () => {
    // Lock the bounty with a PR URL
    const prUrl = 'https://github.com/test/repo/pull/1';
    
    await program.rpc.lockBounty(
      bountyAccount.publicKey,
      prUrl,
      {
        accounts: {
          claimant: claimant.publicKey,
          bountyAccount: bountyAccount.publicKey,
        },
        signers: [claimant],
      }
    );
    
    // Verify the bounty was locked correctly
    const bounty = await program.account.bounty.fetch(bountyAccount.publicKey);
    assert.equal(bounty.state, { locked: {} });
    assert.equal(bounty.claimant.toString(), claimant.publicKey.toString());
    assert.equal(bounty.prUrl, prUrl);
  });
  
  it('Auto-completes a bounty with fee handling', async () => {
    // Get initial balances
    const claimerInitialBalance = await provider.connection.getBalance(claimant.publicKey);
    const feeCollectorInitialBalance = await provider.connection.getBalance(provider.wallet.publicKey);
    
    // Let's manually calculate expected amounts
    const bounty = await program.account.bounty.fetch(bountyAccount.publicKey);
    const bountyAmount = bounty.amount.toNumber();
    const feeAmount = Math.floor(bountyAmount * (bounty.feePercentage / 10000));
    const claimerAmount = bountyAmount - feeAmount;
    
    // Call the auto-complete function
    const prUrl = 'https://github.com/test/repo/pull/1';
    
    await program.rpc.autoCompleteBounty(
      bountyAccount.publicKey,
      prUrl,
      {
        accounts: {
          webhookAuthority: bountyAccount.publicKey,
          authorityRecord: bountyAccount.publicKey,
          bountyAccount: bountyAccount.publicKey,
          rewardAccount: claimant.publicKey,
          feeAccount: provider.wallet.publicKey,
        },
        signers: [provider.wallet.payer],
      }
    );
    
    // Verify the bounty was completed
    const updatedBounty = await program.account.bounty.fetch(bountyAccount.publicKey);
    assert.equal(updatedBounty.state, { completed: {} });
    assert.notEqual(updatedBounty.completedAt, null);
    
    // Verify balances were updated correctly
    const claimerFinalBalance = await provider.connection.getBalance(claimant.publicKey);
    const feeCollectorFinalBalance = await provider.connection.getBalance(provider.wallet.publicKey);
    
    // Allow for a small margin of error due to transaction fees
    const claimerBalanceDiff = claimerFinalBalance - claimerInitialBalance;
    const feeCollectorBalanceDiff = feeCollectorFinalBalance - feeCollectorInitialBalance;
    
    assert.ok(Math.abs(claimerBalanceDiff - claimerAmount) < 10000); // within 0.00001 SOL
    assert.ok(Math.abs(feeCollectorBalanceDiff - feeAmount) < 10000); // within 0.00001 SOL
    
    console.log('Original amount:', bountyAmount / anchor.web3.LAMPORTS_PER_SOL, 'SOL');
    console.log('Fee amount:', feeAmount / anchor.web3.LAMPORTS_PER_SOL, 'SOL');
    console.log('Claimer amount:', claimerAmount / anchor.web3.LAMPORTS_PER_SOL, 'SOL');
  });
}); 