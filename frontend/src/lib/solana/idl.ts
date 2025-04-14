import { Idl } from '@project-serum/anchor';

export const IDL: Idl = {
  version: '0.1.0',
  name: 'bounty_program',
  instructions: [
    {
      name: 'createBounty',
      accounts: [
        {
          name: 'creator',
          isMut: true,
          isSigner: true
        },
        {
          name: 'bounty',
          isMut: true,
          isSigner: false
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false
        }
      ],
      args: [
        {
          name: 'issueHash',
          type: 'string'
        },
        {
          name: 'amount',
          type: 'u64'
        }
      ]
    },
    {
      name: 'createTokenBounty',
      accounts: [
        {
          name: 'creator',
          isMut: true,
          isSigner: true
        },
        {
          name: 'bounty',
          isMut: true,
          isSigner: false
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false
        },
        {
          name: 'creatorTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'bountyTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false
        }
      ],
      args: [
        {
          name: 'issueHash',
          type: 'string'
        },
        {
          name: 'amount',
          type: 'u64'
        }
      ]
    },
    {
      name: 'claimBounty',
      accounts: [
        {
          name: 'bounty',
          isMut: true,
          isSigner: false
        },
        {
          name: 'creator',
          isMut: true,
          isSigner: false
        },
        {
          name: 'claimer',
          isMut: true,
          isSigner: true
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false
        }
      ],
      args: [
        {
          name: 'issueHash',
          type: 'string'
        }
      ]
    },
    {
      name: 'claimTokenBounty',
      accounts: [
        {
          name: 'bounty',
          isMut: true,
          isSigner: false
        },
        {
          name: 'creator',
          isMut: false,
          isSigner: false
        },
        {
          name: 'creatorTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'claimer',
          isMut: true,
          isSigner: true
        },
        {
          name: 'claimerTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false
        }
      ],
      args: [
        {
          name: 'issueHash',
          type: 'string'
        }
      ]
    }
  ],
  accounts: [
    {
      name: 'Bounty',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'creator',
            type: 'publicKey'
          },
          {
            name: 'issueHash',
            type: 'string'
          },
          {
            name: 'amount',
            type: 'u64'
          },
          {
            name: 'claimed',
            type: 'bool'
          },
          {
            name: 'claimer',
            type: { option: 'publicKey' }
          },
          {
            name: 'isToken',
            type: 'bool'
          }
        ]
      }
    }
  ],
  errors: [
    {
      code: 6000,
      name: 'BountyAlreadyClaimed',
      msg: 'This bounty has already been claimed'
    },
    {
      code: 6001,
      name: 'InvalidIssueHash',
      msg: 'Invalid issue hash provided'
    },
    {
      code: 6002,
      name: 'InsufficientFunds',
      msg: 'Insufficient funds for bounty'
    }
  ]
}; 