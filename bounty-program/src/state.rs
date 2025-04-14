use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::{clock::Clock, Sysvar},
};

#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq)]
pub enum BountyStatus {
    Available,
    Locked,
    Claimed,
    Completed,
    Cancelled,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct Bounty {
    pub creator: Pubkey,
    pub amount: u64,
    pub description: String,
    pub issue_hash: [u8; 32],
    pub issue_url: String,
    pub repository_url: String,
    pub deadline: i64,
    pub state: BountyStatus,
    pub token_mint: Option<Pubkey>,
    pub claimant: Option<Pubkey>,
    pub pr_url: Option<String>,
    pub locked_at: Option<i64>,
    pub claimed_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub created_at: i64,
}

impl Bounty {
    pub const LEN: usize = 32 + 8 + 256 + 32 + 256 + 256 + 8 + 1 + 33 + 33 + 256 + 9 + 9 + 9 + 8;
    
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

    pub fn new_sol_bounty(
        creator: Pubkey,
        amount: u64,
        description: String,
        issue_hash: [u8; 32],
        issue_url: String,
        repository_url: String,
        deadline: i64,
    ) -> Self {
        let clock = Clock::get().unwrap();
        Self {
            creator,
            amount,
            description,
            issue_hash,
            issue_url,
            repository_url,
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

    pub fn new_token_bounty(
        creator: Pubkey,
        amount: u64,
        description: String,
        issue_hash: [u8; 32],
        issue_url: String,
        repository_url: String,
        deadline: i64,
        token_mint: Pubkey,
    ) -> Self {
        let clock = Clock::get().unwrap();
        Self {
            creator,
            amount,
            description,
            issue_hash,
            issue_url,
            repository_url,
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

    pub fn claim(&mut self, claimant: &Pubkey) -> Result<(), ProgramError> {
        if self.state != BountyStatus::Locked {
            return Err(ProgramError::InvalidAccountData);
        }

        if self.claimant != Some(*claimant) {
            return Err(ProgramError::InvalidAccountData);
        }

        let clock = Clock::get().unwrap();
        self.state = BountyStatus::Claimed;
        self.claimed_at = Some(clock.unix_timestamp);
        Ok(())
    }

    pub fn complete(&mut self) -> Result<(), ProgramError> {
        if self.state != BountyStatus::Claimed {
            return Err(ProgramError::InvalidAccountData);
        }

        let clock = Clock::get().unwrap();
        self.state = BountyStatus::Completed;
        self.completed_at = Some(clock.unix_timestamp);
        Ok(())
    }

    pub fn cancel(&mut self) -> Result<(), ProgramError> {
        if self.state != BountyStatus::Available {
            return Err(ProgramError::InvalidAccountData);
        }

        self.state = BountyStatus::Cancelled;
        Ok(())
    }
}