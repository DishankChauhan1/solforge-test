use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    program_pack::{IsInitialized, Sealed},
    pubkey::Pubkey,
};

/// The possible states of a bounty
#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq, Clone, Copy)]
pub enum BountyState {
    /// Bounty is available to be claimed
    Available,
    /// Bounty has been claimed by someone
    Claimed,
    /// Bounty has been completed and paid out
    Completed,
}

/// Structure representing a bounty
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Bounty {
    /// The account that created the bounty
    pub creator: Pubkey,
    /// The amount of the bounty in lamports or tokens
    pub amount: u64,
    /// Description of the bounty
    pub description: String,
    /// Current state of the bounty
    pub state: BountyState,
    /// Account that claimed the bounty (Some if claimed, None otherwise)
    pub claimant: Option<Pubkey>,
    /// Token mint if this is a token bounty (None for SOL bounties)
    pub token_mint: Option<Pubkey>,
    pub initialized: bool,
}

impl Sealed for Bounty {}
impl IsInitialized for Bounty {
    fn is_initialized(&self) -> bool {
        self.initialized
    }
}

impl Bounty {
    /// Calculate the size needed for a bounty account
    pub fn get_account_size(description: &str) -> usize {
        // Size of fixed fields + size of variable length fields
        // Pubkey (32) + u64 (8) + String (4 + len) + BountyState (1) + Option<Pubkey> (1 + 32) + Option<Pubkey> (1 + 32)
        32 + 8 + (4 + description.len()) + 1 + (1 + 32) + (1 + 32)
    }

    pub fn new(creator: Pubkey, amount: u64, description: String, token_mint: Option<Pubkey>) -> Self {
        Self {
            creator,
            amount,
            description,
            state: BountyState::Available,
            claimant: None,
            token_mint,
            initialized: true,
        }
    }

    pub fn new_sol_bounty(creator: Pubkey, amount: u64, description: String) -> Self {
        Self {
            creator,
            amount,
            description,
            state: BountyState::Available,
            claimant: None,
            token_mint: None,
            initialized: true,
        }
    }

    pub fn new_token_bounty(creator: Pubkey, amount: u64, description: String, token_mint: Pubkey) -> Self {
        Self {
            creator,
            amount,
            description,
            state: BountyState::Available,
            claimant: None,
            token_mint: Some(token_mint),
            initialized: true,
        }
    }
} 