use borsh::{BorshDeserialize};
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    program_error::ProgramError,
};

// Make modules public so they can be used by external crates
pub mod error;
pub mod instruction;
pub mod processor;
pub mod state;

use crate::instruction::BountyInstruction;

// Program ID - Replace this with your actual program ID after deployment
solana_program::declare_id!("dGBsodouKiYTUyFudwbHdfXJaHWbUEyXhyw7jj4BBeY");

// Declare and export the program's entrypoint
entrypoint!(process_instruction);

// Program entrypoint's implementation
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Unpack instruction data
    let instruction = BountyInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    // Route to the appropriate processor
    match instruction {
        BountyInstruction::CreateSolBounty { amount, description, issue_hash, issue_url, repository_url, deadline } => {
            processor::Processor::process_create_sol_bounty(program_id, accounts, amount, description, issue_hash, issue_url, repository_url, deadline)
        }
        BountyInstruction::CreateTokenBounty { amount, description, issue_hash, issue_url, repository_url, deadline, token_mint } => {
            processor::Processor::process_create_token_bounty(program_id, accounts, amount, description, issue_hash, issue_url, repository_url, deadline, token_mint)
        }
        BountyInstruction::LockBounty { bounty_pubkey, pr_url } => {
            processor::Processor::process_lock_bounty(program_id, accounts, bounty_pubkey, pr_url)
        }
        BountyInstruction::ClaimBounty { bounty_pubkey } => {
            processor::Processor::process_claim_bounty(program_id, accounts, bounty_pubkey)
        }
        BountyInstruction::CancelBounty { bounty_pubkey } => {
            processor::Processor::process_cancel_bounty(program_id, accounts, bounty_pubkey)
        }
        BountyInstruction::CompleteBounty { bounty_pubkey } => {
            processor::Processor::process_complete_bounty(program_id, accounts, bounty_pubkey)
        }
        BountyInstruction::AutoCompleteBounty { bounty_pubkey, pr_url } => {
            processor::Processor::process_auto_complete_bounty(program_id, accounts, bounty_pubkey, pr_url)
        }
        BountyInstruction::AddWebhookAuthority { authority, name } => {
            processor::Processor::process_add_webhook_authority(program_id, accounts, authority, name)
        }
    }
}

// For unit testing
