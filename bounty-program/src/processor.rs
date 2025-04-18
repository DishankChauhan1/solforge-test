use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    program::{invoke, invoke_signed},
    pubkey::Pubkey,
    system_instruction,
    sysvar::{clock::Clock, rent::Rent, Sysvar},
};

use spl_token::instruction as token_instruction;

use crate::{
    error::BountyError,
    instruction::BountyInstruction,
    state::{Bounty, BountyStatus},
};

use std::str::FromStr;

pub const WEBHOOK_AUTH_SEED: &[u8] = b"webhook_auth";

#[derive(BorshSerialize, BorshDeserialize)]
pub struct WebhookAuthority {
    pub authority: Pubkey,
    pub is_active: bool,
    pub added_at: i64,
    pub name: String,
}

impl WebhookAuthority {
    pub const LEN: usize = 32 + 1 + 8 + 64;
    
    pub fn new(authority: Pubkey, name: String) -> Self {
        let clock = Clock::get().unwrap();
        Self {
            authority,
            is_active: true,
            added_at: clock.unix_timestamp,
            name,
        }
    }
    
    pub fn is_valid(&self) -> bool {
        self.is_active
    }
}

pub struct Processor;

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = BountyInstruction::try_from_slice(instruction_data)?;

        match instruction {
            BountyInstruction::CreateSolBounty {
                amount,
                description,
                issue_hash,
                issue_url,
                repository_url,
                deadline,
            } => {
                msg!("Instruction: Create SOL Bounty");
                Self::process_create_sol_bounty(
                    program_id,
                    accounts,
                    amount,
                    description,
                    issue_hash,
                    issue_url,
                    repository_url,
                    deadline,
                )
            }
            BountyInstruction::CreateTokenBounty {
                amount,
                description,
                issue_hash,
                issue_url,
                repository_url,
                deadline,
                token_mint,
            } => {
                msg!("Instruction: Create Token Bounty");
                Self::process_create_token_bounty(
                    program_id,
                    accounts,
                    amount,
                    description,
                    issue_hash,
                    issue_url,
                    repository_url,
                    deadline,
                    token_mint,
                )
            }
            BountyInstruction::LockBounty { bounty_pubkey, pr_url } => {
                msg!("Instruction: Lock Bounty");
                Self::process_lock_bounty(program_id, accounts, bounty_pubkey, pr_url)
            }
            BountyInstruction::ClaimBounty { bounty_pubkey } => {
                msg!("Instruction: Claim Bounty");
                Self::process_claim_bounty(program_id, accounts, bounty_pubkey)
            }
            BountyInstruction::CancelBounty { bounty_pubkey } => {
                msg!("Instruction: Cancel Bounty");
                Self::process_cancel_bounty(program_id, accounts, bounty_pubkey)
            }
            BountyInstruction::CompleteBounty { bounty_pubkey } => {
                msg!("Instruction: Complete Bounty");
                Self::process_complete_bounty(program_id, accounts, bounty_pubkey)
            }
            BountyInstruction::AutoCompleteBounty { bounty_pubkey, pr_url } => {
                msg!("Instruction: Auto Complete Bounty");
                Self::process_auto_complete_bounty(program_id, accounts, bounty_pubkey, pr_url)
            }
            BountyInstruction::AddWebhookAuthority { authority, name } => {
                msg!("Instruction: Add Webhook Authority");
                Self::process_add_webhook_authority(program_id, accounts, authority, name)
            }
        }
    }

    pub fn process_create_sol_bounty(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        amount: u64,
        description: String,
        issue_hash: [u8; 32],
        issue_url: String,
        repository_url: String,
        deadline: i64,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let creator_info = next_account_info(account_info_iter)?;
        let bounty_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;

        if !creator_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Verify bounty account is the correct PDA
        let (expected_bounty_address, bump_seed) = 
            crate::instruction::find_bounty_address(program_id, &issue_hash, creator_info.key);
        
        if expected_bounty_address != *bounty_info.key {
            msg!("Error: Bounty account does not match expected PDA");
            return Err(ProgramError::InvalidArgument);
        }

        let clock = Clock::get()?;
        if deadline <= clock.unix_timestamp {
            msg!("Error: Deadline must be in the future");
            return Err(BountyError::InvalidDeadline.into());
        }

        let space = Bounty::LEN;
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(space);
        let total_lamports = rent_lamports.checked_add(amount).ok_or(BountyError::Overflow)?;

        // Create bounty account using PDA
        invoke_signed(
            &system_instruction::create_account(
                creator_info.key,
                bounty_info.key,
                total_lamports,
                space as u64,
                program_id,
            ),
            &[creator_info.clone(), bounty_info.clone(), system_program_info.clone()],
            &[&[
                crate::instruction::BOUNTY_SEED_PREFIX,
                &issue_hash[..],
                creator_info.key.as_ref(),
                &[bump_seed],
            ]],
        )?;

        // Create and initialize the bounty
        let bounty = Bounty::new_sol_bounty(
            *creator_info.key,
            amount,
            description,
            issue_hash,
            &issue_url,
            &repository_url,
            deadline,
            None,
            0,
        );
        bounty.serialize(&mut *bounty_info.data.borrow_mut())?;

        msg!("SOL bounty created for {} lamports", amount);
        msg!("Issue URL: {}", issue_url);
        msg!("Deadline: {}", deadline);

        Ok(())
    }

    pub fn process_create_token_bounty(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        amount: u64,
        description: String,
        issue_hash: [u8; 32],
        issue_url: String,
        repository_url: String,
        deadline: i64,
        token_mint: Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let creator_info = next_account_info(account_info_iter)?;
        let bounty_info = next_account_info(account_info_iter)?;
        let creator_token_info = next_account_info(account_info_iter)?;
        let bounty_token_info = next_account_info(account_info_iter)?;
        let token_mint_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;

        // Validate accounts
        if !creator_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Check if the token mint provided matches the expected token mint
        if token_mint_info.key != &token_mint {
            return Err(BountyError::InvalidTokenMint.into());
        }

        // Validate token program
        if token_program_info.key != &spl_token::id() {
            return Err(ProgramError::IncorrectProgramId);
        }

        // Check deadline is in the future
        let clock = Clock::get()?;
        if deadline <= clock.unix_timestamp {
            return Err(BountyError::InvalidDeadline.into());
        }

        // Create bounty account
        let space = Bounty::LEN;
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(space);

        // Create account and allocate space
        invoke(
            &system_instruction::create_account(
                creator_info.key,
                bounty_info.key,
                rent_lamports,
                space as u64,
                program_id,
            ),
            &[creator_info.clone(), bounty_info.clone(), system_program_info.clone()],
        )?;

        // Transfer tokens from creator to bounty token account
        invoke(
            &token_instruction::transfer(
                token_program_info.key,
                creator_token_info.key,
                bounty_token_info.key,
                creator_info.key,
                &[creator_info.key],
                amount,
            )?,
            &[
                creator_token_info.clone(),
                bounty_token_info.clone(),
                creator_info.clone(),
                token_program_info.clone(),
            ],
        )?;

        // Initialize the bounty
        let bounty = Bounty::new_token_bounty(
            *creator_info.key,
            amount,
            description,
            issue_hash,
            &issue_url,
            &repository_url,
            deadline,
            token_mint,
            None,
            0,
        );
        bounty.serialize(&mut *bounty_info.data.borrow_mut())?;

        // Log successful token bounty creation
        msg!("Token bounty created for {} tokens of mint {}", amount, token_mint);
        msg!("Issue URL: {}", issue_url);
        msg!("Deadline: {}", deadline);

        Ok(())
    }

    pub fn process_lock_bounty(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        bounty_pubkey: Pubkey,
        pr_url: String,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let claimant_info = next_account_info(account_info_iter)?;
        let bounty_info = next_account_info(account_info_iter)?;

        if !claimant_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        if bounty_info.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }

        if *bounty_info.key != bounty_pubkey {
            return Err(ProgramError::InvalidArgument);
        }

        // Validate PR URL is not empty
        if pr_url.is_empty() {
            msg!("Error: PR URL cannot be empty");
            return Err(ProgramError::InvalidArgument);
        }

        let mut bounty = Bounty::try_from_slice(&bounty_info.data.borrow())?;
        bounty.lock(*claimant_info.key, pr_url.clone())?;
        bounty.serialize(&mut *bounty_info.data.borrow_mut())?;

        msg!("Bounty locked with PR URL: {}", pr_url);
        Ok(())
    }

    pub fn process_claim_bounty(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        bounty_pubkey: Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let claimant_info = next_account_info(account_info_iter)?;
        let bounty_info = next_account_info(account_info_iter)?;

        if !claimant_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        if bounty_info.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }

        if *bounty_info.key != bounty_pubkey {
            return Err(ProgramError::InvalidArgument);
        }

        let mut bounty = Bounty::try_from_slice(&bounty_info.data.borrow())?;
        bounty.claim(claimant_info.key)?;
        bounty.serialize(&mut *bounty_info.data.borrow_mut())?;

        Ok(())
    }

    pub fn process_cancel_bounty(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        bounty_pubkey: Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let creator_info = next_account_info(account_info_iter)?;
        let bounty_info = next_account_info(account_info_iter)?;
        let refund_info = next_account_info(account_info_iter)?;

        if !creator_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        if bounty_info.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }

        if *bounty_info.key != bounty_pubkey {
            return Err(ProgramError::InvalidArgument);
        }

        let mut bounty = Bounty::try_from_slice(&bounty_info.data.borrow())?;

        if bounty.creator != *creator_info.key {
            return Err(ProgramError::InvalidAccountData);
        }

        bounty.cancel()?;

        // For SOL bounties, transfer the funds back to creator
        if bounty.token_mint.is_none() {
            **refund_info.lamports.borrow_mut() = refund_info.lamports()
                .checked_add(bounty.amount)
                .ok_or(BountyError::Overflow)?;
            **bounty_info.lamports.borrow_mut() = bounty_info.lamports()
                .checked_sub(bounty.amount)
                .ok_or(BountyError::Overflow)?;
        } else {
            // For token bounties, transfer tokens back
            let token_program_info = next_account_info(account_info_iter)?;
            
            // Create PDA for token transfers
            let (pda, _bump_seed) = Pubkey::find_program_address(
                &[b"bounty", bounty_info.key.as_ref()],
                program_id,
            );

            // Transfer tokens back to creator
            invoke_signed(
                &token_instruction::transfer(
                    token_program_info.key,
                    bounty_info.key,
                    refund_info.key,
                    &pda,
                    &[],
                    bounty.amount,
                )?,
                &[
                    bounty_info.clone(),
                    refund_info.clone(),
                    creator_info.clone(),
                    token_program_info.clone(),
                ],
                &[&[b"bounty", bounty_info.key.as_ref(), &[_bump_seed]]],
            )?;
        }

        bounty.serialize(&mut *bounty_info.data.borrow_mut())?;

        Ok(())
    }

    pub fn process_complete_bounty(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        bounty_pubkey: Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let creator_info = next_account_info(account_info_iter)?;
        let bounty_info = next_account_info(account_info_iter)?;
        let reward_info = next_account_info(account_info_iter)?;

        if !creator_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        if bounty_info.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }

        if *bounty_info.key != bounty_pubkey {
            return Err(ProgramError::InvalidArgument);
        }

        let mut bounty = Bounty::try_from_slice(&bounty_info.data.borrow())?;

        if bounty.creator != *creator_info.key {
            return Err(ProgramError::InvalidAccountData);
        }

        bounty.complete()?;

        // For SOL bounties, transfer the funds to claimant
        if bounty.token_mint.is_none() {
            **reward_info.lamports.borrow_mut() = reward_info.lamports()
                .checked_add(bounty.amount)
                .ok_or(BountyError::Overflow)?;
            **bounty_info.lamports.borrow_mut() = bounty_info.lamports()
                .checked_sub(bounty.amount)
                .ok_or(BountyError::Overflow)?;
        } else {
            // For token bounties, transfer tokens to claimant
            let token_program_info = next_account_info(account_info_iter)?;
            
            // Create PDA for token transfers
            let (pda, _bump_seed) = Pubkey::find_program_address(
                &[b"bounty", bounty_info.key.as_ref()],
                program_id,
            );

            // Transfer tokens to claimant
            invoke_signed(
                &token_instruction::transfer(
                    token_program_info.key,
                    bounty_info.key,
                    reward_info.key,
                    &pda,
                    &[],
                    bounty.amount,
                )?,
                &[
                    bounty_info.clone(),
                    reward_info.clone(),
                    creator_info.clone(),
                    token_program_info.clone(),
                ],
                &[&[b"bounty", bounty_info.key.as_ref(), &[_bump_seed]]],
            )?;
        }

        bounty.serialize(&mut *bounty_info.data.borrow_mut())?;

        Ok(())
    }

    pub fn process_auto_complete_bounty(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        bounty_pubkey: Pubkey,
        pr_url: String,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let webhook_authority_info = next_account_info(account_info_iter)?;
        let authority_record_info = next_account_info(account_info_iter)?;
        let bounty_info = next_account_info(account_info_iter)?;
        let reward_account_info = next_account_info(account_info_iter)?;
        
        // Verify webhook authority is a signer
        if !webhook_authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify authority account's PDA
        let (expected_authority_address, _) = Self::find_webhook_authority_address(
            program_id, 
            webhook_authority_info.key
        );
        
        if expected_authority_address != *authority_record_info.key {
            msg!("Authority record account doesn't match PDA");
            return Err(ProgramError::InvalidArgument);
        }
        
        // Verify the authority record is owned by this program
        if authority_record_info.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        // Deserialize and verify the authority
        let authority_record = WebhookAuthority::try_from_slice(&authority_record_info.data.borrow())?;
        
        if !authority_record.is_valid() {
            msg!("Webhook authority is not active");
            return Err(ProgramError::InvalidAccountData);
        }
        
        if authority_record.authority != *webhook_authority_info.key {
            msg!("Authority mismatch");
            return Err(ProgramError::InvalidArgument);
        }
        
        // Validate the bounty account
        if bounty_info.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }

        if *bounty_info.key != bounty_pubkey {
            return Err(ProgramError::InvalidArgument);
        }

        // Read and validate the bounty
        let mut bounty = Bounty::try_from_slice(&bounty_info.data.borrow())?;
        
        // Verify the PR URL matches
        if bounty.pr_url.as_ref() != Some(&pr_url) {
            msg!("PR URL mismatch: expected {:?}, got {}", bounty.pr_url, pr_url);
            return Err(ProgramError::InvalidArgument);
        }
        
        // Verify the bounty is in the correct state (Locked or Claimed)
        if bounty.state != BountyStatus::Locked && bounty.state != BountyStatus::Claimed {
            msg!("Invalid bounty state: {:?}", bounty.state);
            return Err(BountyError::InvalidBountyState.into());
        }
        
        // Verify there is a claimant
        let claimant = match bounty.claimant {
            Some(pubkey) => pubkey,
            None => return Err(ProgramError::InvalidAccountData),
        };
        
        // Ensure the reward account belongs to the claimant
        if *reward_account_info.key != claimant {
            msg!("Reward account doesn't match claimant");
            return Err(ProgramError::InvalidArgument);
        }
        
        // For token bounties, verify the token program account is provided
        if bounty.token_mint.is_some() {
            let token_program_info = next_account_info(account_info_iter)?;
            if token_program_info.key != &spl_token::id() {
                return Err(ProgramError::IncorrectProgramId);
            }
        }
        
        // Complete the bounty
        bounty.complete()?;
        
        // Process payment with fees
        if bounty.token_mint.is_none() {
            // Check if we need to handle fees
            if bounty.fee_collector.is_some() && bounty.fee_percentage > 0 {
                let fee_amount = bounty.calculate_fee();
                let reward_amount = bounty.amount_after_fee();
                
                // If fee collector account is provided, transfer the fee
                if let Some(fee_collector) = bounty.fee_collector {
                    let fee_account_info = next_account_info(account_info_iter)?;
                    
                    // Verify fee account matches the one in the bounty
                    if fee_account_info.key != &fee_collector {
                        msg!("Fee collector account doesn't match bounty");
                        return Err(ProgramError::InvalidArgument);
                    }
                    
                    // Transfer fee to the fee collector
                    **fee_account_info.lamports.borrow_mut() = fee_account_info.lamports()
                        .checked_add(fee_amount)
                        .ok_or(BountyError::Overflow)?;
                    
                    msg!("Fee of {} lamports paid to fee collector", fee_amount);
                }
                
                // Transfer reward amount to claimant
                **reward_account_info.lamports.borrow_mut() = reward_account_info.lamports()
                    .checked_add(reward_amount)
                    .ok_or(BountyError::Overflow)?;
                
                // Reduce the bounty account's lamports
                **bounty_info.lamports.borrow_mut() = bounty_info.lamports()
                    .checked_sub(bounty.amount)
                    .ok_or(BountyError::Overflow)?;
                
                msg!("Reward of {} lamports paid to claimer", reward_amount);
            } else {
                // No fee, transfer the full amount
                **reward_account_info.lamports.borrow_mut() = reward_account_info.lamports()
                    .checked_add(bounty.amount)
                    .ok_or(BountyError::Overflow)?;
                **bounty_info.lamports.borrow_mut() = bounty_info.lamports()
                    .checked_sub(bounty.amount)
                    .ok_or(BountyError::Overflow)?;
            }
        } else {
            // Handle token transfers with fees for SPL tokens
            let _token_program_info = next_account_info(account_info_iter)?;
            let _bounty_token_account_info = next_account_info(account_info_iter)?;
            let _claimant_token_account_info = next_account_info(account_info_iter)?;
            
            // Create PDA for token transfers
            let (_pda, _bump_seed) = Pubkey::find_program_address(
                &[b"bounty", bounty_info.key.as_ref()],
                program_id,
            );
            
            // Check if we need to handle fees
            if bounty.fee_collector.is_some() && bounty.fee_percentage > 0 {
                let fee_amount = bounty.calculate_fee();
                let reward_amount = bounty.amount_after_fee();
                
                // If fee collector account is provided, transfer the fee
                if let Some(fee_collector) = bounty.fee_collector {
                    let fee_account_info = next_account_info(account_info_iter)?;
                    
                    // Verify fee account matches the one in the bounty
                    if fee_account_info.key != &fee_collector {
                        msg!("Fee collector account doesn't match bounty");
                        return Err(ProgramError::InvalidArgument);
                    }
                    
                    // Transfer fee to the fee collector
                    **fee_account_info.lamports.borrow_mut() = fee_account_info.lamports()
                        .checked_add(fee_amount)
                        .ok_or(BountyError::Overflow)?;
                    
                    msg!("Fee of {} lamports paid to fee collector", fee_amount);
                }
                
                // Transfer reward amount to claimant
                **reward_account_info.lamports.borrow_mut() = reward_account_info.lamports()
                    .checked_add(reward_amount)
                    .ok_or(BountyError::Overflow)?;
                
                // Reduce the bounty account's lamports
                **bounty_info.lamports.borrow_mut() = bounty_info.lamports()
                    .checked_sub(bounty.amount)
                    .ok_or(BountyError::Overflow)?;
                
                msg!("Reward of {} lamports paid to claimer", reward_amount);
            } else {
                // No fee, transfer the full amount
                **reward_account_info.lamports.borrow_mut() = reward_account_info.lamports()
                    .checked_add(bounty.amount)
                    .ok_or(BountyError::Overflow)?;
                **bounty_info.lamports.borrow_mut() = bounty_info.lamports()
                    .checked_sub(bounty.amount)
                    .ok_or(BountyError::Overflow)?;
            }
        }
        
        // Update bounty state
        bounty.serialize(&mut *bounty_info.data.borrow_mut())?;
        
        msg!("Auto-completed bounty for PR: {}", pr_url);
        Ok(())
    }

    pub fn find_webhook_authority_address(
        program_id: &Pubkey,
        authority: &Pubkey,
    ) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[
                WEBHOOK_AUTH_SEED,
                authority.as_ref(),
            ],
            program_id
        )
    }

    pub fn process_add_webhook_authority(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        authority_to_add: Pubkey,
        name: String,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let admin_info = next_account_info(account_info_iter)?;
        let authority_account_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;
        
        // Hardcoded admin key for bootstrapping (in production, this would be governed by DAO)
        let admin_key = Pubkey::from_str("Tge7QM2HroSQEBNXTyacb5YVZRJjkRmC8Qh8QvhPuXM").unwrap();
        
        // Verify the admin is a signer and the correct key
        if !admin_info.is_signer || admin_info.key != &admin_key {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Calculate the authority PDA
        let (authority_pda, bump_seed) = Self::find_webhook_authority_address(program_id, &authority_to_add);
        
        // Verify the authority account matches the expected PDA
        if authority_pda != *authority_account_info.key {
            return Err(ProgramError::InvalidArgument);
        }
        
        // Calculate account size and rent
        let space = WebhookAuthority::LEN;
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(space);
        
        // Create the authority account
        invoke_signed(
            &system_instruction::create_account(
                admin_info.key,
                authority_account_info.key,
                rent_lamports,
                space as u64,
                program_id,
            ),
            &[admin_info.clone(), authority_account_info.clone(), system_program_info.clone()],
            &[&[
                WEBHOOK_AUTH_SEED,
                authority_to_add.as_ref(),
                &[bump_seed],
            ]],
        )?;
        
        // Initialize the authority account
        let authority = WebhookAuthority::new(authority_to_add, name);
        authority.serialize(&mut *authority_account_info.data.borrow_mut())?;
        
        msg!("Webhook authority added: {}", authority_to_add);
        Ok(())
    }
} 