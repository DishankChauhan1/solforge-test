import * as express from 'express';
import * as admin from 'firebase-admin';
import { validateFirebaseIdToken } from '../middleware/auth';

const router = express.Router();

// Protected routes - require authentication
router.use(validateFirebaseIdToken);

/**
 * Get all bounties
 */
router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const bountiesSnapshot = await db.collection('bounties')
      .orderBy('createdAt', 'desc')
      .get();
    
    const bounties = bountiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ success: true, bounties });
  } catch (error) {
    console.error('Error getting bounties:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve bounties' });
  }
});

/**
 * Get bounty by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const bountyId = req.params.id;
    const db = admin.firestore();
    
    const bountyDoc = await db.collection('bounties').doc(bountyId).get();
    
    if (!bountyDoc.exists) {
      return res.status(404).json({ success: false, error: 'Bounty not found' });
    }
    
    const bounty = {
      id: bountyDoc.id,
      ...bountyDoc.data()
    };
    
    res.json({ success: true, bounty });
  } catch (error) {
    console.error('Error getting bounty:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve bounty' });
  }
});

export default router; 