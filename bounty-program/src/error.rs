use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum BountyError {
    #[error("Invalid deadline")]
    InvalidDeadline,

    #[error("Bounty has expired")]
    BountyExpired,

    #[error("Invalid bounty state")]
    InvalidBountyState,

    #[error("Invalid creator")]
    InvalidCreator,

    #[error("Invalid claimant")]
    InvalidClaimant,

    #[error("Arithmetic overflow")]
    Overflow,
}

impl From<BountyError> for ProgramError {
    fn from(e: BountyError) -> Self {
        ProgramError::Custom(e as u32)
    }
} 