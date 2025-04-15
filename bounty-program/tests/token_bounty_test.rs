use {
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        program_pack::Pack,
        pubkey::Pubkey,
        system_instruction,
        sysvar::{rent::Rent, Sysvar},
    },
    solana_program_test::*,
    solana_sdk::{
        account::Account,
        signature::{Keypair, Signer},
        transaction::Transaction,
        instruction::Instruction,
    },
    spl_token::{
        instruction as token_instruction,
        state::{Account as TokenAccount, Mint},
        id as token_program_id,
    },
    bounty_program::{
        instruction::{BountyInstruction, find_bounty_address},
        state::{Bounty, BountyStatus},
    },
};

/// Create test environment for token bounty tests
async fn setup_token_test() -> (
    BanksClient,
    Keypair,
    Pubkey,
    Keypair,
    Keypair,
    Pubkey,
    Pubkey,
    Pubkey,
) {
    // Program and test setup
    let program_id = Pubkey::new_unique();
    let mut program_test = ProgramTest::new(
        "bounty_program",
        program_id,
        processor!(bounty_program::process_instruction),
    );

    // Create participants
    let creator = Keypair::new();
    let contributor = Keypair::new();

    // Create USDC mint
    let mint_authority = Keypair::new();
    let mint = Keypair::new();
    let mint_rent = Rent::get().unwrap().minimum_balance(spl_token::state::Mint::LEN);
    
    program_test.add_account(
        mint.pubkey(),
        Account {
            lamports: mint_rent,
            data: vec![0; spl_token::state::Mint::LEN],
            owner: token_program_id(),
            executable: false,
            rent_epoch: 0,
        },
    );

    // Add token accounts
    let creator_token_account = Keypair::new();
    let token_account_rent = Rent::get().unwrap().minimum_balance(spl_token::state::Account::LEN);
    
    program_test.add_account(
        creator_token_account.pubkey(),
        Account {
            lamports: token_account_rent,
            data: vec![0; spl_token::state::Account::LEN],
            owner: token_program_id(),
            executable: false,
            rent_epoch: 0,
        },
    );

    let contributor_token_account = Pubkey::new_unique();

    // Add accounts with balances
    program_test.add_account(
        creator.pubkey(),
        Account {
            lamports: 1_000_000_000,
            data: vec![],
            owner: solana_program::system_program::id(),
            executable: false,
            rent_epoch: 0,
        },
    );

    program_test.add_account(
        contributor.pubkey(),
        Account {
            lamports: 1_000_000_000,
            data: vec![],
            owner: solana_program::system_program::id(),
            executable: false,
            rent_epoch: 0,
        },
    );

    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    // Start the actual test
    (
        banks_client,
        payer,
        program_id,
        creator,
        contributor,
        mint.pubkey(),
        creator_token_account.pubkey(),
        contributor_token_account,
    )
}

#[tokio::test]
async fn test_usdc_bounty_full_flow() {
    // Set up test environment
    let (
        mut banks_client,
        payer,
        program_id,
        creator,
        contributor,
        mint_pubkey,
        creator_token_account,
        contributor_token_account,
    ) = setup_token_test().await;

    // Create bounty parameters
    let bounty_amount = 100_000_000; // 100 USDC (with 6 decimals)
    let description = "Implement USDC withdrawal feature".to_string();
    let issue_hash = [1u8; 32]; // Mock GitHub issue hash
    let issue_url = "https://github.com/org/repo/issues/42".to_string();
    let repository_url = "https://github.com/org/repo".to_string();
    let deadline = 1735689600; // Some timestamp in the future

    // Derive bounty PDA
    let (bounty_pda, _) = find_bounty_address(&program_id, &issue_hash, &creator.pubkey());

    // Create token bounty account
    let create_bounty_ix = BountyInstruction::CreateTokenBounty {
        amount: bounty_amount,
        description: description.clone(),
        issue_hash,
        issue_url: issue_url.clone(),
        repository_url: repository_url.clone(),
        deadline,
        token_mint: mint_pubkey,
    };

    let data = borsh::to_vec(&create_bounty_ix).unwrap();
    let accounts = vec![
        solana_program::instruction::AccountMeta::new(creator.pubkey(), true),
        solana_program::instruction::AccountMeta::new(bounty_pda, false),
        solana_program::instruction::AccountMeta::new(creator_token_account, false),
        solana_program::instruction::AccountMeta::new(contributor_token_account, false),
        solana_program::instruction::AccountMeta::new_readonly(mint_pubkey, false),
        solana_program::instruction::AccountMeta::new_readonly(token_program_id(), false),
        solana_program::instruction::AccountMeta::new_readonly(solana_program::system_program::id(), false),
    ];

    let instruction = Instruction {
        program_id,
        accounts,
        data,
    };

    let mut transaction = Transaction::new_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer, &creator], banks_client.get_latest_blockhash().await.unwrap());
    banks_client.process_transaction(transaction).await.unwrap();

    // Verify bounty creation
    let bounty_account = banks_client.get_account(bounty_pda).await.unwrap().unwrap();
    let bounty = Bounty::try_from_slice(&bounty_account.data).unwrap();
    
    assert_eq!(bounty.creator, creator.pubkey());
    assert_eq!(bounty.amount, bounty_amount);
    assert_eq!(bounty.description, description);
    assert_eq!(bounty.issue_url, issue_url);
    assert_eq!(bounty.repository_url, repository_url);
    assert_eq!(bounty.token_mint, Some(mint_pubkey));
    assert_eq!(bounty.state, BountyStatus::Available);

    // Lock bounty
    let lock_bounty_ix = BountyInstruction::LockBounty {
        bounty_pubkey: bounty_pda,
    };

    let data = borsh::to_vec(&lock_bounty_ix).unwrap();
    let accounts = vec![
        solana_program::instruction::AccountMeta::new(contributor.pubkey(), true),
        solana_program::instruction::AccountMeta::new(bounty_pda, false),
    ];

    let lock_instruction = Instruction {
        program_id,
        accounts,
        data,
    };

    let mut lock_transaction = Transaction::new_with_payer(
        &[lock_instruction],
        Some(&payer.pubkey()),
    );
    lock_transaction.sign(&[&payer, &contributor], banks_client.get_latest_blockhash().await.unwrap());
    banks_client.process_transaction(lock_transaction).await.unwrap();

    // Verify bounty is locked
    let bounty_account = banks_client.get_account(bounty_pda).await.unwrap().unwrap();
    let bounty = Bounty::try_from_slice(&bounty_account.data).unwrap();
    assert_eq!(bounty.state, BountyStatus::Locked);
    assert_eq!(bounty.claimant, Some(contributor.pubkey()));

    // Claim bounty
    let claim_bounty_ix = BountyInstruction::ClaimBounty {
        bounty_pubkey: bounty_pda,
    };

    let data = borsh::to_vec(&claim_bounty_ix).unwrap();
    let accounts = vec![
        solana_program::instruction::AccountMeta::new(contributor.pubkey(), true),
        solana_program::instruction::AccountMeta::new(bounty_pda, false),
    ];

    let claim_instruction = Instruction {
        program_id,
        accounts,
        data,
    };

    let mut claim_transaction = Transaction::new_with_payer(
        &[claim_instruction],
        Some(&payer.pubkey()),
    );
    claim_transaction.sign(&[&payer, &contributor], banks_client.get_latest_blockhash().await.unwrap());
    banks_client.process_transaction(claim_transaction).await.unwrap();

    // Verify bounty is claimed
    let bounty_account = banks_client.get_account(bounty_pda).await.unwrap().unwrap();
    let bounty = Bounty::try_from_slice(&bounty_account.data).unwrap();
    assert_eq!(bounty.state, BountyStatus::Claimed);

    // Complete bounty
    let complete_bounty_ix = BountyInstruction::CompleteBounty {
        bounty_pubkey: bounty_pda,
    };

    let data = borsh::to_vec(&complete_bounty_ix).unwrap();
    let accounts = vec![
        solana_program::instruction::AccountMeta::new(creator.pubkey(), true),
        solana_program::instruction::AccountMeta::new(bounty_pda, false),
        solana_program::instruction::AccountMeta::new(contributor_token_account, false),
        solana_program::instruction::AccountMeta::new_readonly(token_program_id(), false),
    ];

    let complete_instruction = Instruction {
        program_id,
        accounts,
        data,
    };

    let mut complete_transaction = Transaction::new_with_payer(
        &[complete_instruction],
        Some(&payer.pubkey()),
    );
    complete_transaction.sign(&[&payer, &creator], banks_client.get_latest_blockhash().await.unwrap());
    banks_client.process_transaction(complete_transaction).await.unwrap();

    // Verify bounty is completed
    let bounty_account = banks_client.get_account(bounty_pda).await.unwrap().unwrap();
    let bounty = Bounty::try_from_slice(&bounty_account.data).unwrap();
    assert_eq!(bounty.state, BountyStatus::Completed);
} 