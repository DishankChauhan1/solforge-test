use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};
use spl_token::state::Account as TokenAccount;

use crate::{
    error::BountyError,
    instruction::BountyInstruction,
    state::{Bounty, BountyState},
};

pub struct Processor;

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = BountyInstruction::try_from_slice(instruction_data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        match instruction {
            BountyInstruction::CreateSolBounty { amount, description } => {
                Self::process_create_sol_bounty(program_id, accounts, amount, description)
            }
            BountyInstruction::CreateTokenBounty { amount, description, token_mint } => {
                Self::process_create_token_bounty(program_id, accounts, amount, description, token_mint)
            }
            BountyInstruction::ClaimBounty => Self::process_claim_bounty(program_id, accounts),
            BountyInstruction::CompleteBounty => Self::process_complete_bounty(program_id, accounts),
        }
    }

    fn process_create_sol_bounty(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        amount: u64,
        description: String,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let creator_info = next_account_info(account_info_iter)?;
        let bounty_account_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;

        // Ensure the creator is a signer
        if !creator_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Verify the bounty account is owned by the program
        if bounty_account_info.owner != program_id {
            // If not owned, it's a new account. Calculate rent and space
            let rent = Rent::get()?;
            let bounty = Bounty::new_sol_bounty(*creator_info.key, amount, description);
            let serialized_size = borsh::to_vec(&bounty).unwrap().len();
            let rent_lamports = rent.minimum_balance(serialized_size);

            // Create account with correct size and lamports
            invoke(
                &system_instruction::create_account(
                    creator_info.key,
                    bounty_account_info.key,
                    rent_lamports,
                    serialized_size as u64,
                    program_id,
                ),
                &[creator_info.clone(), bounty_account_info.clone(), system_program_info.clone()],
            )?;

            // Transfer the bounty amount to the bounty account
            invoke(
                &system_instruction::transfer(
                    creator_info.key,
                    bounty_account_info.key,
                    amount,
                ),
                &[creator_info.clone(), bounty_account_info.clone(), system_program_info.clone()],
            )?;

            // Save the bounty data
            bounty.serialize(&mut *bounty_account_info.data.borrow_mut())?;
        } else {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        Ok(())
    }

    fn process_create_token_bounty(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        amount: u64,
        description: String,
        token_mint: Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let creator_info = next_account_info(account_info_iter)?;
        let bounty_account_info = next_account_info(account_info_iter)?;
        let creator_token_account_info = next_account_info(account_info_iter)?;
        let bounty_token_account_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;

        // Ensure the creator is a signer
        if !creator_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Verify the bounty account is owned by the program
        if bounty_account_info.owner != program_id {
            // If not owned, it's a new account. Calculate rent and space
            let rent = Rent::get()?;
            let bounty = Bounty::new_token_bounty(*creator_info.key, amount, description, token_mint);
            let serialized_size = borsh::to_vec(&bounty).unwrap().len();
            let rent_lamports = rent.minimum_balance(serialized_size);

            // Create account with correct size and lamports
            invoke(
                &system_instruction::create_account(
                    creator_info.key,
                    bounty_account_info.key,
                    rent_lamports,
                    serialized_size as u64,
                    program_id,
                ),
                &[creator_info.clone(), bounty_account_info.clone(), system_program_info.clone()],
            )?;

            // Transfer tokens to the bounty token account
            invoke(
                &spl_token::instruction::transfer(
                    token_program_info.key,
                    creator_token_account_info.key,
                    bounty_token_account_info.key,
                    creator_info.key,
                    &[],
                    amount,
                )?,
                &[
                    creator_token_account_info.clone(),
                    bounty_token_account_info.clone(),
                    creator_info.clone(),
                    token_program_info.clone(),
                ],
            )?;

            // Save the bounty data
            bounty.serialize(&mut *bounty_account_info.data.borrow_mut())?;
        } else {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        Ok(())
    }

    fn process_claim_bounty(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let claimant_info = next_account_info(account_info_iter)?;
        let bounty_account_info = next_account_info(account_info_iter)?;

        // Ensure the claimant is a signer
        if !claimant_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Ensure the bounty account is owned by the program
        if bounty_account_info.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }

        // Deserialize the bounty data
        let mut bounty = Bounty::try_from_slice(&bounty_account_info.data.borrow())?;

        // Ensure the bounty is available
        if bounty.state != BountyState::Available {
            return Err(BountyError::InvalidBountyState.into());
        }

        // Update the bounty state and claimant
        bounty.state = BountyState::Claimed;
        bounty.claimant = Some(*claimant_info.key);

        // Save the updated bounty data
        bounty.serialize(&mut *bounty_account_info.data.borrow_mut())?;

        Ok(())
    }

    fn process_complete_bounty(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let creator_info = next_account_info(account_info_iter)?;
        let claimant_info = next_account_info(account_info_iter)?;
        let bounty_account_info = next_account_info(account_info_iter)?;

        // Ensure the creator is a signer
        if !creator_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Ensure the bounty account is owned by the program
        if bounty_account_info.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }

        // Deserialize the bounty data
        let mut bounty = Bounty::try_from_slice(&bounty_account_info.data.borrow())?;

        // Ensure the creator is the actual creator
        if bounty.creator != *creator_info.key {
            return Err(BountyError::InvalidCreator.into());
        }

        // Ensure the bounty is claimed
        if bounty.state != BountyState::Claimed {
            return Err(BountyError::InvalidBountyState.into());
        }

        // Ensure the claimant matches
        if bounty.claimant.unwrap() != *claimant_info.key {
            return Err(BountyError::InvalidClaimant.into());
        }

        // If it's a token bounty, handle token transfer
        if let Some(token_mint) = bounty.token_mint {
            let token_program_info = next_account_info(account_info_iter)?;
            let bounty_token_account_info = next_account_info(account_info_iter)?;
            let claimant_token_account_info = next_account_info(account_info_iter)?;

            // Verify token accounts
            let bounty_token_account = TokenAccount::unpack(&bounty_token_account_info.data.borrow())?;
            if bounty_token_account.mint != token_mint {
                return Err(BountyError::InvalidTokenMint.into());
            }

            let claimant_token_account = TokenAccount::unpack(&claimant_token_account_info.data.borrow())?;
            if claimant_token_account.mint != token_mint {
                return Err(BountyError::InvalidTokenMint.into());
            }

            // Transfer tokens from bounty account to claimant
            invoke(
                &spl_token::instruction::transfer(
                    token_program_info.key,
                    bounty_token_account_info.key,
                    claimant_token_account_info.key,
                    bounty_account_info.key,
                    &[],
                    bounty.amount,
                )?,
                &[
                    bounty_token_account_info.clone(),
                    claimant_token_account_info.clone(),
                    bounty_account_info.clone(),
                    token_program_info.clone(),
                ],
            )?;
        } else {
            // For SOL bounties, transfer lamports directly
            **claimant_info.lamports.borrow_mut() = claimant_info.lamports().checked_add(bounty.amount)
                .ok_or(BountyError::InvalidAmount)?;
            **bounty_account_info.lamports.borrow_mut() = bounty_account_info.lamports().checked_sub(bounty.amount)
                .ok_or(BountyError::InsufficientFunds)?;
        }

        // Update the bounty state
        bounty.state = BountyState::Completed;

        // Save the updated bounty data
        bounty.serialize(&mut *bounty_account_info.data.borrow_mut())?;

        Ok(())
    }
} 