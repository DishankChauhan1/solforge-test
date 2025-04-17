"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("../services/firestore");
(0, globals_1.describe)('User Operations Tests', () => {
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
    (0, globals_1.beforeAll)(async () => {
        // Create test users
        await Promise.all(testUsers.map(user => admin.firestore().collection('users').doc(user.id).set(user)));
    });
    (0, globals_1.afterAll)(async () => {
        // Clean up test data
        await Promise.all(testUsers.map(user => admin.firestore().collection('users').doc(user.id).delete()));
    });
    (0, globals_1.it)('should create a new user with required fields', async () => {
        const newUser = {
            githubUsername: 'newuser',
            githubAvatar: 'https://github.com/newuser.png',
            walletAddress: 'new-user-wallet'
        };
        const userId = 'new-test-user';
        // Create the user
        const createdUser = await (0, firestore_1.createUser)(userId, newUser);
        (0, globals_1.expect)(createdUser.id).toBe(userId);
        // Verify user was created in Firestore
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        (0, globals_1.expect)(userDoc.exists).toBe(true);
        const userData = userDoc.data();
        (0, globals_1.expect)(userData).toMatchObject(newUser);
        // Clean up
        await admin.firestore().collection('users').doc(userId).delete();
    });
    (0, globals_1.it)('should get an existing user by ID', async () => {
        const user = await (0, firestore_1.getUser)(testUsers[0].id);
        (0, globals_1.expect)(user).toBeDefined();
        (0, globals_1.expect)(user?.id).toBe(testUsers[0].id);
        (0, globals_1.expect)(user?.githubUsername).toBe(testUsers[0].githubUsername);
        (0, globals_1.expect)(user?.githubAvatar).toBe(testUsers[0].githubAvatar);
    });
    (0, globals_1.it)('should return null for non-existent user', async () => {
        const user = await (0, firestore_1.getUser)('non-existent-user');
        (0, globals_1.expect)(user).toBeNull();
    });
    (0, globals_1.it)('should update user wallet address', async () => {
        const userId = testUsers[1].id;
        const newWalletAddress = 'new-wallet-address-123';
        // User initially has no wallet address
        let user = await (0, firestore_1.getUser)(userId);
        (0, globals_1.expect)(user?.walletAddress).toBeUndefined();
        // Update wallet address
        await (0, firestore_1.updateUser)(userId, { walletAddress: newWalletAddress });
        // Verify wallet address was updated
        user = await (0, firestore_1.getUser)(userId);
        (0, globals_1.expect)(user?.walletAddress).toBe(newWalletAddress);
        // Reset wallet address
        await (0, firestore_1.updateUser)(userId, { walletAddress: undefined });
    });
    (0, globals_1.it)('should handle field deletions in user updates', async () => {
        const userId = testUsers[0].id;
        // Add a temporary field
        await (0, firestore_1.updateUser)(userId, { temporaryField: 'This should be deleted' });
        // Verify field was added
        let user = await (0, firestore_1.getUser)(userId);
        (0, globals_1.expect)(user?.temporaryField).toBe('This should be deleted');
        // Delete the field by setting it to null
        await (0, firestore_1.updateUser)(userId, { temporaryField: null });
        // Verify field was deleted
        user = await (0, firestore_1.getUser)(userId);
        (0, globals_1.expect)(user?.temporaryField).toBeUndefined();
    });
    (0, globals_1.it)('should update multiple user fields at once', async () => {
        const userId = testUsers[0].id;
        const updates = {
            githubUsername: 'updated-username',
            githubAvatar: 'https://github.com/updated-avatar.png',
            bio: 'This is a new bio'
        };
        // Update multiple fields
        await (0, firestore_1.updateUser)(userId, updates);
        // Verify all fields were updated
        const user = await (0, firestore_1.getUser)(userId);
        (0, globals_1.expect)(user?.githubUsername).toBe(updates.githubUsername);
        (0, globals_1.expect)(user?.githubAvatar).toBe(updates.githubAvatar);
        (0, globals_1.expect)(user?.bio).toBe(updates.bio);
        // Reset to original values
        await (0, firestore_1.updateUser)(userId, {
            githubUsername: testUsers[0].githubUsername,
            githubAvatar: testUsers[0].githubAvatar,
            bio: null
        });
    });
});
//# sourceMappingURL=user-operations.test.js.map