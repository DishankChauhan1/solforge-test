'use client';

import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { 
  Auth,
  User,
  getAuth,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  updateDoc,
  serverTimestamp, 
  getFirestore, 
  Firestore,
  FieldValue,
  Timestamp
} from 'firebase/firestore';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth, getFirebaseFirestore } from '@/lib/firebase';
import { IUser, UserRole } from '@/types/user';
import { signInWithGoogle as signInWithGoogleAuth, signInWithGithub as signInWithGithubAuth } from '@/lib/auth';

interface AuthContextType {
  user: IUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
  forceRefresh: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signInWithGoogle: async () => {},
  signInWithGithub: async () => {},
  signOut: async () => {},
  forceRefresh: () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const router = useRouter();

  // Force refresh function to trigger re-auth check
  const forceRefresh = () => {
    console.log('Force refreshing auth state');
    setRefreshCounter(prev => prev + 1);
  };

  // Check initial auth state
  useEffect(() => {
    console.log('Checking current auth state...');
    // Check if user is already logged in
    const currentUser = auth.currentUser;
    if (currentUser) {
      console.log('User already logged in:', currentUser.uid);
      // Trigger user data fetch
      fetchUserData(currentUser);
    } else {
      console.log('No user currently logged in');
    }
  }, []);

  // Fetch user data from Firestore
  const fetchUserData = async (firebaseUser: User) => {
    try {
      console.log('Fetching user data from Firestore for:', firebaseUser.uid);
      
      // Fetch user data from Firestore
      const db = getFirebaseFirestore();
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        // Convert Firestore document to IUser
        const userData = userSnap.data();
        console.log('User data found in Firestore:', userData);
        setUser({
          ...userData as IUser,
        });
        
        // Update lastLogin timestamp
        await updateDoc(userRef, {
          lastLogin: serverTimestamp()
        });
      } else {
        console.log('Creating new user document in Firestore');
        // Create new user document if it doesn't exist
        const newUser: IUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || '',
          photoURL: firebaseUser.photoURL || '',
          role: 'hunter' as UserRole,
          createdAt: serverTimestamp() as Timestamp,
          lastLogin: serverTimestamp() as Timestamp,
        };
        
        await setDoc(userRef, newUser);
        console.log('New user created:', newUser);
        setUser(newUser);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Set basic user data from Firebase Auth
      const basicUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || '',
        photoURL: firebaseUser.photoURL || '',
        role: 'hunter' as UserRole,
        createdAt: serverTimestamp() as Timestamp,
        lastLogin: serverTimestamp() as Timestamp,
      };
      console.log('Using basic user data as fallback:', basicUser);
      setUser(basicUser);
    } finally {
      setLoading(false);
    }
  };

  // Set up auth state listener
  useEffect(() => {
    console.log('Setting up auth state listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? `User: ${firebaseUser.uid}` : 'No user');
      
      if (firebaseUser) {
        await fetchUserData(firebaseUser);
      } else {
        // User is signed out
        console.log('User signed out');
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      console.log('Cleaning up auth state listener');
      unsubscribe();
    };
  }, [refreshCounter]);

  // Sign in with email/password
  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      console.log('Signing in with email:', email);
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Email sign-in successful:', result.user.uid);
      // Manually refresh to trigger immediate user data fetch
      forceRefresh();
      // Manually redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Email sign-in error:', error);
      setLoading(false);
      throw error;
    }
  };

  // Sign up with email/password
  const signUpWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      console.log('Signing up with email:', email);
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const result = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Email sign-up successful:', result.user.uid);
      // Manually refresh to trigger immediate user data fetch
      forceRefresh();
      // Manually redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Email sign-up error:', error);
      setLoading(false);
      throw error;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      console.log('Signing in with Google');
      await signInWithGoogleAuth();
      console.log('Google sign-in completed');
      // Manually refresh to trigger immediate user data fetch
      forceRefresh();
      // Manually redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Google sign-in error:', error);
      setLoading(false);
      throw error;
    }
  };

  // Sign in with GitHub
  const signInWithGithub = async () => {
    setLoading(true);
    try {
      console.log('Signing in with GitHub');
      await signInWithGithubAuth();
      console.log('GitHub sign-in completed');
      // Manually refresh to trigger immediate user data fetch
      forceRefresh();
      // Manually redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('GitHub sign-in error:', error);
      setLoading(false);
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      console.log('Signing out');
      await firebaseSignOut(auth);
      console.log('Sign-out completed');
      setUser(null);
      // Manually redirect to home page
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  console.log('Current auth state:', { user, loading });

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithGithub,
        signOut,
        forceRefresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
} 