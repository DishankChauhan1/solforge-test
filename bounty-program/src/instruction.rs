use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    system_program,
    sysvar::rent,
    program_error::ProgramError,
};

#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq)]
pub enum BountyInstruction {
    /// Create a new bounty with SOL
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Creator account
    /// 1. `[writable]` Bounty account, to be created
    /// 2. `[]` System program
    CreateSolBounty {
        amount: u64,
        description: String,
    },

    /// Create a new bounty with SPL Token
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Creator account
    /// 1. `[writable]` Bounty account, to be created
    /// 2. `[writable]` Creator's token account
    /// 3. `[writable]` Bounty's token account
    /// 4. `[]` Token program
    /// 5. `[]` System program
    CreateTokenBounty {
        amount: u64,
        description: String,
        token_mint: Pubkey,
    },

    /// Claim a bounty
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Claimant account
    /// 1. `[writable]` Bounty account
    ClaimBounty,

    /// Complete a bounty and release funds
    /// 
    /// Accounts expected for SOL bounty:
    /// 0. `[signer]` Creator account
    /// 1. `[writable]` Claimant account
    /// 2. `[writable]` Bounty account
    /// 
    /// Accounts expected for SPL Token bounty:
    /// 0. `[signer]` Creator account
    /// 1. `[writable]` Claimant account
    /// 2. `[writable]` Bounty account
    /// 3. `[]` Token program
    /// 4. `[writable]` Bounty's token account
    /// 5. `[writable]` Claimant's token account
    CompleteBounty,
}

impl BountyInstruction {
    pub fn create_sol_bounty(
        program_id: &Pubkey,
        creator: &Pubkey,
        bounty_account: &Pubkey,
        amount: u64,
        description: String,
    ) -> Result<Instruction, ProgramError> {
        let data = Self::CreateSolBounty {
            amount,
            description,
        };
        let data = borsh::to_vec(&data)?;
        
        Ok(Instruction {
            program_id: *program_id,
            accounts: vec![
                AccountMeta::new(*creator, true),
                AccountMeta::new(*bounty_account, false),
                AccountMeta::new_readonly(system_program::id(), false),
                AccountMeta::new_readonly(rent::id(), false),
            ],
            data,
        })
    }

    pub fn create_token_bounty(
        program_id: &Pubkey,
        creator: &Pubkey,
        bounty_account: &Pubkey,
        creator_token: &Pubkey,
        program_token: &Pubkey,
        token_mint: &Pubkey,
        token_program: &Pubkey,
        amount: u64,
        description: String,
    ) -> Result<Instruction, ProgramError> {
        let data = Self::CreateTokenBounty {
            amount,
            description,
            token_mint: *token_mint,
        };
        let data = borsh::to_vec(&data)?;
        
        Ok(Instruction {
            program_id: *program_id,
            accounts: vec![
                AccountMeta::new(*creator, true),
                AccountMeta::new(*bounty_account, false),
                AccountMeta::new(*creator_token, false),
                AccountMeta::new(*program_token, false),
                AccountMeta::new_readonly(*token_mint, false),
                AccountMeta::new_readonly(*token_program, false),
                AccountMeta::new_readonly(system_program::id(), false),
                AccountMeta::new_readonly(rent::id(), false),
            ],
            data,
        })
    }

    pub fn claim_bounty(
        program_id: &Pubkey,
        claimant: &Pubkey,
        bounty_account: &Pubkey,
    ) -> Result<Instruction, ProgramError> {
        let data = Self::ClaimBounty;
        let data = borsh::to_vec(&data)?;
        
        Ok(Instruction {
            program_id: *program_id,
            accounts: vec![
                AccountMeta::new(*claimant, true),
                AccountMeta::new(*bounty_account, false),
            ],
            data,
        })
    }

    pub fn complete_bounty(
        program_id: &Pubkey,
        creator: &Pubkey,
        bounty_account: &Pubkey,
        claimant: &Pubkey,
        program_token: Option<&Pubkey>,
        claimant_token: Option<&Pubkey>,
        token_program: Option<&Pubkey>,
    ) -> Result<Instruction, ProgramError> {
        let data = borsh::to_vec(&Self::CompleteBounty)?;
        
        let mut accounts = vec![
            AccountMeta::new(*creator, true),
            AccountMeta::new(*bounty_account, false),
            AccountMeta::new(*claimant, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ];

        if let (Some(program_token), Some(claimant_token), Some(token_program)) = 
            (program_token, claimant_token, token_program) {
            accounts.extend_from_slice(&[
                AccountMeta::new(*program_token, false),
                AccountMeta::new(*claimant_token, false),
                AccountMeta::new_readonly(*token_program, false),
            ]);
        }

        Ok(Instruction {
            program_id: *program_id,
            accounts,
            data,
        })
    }
} 