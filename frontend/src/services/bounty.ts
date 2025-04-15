import { collection, doc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { PaymentStatusType } from '../components/payment/PaymentStatus';

// Type for payment events
export interface PaymentEvent {
  type: 'payment_completed' | 'payment_failed' | 'payment_processing';
  bountyId: string;
  bountyTitle: string;
  amount: number;
  currency: string;
  error?: string;
  timestamp: string;
}

/**
 * Get details for a specific bounty
 */
export const getBountyDetails = async (bountyId: string) => {
  try {
    const docRef = doc(db, 'bounties', bountyId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching bounty details:', error);
    throw new Error('Failed to fetch bounty details');
  }
};

/**
 * Fetch transaction history for a user
 */
export const fetchTransactionHistory = async (userId: string) => {
  try {
    // Get all bounties claimed by this user that have payment info
    const bountyQuery = query(
      collection(db, 'bounties'),
      where('claimedBy', '==', userId),
      where('payment', '!=', null)
    );
    
    const paymentHistoryQuery = query(
      collection(db, 'payment_history'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    // Get both bounties and payment history
    const [bountySnapshot, paymentHistorySnapshot] = await Promise.all([
      getDocs(bountyQuery),
      getDocs(paymentHistoryQuery)
    ]);
    
    // Process bounty documents
    const bountyTransactions = bountySnapshot.docs.map(doc => {
      const data = doc.data();
      const payment = data.payment || {};
      
      return {
        id: doc.id,
        bountyId: doc.id,
        bountyTitle: data.title || 'Unknown Bounty',
        status: payment.status || 'pending',
        transactionSignature: payment.transactionSignature,
        amount: data.amount || 0,
        currency: data.currency || 'SOL',
        timestamp: payment.updatedAt?.toDate?.() || new Date()
      };
    });
    
    // Process payment history documents
    const paymentHistoryTransactions = paymentHistorySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        bountyId: data.bountyId || '',
        bountyTitle: data.bountyTitle || 'Unknown Bounty',
        status: data.status as PaymentStatusType || 'pending',
        transactionSignature: data.transactionSignature,
        amount: data.amount || 0,
        currency: data.currency || 'SOL',
        timestamp: data.createdAt?.toDate?.() || new Date()
      };
    });
    
    // Combine and sort by timestamp (descending)
    const allTransactions = [...bountyTransactions, ...paymentHistoryTransactions]
      .sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
    
    return allTransactions;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    throw new Error('Failed to fetch transaction history');
  }
};

/**
 * Set up a real-time listener for payment events
 */
export const listenForPaymentEvents = (userId: string, callback: (event: PaymentEvent) => void) => {
  if (!userId) return () => {};
  
  // Listen to payment history for this user
  const paymentQuery = query(
    collection(db, 'payment_history'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  
  return onSnapshot(paymentQuery, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        const status = data.status;
        
        let eventType: PaymentEvent['type'];
        if (status === 'completed') {
          eventType = 'payment_completed';
        } else if (status === 'failed') {
          eventType = 'payment_failed';
        } else {
          eventType = 'payment_processing';
        }
        
        callback({
          type: eventType,
          bountyId: data.bountyId || '',
          bountyTitle: data.bountyTitle || 'Unknown Bounty',
          amount: data.amount || 0,
          currency: data.currency || 'SOL',
          error: data.error,
          timestamp: data.createdAt?.toDate?.() || new Date()
        });
      }
    });
  });
}; 