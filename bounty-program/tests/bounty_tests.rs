use {
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
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
    bounty_program::{
        instruction::BountyInstruction,
        state::{Bounty, BountyStatus},
    },
};

#[tokio::test]
async fn test_sol_bounty_creation() {
    let program_id = Pubkey::new_unique();
    let mut program_test = ProgramTest::new(
        "bounty_program",
        program_id,
        processor!(bounty_program::process_instruction),
    );

    // Generate necessary keypairs
    let creator = Keypair::new();
    let bounty_account = Keypair::new();

    // Add creator account with some SOL
    program_test.add_account(
        creator.pubkey(),
        Account {
            lamports: 5_000_000_000, // 5 SOL
            owner: solana_program::system_program::id(),
            executable: false,
            rent_epoch: 0,
            data: vec![],
        },
    );

    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    // Create bounty
    let bounty_amount = 1_000_000_000; // 1 SOL
    let description = "Fix critical bug".to_string();
    let issue_hash = [1u8; 32]; // Create a byte array of 32 1s
    let issue_url = "https://github.com/org/repo/issues/1".to_string();
    let repository_url = "https://github.com/org/repo".to_string();
    let deadline = 1717289999; // Some timestamp in the future

    // Create account for the bounty and transfer SOL
    let rent = Rent::get().unwrap();
    let space = Bounty::LEN;
    let rent_lamports = rent.minimum_balance(space);
    let total_lamports = rent_lamports + bounty_amount;

    let mut transaction = Transaction::new_with_payer(
        &[
            system_instruction::create_account(
                &payer.pubkey(),
                &bounty_account.pubkey(),
                total_lamports,
                space as u64,
                &program_id,
            ),
            system_instruction::transfer(
                &payer.pubkey(),
                &creator.pubkey(),
                total_lamports,
            ),
        ],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer, &bounty_account], recent_blockhash);
    
    banks_client.process_transaction(transaction).await.unwrap();

    // Create the actual bounty
    let create_bounty_ix = BountyInstruction::CreateSolBounty {
        amount: bounty_amount,
        description: description.clone(),
        issue_hash,
        issue_url: issue_url.clone(),
        repository_url: repository_url.clone(),
        deadline,
    };

    let data = borsh::to_vec(&create_bounty_ix).unwrap();
    let accounts = vec![
        solana_program::instruction::AccountMeta::new(creator.pubkey(), true),
        solana_program::instruction::AccountMeta::new(bounty_account.pubkey(), false),
        solana_program::instruction::AccountMeta::new_readonly(solana_program::system_program::id(), false),
    ];

    let instruction = Instruction {
        program_id,
        accounts,
        data,
    };

    let mut transaction = Transaction::new_with_payer(
        &[instruction],
        Some(&creator.pubkey()),
    );
    transaction.sign(&[&creator], recent_blockhash);
    
    banks_client.process_transaction(transaction).await.unwrap();

    // Verify initial state
    let bounty_account = banks_client
        .get_account(bounty_account.pubkey())
        .await
        .unwrap()
        .unwrap();
        
    let bounty: Bounty = borsh::BorshDeserialize::try_from_slice(&bounty_account.data).unwrap();
    assert_eq!(bounty.state, BountyStatus::Available);
    assert_eq!(bounty.amount, bounty_amount);
    assert_eq!(bounty.creator, creator.pubkey());
    assert_eq!(bounty.issue_url, issue_url);
} 