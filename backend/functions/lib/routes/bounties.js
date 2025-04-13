"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPR = exports.claimBountyHandler = exports.createBountyHandler = exports.getBountyById = exports.getAllBounties = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("../services/firestore");
// Get all bounties
exports.getAllBounties = (0, https_1.onCall)(async (request) => {
    try {
        const bounties = await (0, firestore_1.listBounties)();
        return bounties;
    }
    catch (error) {
        console.error('Error getting bounties:', error);
        throw new https_1.HttpsError('internal', 'Error fetching bounties');
    }
});
// Get bounty by ID
exports.getBountyById = (0, https_1.onCall)(async (request) => {
    try {
        const data = request.data;
        const { bountyId } = data;
        if (!bountyId) {
            throw new https_1.HttpsError('invalid-argument', 'Bounty ID is required');
        }
        const bounty = await (0, firestore_1.getBounty)(bountyId);
        if (!bounty) {
            throw new https_1.HttpsError('not-found', 'Bounty not found');
        }
        return bounty;
    }
    catch (error) {
        console.error('Error getting bounty:', error);
        throw new https_1.HttpsError('internal', 'Error fetching bounty');
    }
});
// Create new bounty
exports.createBountyHandler = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const data = request.data;
    const { title, description, amount, tokenMint } = data;
    if (!title || !description || !amount) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    try {
        const bounty = await (0, firestore_1.createBounty)({
            title,
            description,
            amount,
            tokenMint,
            createdBy: request.auth.uid,
            status: 'open'
        });
        return { success: true, bounty };
    }
    catch (error) {
        console.error('Error creating bounty:', error);
        throw new https_1.HttpsError('internal', 'Failed to create bounty');
    }
});
// Claim a bounty
exports.claimBountyHandler = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const data = request.data;
    const { bountyId, prLink } = data;
    if (!bountyId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing bounty ID');
    }
    try {
        const bounty = await (0, firestore_1.getBounty)(bountyId);
        if (!bounty) {
            throw new https_1.HttpsError('not-found', 'Bounty not found');
        }
        if (bounty.status !== 'open') {
            throw new https_1.HttpsError('failed-precondition', 'Bounty is not available for claiming');
        }
        const updatedBounty = await (0, firestore_1.claimBounty)(bountyId, request.auth.uid, prLink || '');
        return { success: true, bounty: updatedBounty };
    }
    catch (error) {
        console.error('Error claiming bounty:', error);
        throw new https_1.HttpsError('internal', 'Failed to claim bounty');
    }
});
exports.verifyPR = (0, https_1.onCall)((request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const data = request.data;
    const { bountyId, prLink } = data;
    if (!bountyId || !prLink) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    // Rest of the verification logic...
});
//# sourceMappingURL=bounties.js.map