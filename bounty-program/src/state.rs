use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::{clock::Clock, Sysvar},
};

/// Status of a bounty in the system
#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq)]
pub enum BountyStatus {
    /// Bounty is available for claiming
    Available,
    
    /// Bounty is locked to a specific contributor
    Locked,
    
    /// Bounty has been claimed by a contributor
    Claimed,
    
    /// Bounty has been completed and funds transferred
    Completed,
    
    /// Bounty has been cancelled by creator
    Cancelled,
}

/// Bounty account structure that holds all information about a bounty
///
/// This account is created as a PDA (Program Derived Address) based on the
/// issue hash, ensuring one unique bounty per GitHub issue.
///
/// State transitions:
/// - Available -> Locked -> Claimed -> Completed
/// - Available -> Cancelled
#[derive(BorshSerialize, BorshDeserialize)]
pub struct Bounty {
    /// The wallet that created the bounty
    pub creator: Pubkey,
    
    /// Amount of tokens allocated for the bounty (in lamports for SOL, or token amount for SPL tokens)
    pub amount: u64,
    
    /// Description of the bounty task
    pub description: String,
    
    /// Hash of the GitHub issue URL (used as a unique identifier)
    pub issue_hash: [u8; 32],
    
    /// GitHub issue URL in text form
    pub issue_url: String,
    
    /// GitHub repository URL
    pub repository_url: String,
    
    /// Timestamp when the bounty expires
    pub deadline: i64,
    
    /// Current status of the bounty
    pub state: BountyStatus,
    
    /// Token mint address (for SPL token bounties) - None for SOL bounties
    pub token_mint: Option<Pubkey>,
    
    /// Wallet address of the developer who claimed the bounty
    pub claimant: Option<Pubkey>,
    
    /// GitHub PR URL submitted as the solution
    pub pr_url: Option<String>,
    
    /// Timestamp when the bounty was locked
    pub locked_at: Option<i64>,
    
    /// Timestamp when the bounty was claimed
    pub claimed_at: Option<i64>,
    
    /// Timestamp when the bounty was completed (funds transferred)
    pub completed_at: Option<i64>,
    
    /// Timestamp when the bounty was created
    pub created_at: i64,
}

impl Bounty {
    /// Size of the bounty account for space allocation
    pub const LEN: usize = 32 + 8 + 256 + 32 + 256 + 256 + 8 + 1 + 33 + 33 + 256 + 9 + 9 + 9 + 8;
    
    /// Calculate the exact account size needed for a specific bounty
    ///
    /// This calculates more accurately than the constant LEN,
    /// taking into account the actual string lengths.
    pub fn get_account_size(
        description: &str,
        issue_url: &str,
        repository_url: &str,
        pr_url_max_len: usize,
    ) -> usize {
        // Size of fixed fields
        let fixed_size = std::mem::size_of::<Pubkey>() + // creator
            std::mem::size_of::<u64>() + // amount
            std::mem::size_of::<BountyStatus>() + // state
            std::mem::size_of::<Option<Pubkey>>() + // token_mint
            std::mem::size_of::<Option<Pubkey>>() + // claimant
            std::mem::size_of::<i64>() + // deadline
            std::mem::size_of::<Option<i64>>() * 3 + // locked_at, claimed_at, completed_at
            std::mem::size_of::<i64>() + // created_at
            32; // issue_hash [u8; 32]

        // Size of variable length fields
        let string_size = description.len() +
            issue_url.len() +
            repository_url.len() +
            pr_url_max_len; // Maximum size for PR URL

        // Add some buffer for serialization overhead
        fixed_size + string_size + 100 // Buffer for Borsh serialization
    }

    /// Create a new SOL bounty
    ///
    /// Initializes a new bounty using SOL as the reward token
    pub fn new_sol_bounty(
        creator: Pubkey,
        amount: u64,
        description: String,
        issue_hash: [u8; 32],
        issue_url: &str,
        repository_url: &str,
        deadline: i64,
    ) -> Self {
        let clock = Clock::get().unwrap();
        Self {
            creator,
            amount,
            description,
            issue_hash,
            issue_url: issue_url.to_string(),
            repository_url: repository_url.to_string(),
            deadline,
            state: BountyStatus::Available,
            token_mint: None,
            claimant: None,
            pr_url: None,
            locked_at: None,
            claimed_at: None,
            completed_at: None,
            created_at: clock.unix_timestamp,
        }
    }

    /// Create a new SPL token bounty
    ///
    /// Initializes a new bounty using an SPL token (like USDC) as the reward
    pub fn new_token_bounty(
        creator: Pubkey,
        amount: u64,
        description: String,
        issue_hash: [u8; 32],
        issue_url: &str,
        repository_url: &str,
        deadline: i64,
        token_mint: Pubkey,
    ) -> Self {
        let clock = Clock::get().unwrap();
        Self {
            creator,
            amount,
            description,
            issue_hash,
            issue_url: issue_url.to_string(),
            repository_url: repository_url.to_string(),
            deadline,
            state: BountyStatus::Available,
            token_mint: Some(token_mint),
            claimant: None,
            pr_url: None,
            locked_at: None,
            claimed_at: None,
            completed_at: None,
            created_at: clock.unix_timestamp,
        }
    }

    /// Lock a bounty to a specific contributor
    ///
    /// This reserves the bounty for a contributor who intends to work on it.
    /// Ensures bounty is in the Available state before locking.
    pub fn lock(&mut self, claimant: Pubkey, pr_url: String) -> Result<(), ProgramError> {
        if self.state != BountyStatus::Available {
            return Err(ProgramError::InvalidAccountData);
        }

        let clock = Clock::get().unwrap();
        if clock.unix_timestamp >= self.deadline {
            return Err(ProgramError::InvalidAccountData);
        }

        self.state = BountyStatus::Locked;
        self.claimant = Some(claimant);
        self.pr_url = Some(pr_url);
        self.locked_at = Some(clock.unix_timestamp);
        Ok(())
    }

    /// Claim a locked bounty
    ///
    /// This is called when a contributor wants to officially claim the reward.
    /// The bounty must be in Locked state and claimed by the same user who locked it.
    pub fn claim(&mut self, claimant_key: &Pubkey) -> Result<(), ProgramError> {
        if self.state != BountyStatus::Locked {
            return Err(ProgramError::InvalidAccountData);
        }

        if self.claimant.is_none() || &self.claimant.unwrap() != claimant_key {
            return Err(ProgramError::InvalidAccountData);
        }

        let clock = Clock::get().unwrap();
        self.state = BountyStatus::Claimed;
        self.claimed_at = Some(clock.unix_timestamp);
        Ok(())
    }

    /// Complete a claimed bounty
    ///
    /// This is called by the bounty creator to approve the work and release funds.
    /// The bounty must be in Claimed state.
    pub fn complete(&mut self) -> Result<(), ProgramError> {
        if self.state != BountyStatus::Claimed {
            return Err(ProgramError::InvalidAccountData);
        }

        let clock = Clock::get().unwrap();
        self.state = BountyStatus::Completed;
        self.completed_at = Some(clock.unix_timestamp);
        Ok(())
    }

    /// Cancel an available bounty
    ///
    /// This allows the creator to cancel the bounty and reclaim funds,
    /// but only if the bounty hasn't been claimed yet.
    pub fn cancel(&mut self) -> Result<(), ProgramError> {
        if self.state != BountyStatus::Available {
            return Err(ProgramError::InvalidAccountData);
        }

        self.state = BountyStatus::Cancelled;
        Ok(())
    }
}