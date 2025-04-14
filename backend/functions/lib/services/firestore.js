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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBountyByPR = exports.approveBounty = exports.claimBounty = exports.listBounties = exports.createBounty = exports.getBounty = exports.getUser = exports.updateUser = exports.createUser = void 0;
exports.updateBountyStatus = updateBountyStatus;
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
    const bountyData = Object.assign(Object.assign({}, data), { createdAt: now, updatedAt: now });
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
//# sourceMappingURL=firestore.js.map