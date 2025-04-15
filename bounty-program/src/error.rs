use solana_program::{program_error::ProgramError, decode_error::DecodeError, msg};
use thiserror::Error;
use num_derive::FromPrimitive;
use num_traits::FromPrimitive;

/// Errors that may be returned by the Bounty program.
#[derive(Error, Debug, Clone, PartialEq, FromPrimitive)]
pub enum BountyError {
    /// Invalid instruction data passed to program
    #[error("Invalid instruction data")]
    InvalidInstructionData,

    /// Invalid deadline provided (must be in the future)
    #[error("Invalid deadline (must be in the future)")]
    InvalidDeadline,

    /// Not enough funds to create a bounty
    #[error("Not enough funds to create the bounty")]
    InsufficientFunds,

    /// Unauthorized access - operation requires specific privileges
    #[error("Unauthorized access to this operation")]
    Unauthorized,

    /// Arithmetic overflow
    #[error("Arithmetic overflow")]
    Overflow,

    /// Bounty is already in claimed state
    #[error("Bounty is already claimed")]
    AlreadyClaimed,

    /// Bounty is already in completed state
    #[error("Bounty is already completed")]
    AlreadyCompleted,

    /// Bounty is already in cancelled state
    #[error("Bounty is already cancelled")]
    AlreadyCancelled,

    /// Invalid bounty state for the requested operation
    #[error("Invalid bounty state for this operation")]
    InvalidBountyState,

    /// Deadline has passed
    #[error("Deadline has passed")]
    DeadlinePassed,

    /// Invalid token mint account
    #[error("Invalid token mint account")]
    InvalidTokenMint,

    /// Invalid token account
    #[error("Invalid token account")]
    InvalidTokenAccount,

    /// Bounty account not a PDA
    #[error("Bounty account must be a PDA")]
    NotAPDA,

    /// Invalid issue hash
    #[error("Invalid issue hash")]
    InvalidIssueHash,

    /// Bounty for this issue already exists
    #[error("Bounty for this issue already exists")]
    BountyAlreadyExists,
}

impl From<BountyError> for ProgramError {
    fn from(e: BountyError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl<T> DecodeError<T> for BountyError {
    fn type_of() -> &'static str {
        "BountyError"
    }
}

/// Log a detailed error message and return the error
pub fn log_and_return_error(error: BountyError) -> ProgramError {
    msg!("Error: {}", error.to_string());
    error.into()
} 