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
}); 