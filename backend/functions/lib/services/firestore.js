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
exports.updateBountyPayment = exports.updateBountyWithPR = exports.getBountyByRepo = exports.getBountyByIssueUrl = exports.updateBountyStatus = exports.getBountyByPR = exports.approveBounty = exports.claimBounty = exports.listBounties = exports.createBounty = exports.getBounty = exports.getUser = exports.updateUser = exports.createUser = void 0;
const admin = __importStar(require("firebase-admin"));
// Get Firestore instance
const getDb = () => {
    if (!admin.apps.length) {
        admin.initializeApp();
    }
    return admin.firestore();
};
// User Operations
const createUser = async (userId, userData) => {
    const db = getDb();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const user = Object.assign(Object.assign({}, userData), { createdAt: timestamp, updatedAt: timestamp });
    await db.collection('users').doc(userId).set(user);
    const userDoc = await db.collection('users').doc(userId).get();
    return Object.assign({ id: userDoc.id }, userDoc.data());
};
exports.createUser = createUser;
const updateUser = async (userId, userData) => {
    const db = getDb();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('users').doc(userId).update(Object.assign(Object.assign({}, userData), { updatedAt: timestamp }));
    const userDoc = await db.collection('users').doc(userId).get();
    return Object.assign({ id: userDoc.id }, userDoc.data());
};
exports.updateUser = updateUser;
const getUser = async (userId) => {
    const db = getDb();
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.exists ? Object.assign({ id: userDoc.id }, userDoc.data()) : null;
};
exports.getUser = getUser;
const getBounty = async (bountyId) => {
    const db = getDb();
    const bountyDoc = await db.collection('bounties').doc(bountyId).get();
    if (!bountyDoc.exists) {
        return null;
    }
    const data = bountyDoc.data();
    return Object.assign({ id: bountyDoc.id }, data);
};
exports.getBounty = getBounty;
const createBounty = async (data) => {
    const db = getDb();
    const now = admin.firestore.Timestamp.now();
    // Create a clean data object without undefined values
    const bountyData = {
        title: data.title,
        description: data.description,
        amount: data.amount,
        issueUrl: data.issueUrl,
        repositoryUrl: data.repositoryUrl,
        createdBy: data.createdBy,
        status: data.status,
        createdAt: now,
        updatedAt: now
    };
    // Only add tokenMint if defined
    if (data.tokenMint) {
        bountyData.tokenMint = data.tokenMint;
    }
    const docRef = await db.collection('bounties').add(bountyData);
    const doc = await docRef.get();
    const savedData = doc.data();
    return Object.assign({ id: doc.id }, savedData);
};
exports.createBounty = createBounty;
const listBounties = async (status) => {
    const db = getDb();
    let query = db.collection('bounties');
    if (status) {
        query = query.where('status', '==', status);
    }
    query = query.orderBy('createdAt', 'desc');
    const bounties = await query.get();
    return bounties.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
};
exports.listBounties = listBounties;
const claimBounty = async (bountyId, userId, pullRequestUrl) => {
    const db = getDb();
    const bountyRef = db.collection('bounties').doc(bountyId);
    const now = admin.firestore.Timestamp.now();
    const updateData = {
        status: 'claimed',
        claimedBy: userId,
        claimedAt: now,
        claimPR: pullRequestUrl,
        updatedAt: now,
    };
    await bountyRef.update(updateData);
    const updatedDoc = await bountyRef.get();
    const updatedData = updatedDoc.data();
    return Object.assign({ id: updatedDoc.id }, updatedData);
};
exports.claimBounty = claimBounty;
const approveBounty = async (bountyId) => {
    const db = getDb();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('bounties').doc(bountyId).update({
        status: 'approved',
        updatedAt: timestamp,
    });
    const bountyDoc = await db.collection('bounties').doc(bountyId).get();
    return Object.assign({ id: bountyDoc.id }, bountyDoc.data());
};
exports.approveBounty = approveBounty;
const getBountyByPR = async (prUrl) => {
    const db = getDb();
    const bountySnapshot = await db.collection('bounties')
        .where('claimPR', '==', prUrl)
        .limit(1)
        .get();
    if (bountySnapshot.empty) {
        return null;
    }
    const doc = bountySnapshot.docs[0];
    return Object.assign({ id: doc.id }, doc.data());
};
exports.getBountyByPR = getBountyByPR;
async function updateBountyStatus(bountyId, status, metadata) {
    try {
        const bountyRef = getDb().collection('bounties').doc(bountyId);
        await bountyRef.update(Object.assign({ status, updatedAt: admin.firestore.Timestamp.now() }, (metadata && { statusMetadata: metadata })));
    }
    catch (error) {
        console.error('Error updating bounty status:', error);
        throw error;
    }
}
exports.updateBountyStatus = updateBountyStatus;
// Get a bounty by its issue URL
const getBountyByIssueUrl = async (issueUrl) => {
    const db = getDb();
    const bountySnapshot = await db.collection('bounties')
        .where('issueUrl', '==', issueUrl)
        .limit(1)
        .get();
    if (bountySnapshot.empty) {
        return null;
    }
    const doc = bountySnapshot.docs[0];
    return Object.assign({ id: doc.id }, doc.data());
};
exports.getBountyByIssueUrl = getBountyByIssueUrl;
// Get bounties by repository URL
const getBountyByRepo = async (repositoryUrl) => {
    const db = getDb();
    const bountySnapshot = await db.collection('bounties')
        .where('repositoryUrl', '==', repositoryUrl)
        .get();
    if (bountySnapshot.empty) {
        return [];
    }
    return bountySnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
};
exports.getBountyByRepo = getBountyByRepo;
// Update a bounty with PR information
const updateBountyWithPR = async (bountyId, prUrl, githubUsername) => {
    const db = getDb();
    const bountyRef = db.collection('bounties').doc(bountyId);
    const now = admin.firestore.Timestamp.now();
    const updateData = {
        claimPR: prUrl,
        updatedAt: now
    };
    if (githubUsername) {
        updateData.prSubmitterGithubUsername = githubUsername;
    }
    await bountyRef.update(updateData);
};
exports.updateBountyWithPR = updateBountyWithPR;
/**
 * Update payment information for a bounty
 * This tracks payment status, transactions, and error handling
 */
const updateBountyPayment = async (bountyId, paymentData) => {
    const db = getDb();
    const bountyRef = db.collection('bounties').doc(bountyId);
    const now = admin.firestore.Timestamp.now();
    // Create payment tracking structure if it doesn't exist
    const updateData = {
        updatedAt: now,
        payment: Object.assign(Object.assign({}, paymentData), { updatedAt: now })
    };
    await bountyRef.update(updateData);
    // Also update a separate payment history record for audit
    const paymentHistoryRef = db.collection('payment_history').doc();
    await paymentHistoryRef.set(Object.assign(Object.assign({ bountyId }, paymentData), { createdAt: now, updatedAt: now }));
    // Log the payment update
    console.log(`Updated payment information for bounty ${bountyId}:`, paymentData);
};
exports.updateBountyPayment = updateBountyPayment;
//# sourceMappingURL=firestore.js.map