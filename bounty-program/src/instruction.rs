use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    system_program,
    sysvar::rent,
    program_error::ProgramError,
};

/// Seeds used for the bounty PDA derivation
pub const BOUNTY_SEED_PREFIX: &[u8] = b"bounty";

/// Helper function to find the bounty PDA from issue hash
pub fn find_bounty_address(
    program_id: &Pubkey,
    issue_hash: &[u8; 32],
    creator: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            BOUNTY_SEED_PREFIX,
            issue_hash,
            creator.as_ref(),
        ],
        program_id
    )
}

/// Helper function to find the token vault PDA for a bounty
pub fn find_token_vault_address(
    program_id: &Pubkey,
    bounty_address: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            b"vault",
            bounty_address.as_ref(),
        ],
        program_id
    )
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum BountyInstruction {
    /// Creates a new SOL bounty
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The bounty creator
    /// 1. `[writable]` The bounty account to create
    /// 2. `[]` System program
    CreateSolBounty {
        amount: u64,
        description: String,
        issue_hash: [u8; 32],
        issue_url: String,
        repository_url: String,
        deadline: i64,
    },

    /// Creates a new SPL Token bounty
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The bounty creator
    /// 1. `[writable]` The bounty account to create
    /// 2. `[writable]` The creator's token account to transfer from
    /// 3. `[writable]` The bounty's token account to transfer to
    /// 4. `[]` The token mint
    /// 5. `[]` Token program
    /// 6. `[]` System program
    CreateTokenBounty {
        amount: u64,
        description: String,
        issue_hash: [u8; 32],
        issue_url: String,
        repository_url: String,
        deadline: i64,
        token_mint: Pubkey,
    },

    /// Locks a bounty for claiming
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The claimant
    /// 1. `[writable]` The bounty account
    LockBounty {
        bounty_pubkey: Pubkey,
        pr_url: String,
    },

    /// Claims a locked bounty
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The claimant
    /// 1. `[writable]` The bounty account
    ClaimBounty {
        bounty_pubkey: Pubkey,
    },

    /// Cancels an available bounty
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The bounty creator
    /// 1. `[writable]` The bounty account
    /// 2. `[writable]` The creator's refund account (native SOL or token account)
    /// 3. `[]` Token program (if token bounty)
    CancelBounty {
        bounty_pubkey: Pubkey,
    },

    /// Completes a claimed bounty
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The bounty creator
    /// 1. `[writable]` The bounty account
    /// 2. `[writable]` The claimant's reward account (native SOL or token account)
    /// 3. `[]` Token program (if token bounty)
    CompleteBounty {
        bounty_pubkey: Pubkey,
    },
    
    /// Automatically completes a bounty when a PR is merged
    /// This can only be called by authorized GitHub webhook handlers
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The webhook authority (must be on allowlist)
    /// 1. `[writable]` The bounty account
    /// 2. `[writable]` The claimant's reward account (native SOL or token account)
    /// 3. `[]` Token program (if token bounty)
    AutoCompleteBounty {
        bounty_pubkey: Pubkey,
        pr_url: String,
    },

    /// Adds a new authorized webhook caller
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The admin authority (initially hardcoded)
    /// 1. `[writable]` The authority account to create (PDA)
    /// 2. `[]` System program
    AddWebhookAuthority {
        authority: Pubkey,
        name: String,
    },
}

impl BountyInstruction {
    pub fn create_sol_bounty(
        program_id: &Pubkey,
        creator: &Pubkey,
        bounty_account: &Pubkey,
        amount: u64,
        description: String,
        issue_hash: [u8; 32],
        issue_url: String,
        repository_url: String,
        deadline: i64,
        fee_collector: Option<Pubkey>,
        _fee_percentage: u8,
    ) -> Result<Instruction, ProgramError> {
        let data = Self::CreateSolBounty {
            amount,
            description,
            issue_hash,
            issue_url,
            repository_url,
            deadline,
        };
        let data = borsh::to_vec(&data)?;
        
        Ok(Instruction {
            program_id: *program_id,
            accounts: vec![
                AccountMeta::new(*creator, true),
                AccountMeta::new(*bounty_account, false),
                AccountMeta::new_readonly(system_program::id(), false),
                AccountMeta::new_readonly(rent::id(), false),
                if let Some(fee_pubkey) = fee_collector {
                    AccountMeta::new_readonly(fee_pubkey, false)
                } else {
                    AccountMeta::new_readonly(*creator, false)
                },
            ],
            data,
        })
    }

    pub fn create_token_bounty(
        program_id: &Pubkey,
        creator: &Pubkey,
        bounty_account: &Pubkey,
        creator_token: &Pubkey,
        bounty_token: &Pubkey,
        token_mint: &Pubkey,
        token_program: &Pubkey,
        amount: u64,
        description: String,
        issue_hash: [u8; 32],
        issue_url: String,
        repository_url: String,
        deadline: i64,
    ) -> Result<Instruction, ProgramError> {
        let data = Self::CreateTokenBounty {
            amount,
            description,
            issue_hash,
            issue_url,
            repository_url,
            deadline,
            token_mint: *token_mint,
        };
        let data = borsh::to_vec(&data)?;
        
        Ok(Instruction {
            program_id: *program_id,
            accounts: vec![
                AccountMeta::new(*creator, true),
                AccountMeta::new(*bounty_account, false),
                AccountMeta::new(*creator_token, false),
                AccountMeta::new(*bounty_token, false),
                AccountMeta::new_readonly(*token_mint, false),
                AccountMeta::new_readonly(*token_program, false),
                AccountMeta::new_readonly(system_program::id(), false),
                AccountMeta::new_readonly(rent::id(), false),
            ],
            data,
        })
    }

    pub fn lock_bounty(
        program_id: &Pubkey,
        claimant: &Pubkey,
        bounty_account: &Pubkey,
        pr_url: String,
    ) -> Result<Instruction, ProgramError> {
        let data = Self::LockBounty {
            bounty_pubkey: *bounty_account,
            pr_url,
        };
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

    pub fn claim_bounty(
        program_id: &Pubkey,
        claimant: &Pubkey,
        bounty_account: &Pubkey,
    ) -> Result<Instruction, ProgramError> {
        let data = Self::ClaimBounty {
            bounty_pubkey: *bounty_account,
        };
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

    pub fn cancel_bounty(
        program_id: &Pubkey,
        creator: &Pubkey,
        bounty_account: &Pubkey,
        refund_account: &Pubkey,
        token_program: Option<&Pubkey>,
    ) -> Result<Instruction, ProgramError> {
        let data = borsh::to_vec(&Self::CancelBounty {
            bounty_pubkey: *bounty_account,
        })?;
        
        let mut accounts = vec![
            AccountMeta::new(*creator, true),
            AccountMeta::new(*bounty_account, false),
            AccountMeta::new(*refund_account, false),
        ];

        if let Some(token_program) = token_program {
            accounts.push(AccountMeta::new_readonly(*token_program, false));
        }

        Ok(Instruction {
            program_id: *program_id,
            accounts,
            data,
        })
    }

    pub fn complete_bounty(
        program_id: &Pubkey,
        creator: &Pubkey,
        bounty_account: &Pubkey,
        reward_account: &Pubkey,
        token_program: Option<&Pubkey>,
    ) -> Result<Instruction, ProgramError> {
        let data = borsh::to_vec(&Self::CompleteBounty {
            bounty_pubkey: *bounty_account,
        })?;
        
        let mut accounts = vec![
            AccountMeta::new(*creator, true),
            AccountMeta::new(*bounty_account, false),
            AccountMeta::new(*reward_account, false),
        ];

        if let Some(token_program) = token_program {
            accounts.push(AccountMeta::new_readonly(*token_program, false));
        }

        Ok(Instruction {
            program_id: *program_id,
            accounts,
            data,
        })
    }

    pub fn auto_complete_bounty(
        program_id: &Pubkey,
        webhook_authority: &Pubkey,
        bounty_account: &Pubkey,
        reward_account: &Pubkey,
        token_program: Option<&Pubkey>,
        pr_url: String,
    ) -> Result<Instruction, ProgramError> {
        let data = Self::AutoCompleteBounty {
            bounty_pubkey: *bounty_account,
            pr_url,
        };
        let data = borsh::to_vec(&data)?;
        
        Ok(Instruction {
            program_id: *program_id,
            accounts: vec![
                AccountMeta::new(*webhook_authority, true),
                AccountMeta::new(*bounty_account, false),
                AccountMeta::new(*reward_account, false),
                if let Some(token_program) = token_program {
                    AccountMeta::new_readonly(*token_program, false)
                } else {
                    AccountMeta::new_readonly(*webhook_authority, false)
                },
            ],
            data,
        })
    }

    pub fn add_webhook_authority(
        program_id: &Pubkey,
        admin: &Pubkey,
        authority_account: &Pubkey,
        authority_to_add: Pubkey,
        name: String,
    ) -> Result<Instruction, ProgramError> {
        let data = Self::AddWebhookAuthority {
            authority: authority_to_add,
            name,
        };
        let data = borsh::to_vec(&data)?;
        
        Ok(Instruction {
            program_id: *program_id,
            accounts: vec![
                AccountMeta::new(*admin, true),
                AccountMeta::new(*authority_account, false),
                AccountMeta::new_readonly(system_program::id(), false),
            ],
            data,
        })
    }

    /// Unpacks a byte buffer into a BountyInstruction
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        BorshDeserialize::try_from_slice(input).map_err(|_| ProgramError::InvalidInstructionData)
    }
} 