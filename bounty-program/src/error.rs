use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum BountyError {
    #[error("Invalid amount")]
    InvalidAmount,
    
    #[error("Invalid bounty state")]
    InvalidBountyState,
    
    #[error("Invalid claimant")]
    InvalidClaimant,
    
    #[error("Not enough funds")]
    InsufficientFunds,
    
    #[error("Invalid token account")]
    InvalidTokenAccount,
    
    #[error("Invalid token mint")]
    InvalidTokenMint,
    
    #[error("Bounty already claimed")]
    AlreadyClaimed,
    
    #[error("Invalid creator")]
    InvalidCreator,
    
    #[error("Bounty not claimed")]
    NotClaimed,
}

impl From<BountyError> for ProgramError {
    fn from(e: BountyError) -> Self {
        ProgramError::Custom(e as u32)
    }
} 