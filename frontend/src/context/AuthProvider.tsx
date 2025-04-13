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
  Firestore 
} from 'firebase/firestore';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { getFirebaseApp, getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase';
import { IUser } from '@/types/user';
import { getUserProfile } from '@/lib/github';

interface AuthContextType {
  user: IUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signInWithGoogle: async () => {},
  signInWithGithub: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let unsubscribe: () => void;

    const initializeAuth = async () => {
      try {
        const authInstance = getFirebaseAuth();
        const dbInstance = getFirebaseFirestore();

        // Set persistence to LOCAL (survives browser restart)
        await setPersistence(authInstance, browserLocalPersistence);

        unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
          if (firebaseUser) {
            try {
              // Get user data from Firestore
              const userDoc = await getDoc(doc(dbInstance, 'users', firebaseUser.uid));
              
              if (userDoc.exists()) {
                setUser(userDoc.data() as IUser);
              } else {
                // Create user document if it doesn't exist
                const userData: IUser = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
                  photoURL: firebaseUser.photoURL || '',
                  createdAt: serverTimestamp(),
                  lastLogin: serverTimestamp(),
                  role: 'contributor'
                };
                await setDoc(doc(dbInstance, 'users', firebaseUser.uid), userData);
                setUser(userData);
              }
            } catch (error) {
              console.error('Error fetching user data:', error);
              setUser(null);
            }
          } else {
            setUser(null);
          }
          setLoading(false);
        });
      } catch (error) {
        console.error('Error initializing Firebase:', error);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const auth = getFirebaseAuth();
      const db = getFirebaseFirestore();
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      if (result.user) {
        const userRef = doc(db, 'users', result.user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          // Create user document if it doesn't exist
          await setDoc(userRef, {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName || email.split('@')[0],
            photoURL: result.user.photoURL,
            role: 'contributor', // Default role
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
          });
        } else {
          // Update last login
          await updateDoc(userRef, {
            lastLogin: serverTimestamp(),
          });
        }
        
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.code === 'auth/invalid-credential') {
        throw new Error('Invalid email or password. Please try again.');
      } else if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email. Please sign up first.');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password. Please try again.');
      } else {
        throw new Error(error.message || 'Failed to sign in');
      }
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const auth = getFirebaseAuth();
      const db = getFirebaseFirestore();
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      if (result.user) {
        const userRef = doc(db, 'users', result.user.uid);
        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          displayName: email.split('@')[0], // Use email prefix as display name
          photoURL: null,
          lastLogin: serverTimestamp(),
        }, { merge: true });
        
        router.push('/dashboard');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create account');
    }
  };

  const signInWithGoogle = async () => {
    try {
      const auth = getFirebaseAuth();
      const db = getFirebaseFirestore();
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      if (result.user) {
        const userRef = doc(db, 'users', result.user.uid);
        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          lastLogin: serverTimestamp(),
        }, { merge: true });
        
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      throw new Error(error.message || 'Failed to sign in with Google');
    }
  };

  const signInWithGithub = async () => {
    try {
      const auth = getFirebaseAuth();
      const db = getFirebaseFirestore();
      const { 
        signInWithPopup, 
        GithubAuthProvider,
        signInWithCredential,
        linkWithCredential,
        GoogleAuthProvider
      } = await import('firebase/auth');
      
      const provider = new GithubAuthProvider();
      
      try {
        const result = await signInWithPopup(auth, provider);
        console.log('GitHub sign in successful:', result.user.uid);
        
        // Update or create user profile
        if (result.user) {
          const userRef = doc(db, 'users', result.user.uid);
          await setDoc(userRef, {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
            githubToken: GithubAuthProvider.credentialFromResult(result)?.accessToken,
            lastLogin: serverTimestamp(),
          }, { merge: true });
          
          router.push('/dashboard');
        }
      } catch (error: any) {
        if (error.code === 'auth/account-exists-with-different-credential') {
          // Get existing providers for the email
          const email = error.customData?.email;
          const pendingCred = GithubAuthProvider.credentialFromError(error);
          
          if (email && pendingCred) {
            const providers = await fetchSignInMethodsForEmail(auth, email);
            if (providers[0] === 'google.com') {
              // If the user has previously signed in with Google
              if (confirm('This email is already associated with a Google account. Would you like to link your GitHub account to it? Click OK to sign in with Google and link accounts.')) {
                const googleProvider = new GoogleAuthProvider();
                try {
                  const result = await signInWithPopup(auth, googleProvider);
                  await linkWithCredential(result.user, pendingCred);
                  router.push('/dashboard');
                } catch (linkError) {
                  console.error('Error linking accounts:', linkError);
                  alert('Error linking accounts. Please try again.');
                }
              }
            } else {
              alert(`This email is already associated with ${providers[0]}. Please sign in with that method first.`);
            }
          }
        } else {
          console.error('Error signing in with GitHub:', error);
          alert('Error signing in with GitHub. Please try again.');
        }
      }
    } catch (error) {
      console.error('Fatal error during authentication:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  };

  const signOut = async () => {
    try {
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
      setUser(null);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInWithGithub, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
} 