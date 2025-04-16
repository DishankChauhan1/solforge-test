import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import * as admin from 'firebase-admin';

import { createUser, getUser, updateUser } from '../services/firestore';

// Mock the User type for tests
interface User {
  githubUsername: string;
  githubAvatar: string;
  walletAddress: string;
  [key: string]: any; // Allow additional properties for testing
}

describe('User Operations Tests', () => {
  const testUsers = [
    {
      id: 'test-user-1',
      githubUsername: 'testuser1',
      githubAvatar: 'https://github.com/testuser1.png',
      walletAddress: 'wallet123'
    },
    {
      id: 'test-user-2',
      githubUsername: 'testuser2',
      githubAvatar: 'https://github.com/testuser2.png'
    }
  ];

  beforeAll(async () => {
    // Create test users
    await Promise.all(testUsers.map(user => 
      admin.firestore().collection('users').doc(user.id).set(user)
    ));
  });

  afterAll(async () => {
    // Clean up test data
    await Promise.all(testUsers.map(user => 
      admin.firestore().collection('users').doc(user.id).delete()
    ));
  });

  it('should create a new user with required fields', async () => {
    const newUser = {
      githubUsername: 'newuser',
      githubAvatar: 'https://github.com/newuser.png',
      walletAddress: 'new-user-wallet'
    };
    
    const userId = 'new-test-user';
    
    // Create the user
    const createdUser = await createUser(userId, newUser);
    
    expect(createdUser.id).toBe(userId);
    
    // Verify user was created in Firestore
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    expect(userDoc.exists).toBe(true);
    
    const userData = userDoc.data();
    expect(userData).toMatchObject(newUser);
    
    // Clean up
    await admin.firestore().collection('users').doc(userId).delete();
  });

  it('should get an existing user by ID', async () => {
    const user = await getUser(testUsers[0].id);
    
    expect(user).toBeDefined();
    expect(user?.id).toBe(testUsers[0].id);
    expect(user?.githubUsername).toBe(testUsers[0].githubUsername);
    expect(user?.githubAvatar).toBe(testUsers[0].githubAvatar);
  });

  it('should return null for non-existent user', async () => {
    const user = await getUser('non-existent-user');
    expect(user).toBeNull();
  });

  it('should update user wallet address', async () => {
    const userId = testUsers[1].id;
    const newWalletAddress = 'new-wallet-address-123';
    
    // User initially has no wallet address
    let user = await getUser(userId);
    expect(user?.walletAddress).toBeUndefined();
    
    // Update wallet address
    await updateUser(userId, { walletAddress: newWalletAddress });
    
    // Verify wallet address was updated
    user = await getUser(userId);
    expect(user?.walletAddress).toBe(newWalletAddress);
    
    // Reset wallet address
    await updateUser(userId, { walletAddress: undefined } as Partial<User>);
  });

  it('should handle field deletions in user updates', async () => {
    const userId = testUsers[0].id;
    
    // Add a temporary field
    await updateUser(userId, { temporaryField: 'This should be deleted' } as any);
    
    // Verify field was added
    let user = await getUser(userId);
    expect(user?.temporaryField).toBe('This should be deleted');
    
    // Delete the field by setting it to null
    await updateUser(userId, { temporaryField: null } as any);
    
    // Verify field was deleted
    user = await getUser(userId);
    expect(user?.temporaryField).toBeUndefined();
  });

  it('should update multiple user fields at once', async () => {
    const userId = testUsers[0].id;
    const updates = {
      githubUsername: 'updated-username',
      githubAvatar: 'https://github.com/updated-avatar.png',
      bio: 'This is a new bio'
    };
    
    // Update multiple fields
    await updateUser(userId, updates);
    
    // Verify all fields were updated
    const user = await getUser(userId);
    expect(user?.githubUsername).toBe(updates.githubUsername);
    expect(user?.githubAvatar).toBe(updates.githubAvatar);
    expect(user?.bio).toBe(updates.bio);
    
    // Reset to original values
    await updateUser(userId, {
      githubUsername: testUsers[0].githubUsername,
      githubAvatar: testUsers[0].githubAvatar,
      bio: null
    } as any);
  });
}); 