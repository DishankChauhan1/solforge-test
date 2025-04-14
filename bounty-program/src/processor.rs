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

pub struct Processor;

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = BountyInstruction::unpack(instruction_data)?;

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
            BountyInstruction::LockBounty { bounty_pubkey } => {
                msg!("Instruction: Lock Bounty");
                Self::process_lock_bounty(program_id, accounts, bounty_pubkey)
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

        let clock = Clock::get()?;
        if deadline <= clock.unix_timestamp {
            return Err(BountyError::InvalidDeadline.into());
        }

        let space = Bounty::LEN;
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(space);
        let total_lamports = rent_lamports.checked_add(amount).ok_or(BountyError::Overflow)?;

        // Create bounty account
        invoke(
            &system_instruction::create_account(
                creator_info.key,
                bounty_info.key,
                total_lamports,
                space as u64,
                program_id,
            ),
            &[creator_info.clone(), bounty_info.clone(), system_program_info.clone()],
        )?;

        let bounty = Bounty::new_sol_bounty(
            *creator_info.key,
            amount,
            description,
            issue_hash,
            issue_url,
            repository_url,
            deadline,
        );
        bounty.serialize(&mut *bounty_info.data.borrow_mut())?;

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

        if !creator_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let clock = Clock::get()?;
        if deadline <= clock.unix_timestamp {
            return Err(BountyError::InvalidDeadline.into());
        }

        let space = Bounty::LEN;
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(space);

        // Create bounty account
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

        // Transfer tokens to bounty account
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

        let bounty = Bounty::new_token_bounty(
            *creator_info.key,
            amount,
            description,
            issue_hash,
            issue_url,
            repository_url,
            deadline,
            *token_mint_info.key,
        );
        bounty.serialize(&mut *bounty_info.data.borrow_mut())?;

        Ok(())
    }

    pub fn process_lock_bounty(
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
        bounty.lock(*claimant_info.key, "".to_string())?;
        bounty.serialize(&mut *bounty_info.data.borrow_mut())?;

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
} 