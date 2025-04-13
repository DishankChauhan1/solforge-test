import { auth } from "./firebase"
import {
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithEmailAndPassword as signInWithEmailAndPasswordFirebase,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  signOut as firebaseSignOut,
  OAuthProvider,
  signInWithCredential
} from "firebase/auth"
import { getFirebaseFirestore } from "./firebase"
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore"

const googleProvider = new GoogleAuthProvider()
const githubProvider = new GithubAuthProvider()

// Add scopes for GitHub
githubProvider.addScope('user')
githubProvider.addScope('email')

export const signInWithGoogle = async () => {
  try {
    console.log("Starting Google sign-in process")
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user
    console.log("Google sign-in successful, updating Firestore")
    await updateUserInFirestore(user)
    return user
  } catch (error) {
    console.error("Error signing in with Google:", error)
    throw error
  }
}

export const signInWithGithub = async () => {
  try {
    console.log("Starting GitHub sign-in process")
    const result = await signInWithPopup(auth, githubProvider)
    const user = result.user
    console.log("GitHub sign-in successful, updating Firestore")
    await updateUserInFirestore(user)
    return user
  } catch (error: any) {
    console.error("Initial GitHub sign-in error:", error)
    
    if (error.code === 'auth/account-exists-with-different-credential') {
      try {
        const email = error.customData?.email
        if (!email) throw new Error("No email found in error data")

        // Get sign in methods for this email
        const methods = await fetchSignInMethodsForEmail(auth, email)
        console.log("Available sign-in methods:", methods)

        if (methods.includes('google.com')) {
          console.log("Email exists with Google, attempting to link accounts")
          // First get the GitHub OAuth credential
          const githubCredential = GithubAuthProvider.credentialFromError(error)
          if (!githubCredential) {
            throw new Error("Failed to get GitHub credential")
          }

          // Sign in with Google
          console.log("Attempting Google sign-in...")
          const googleResult = await signInWithPopup(auth, googleProvider)
          
          // Link the GitHub credential
          console.log("Linking GitHub credential...")
          await linkWithCredential(googleResult.user, githubCredential)
          
          // Update user in Firestore
          await updateUserInFirestore(googleResult.user)
          
          return googleResult.user
        } else {
          throw new Error(`Please sign in with ${methods[0]}`)
        }
      } catch (linkError) {
        console.error("Error during account linking:", linkError)
        throw linkError
      }
    }
    
    throw error
  }
}

async function updateUserInFirestore(user: any) {
  console.log("Updating user in Firestore:", user.uid)
  const userRef = doc(getFirebaseFirestore(), "users", user.uid)
  const userSnap = await getDoc(userRef)
  
  const userData = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    photoURL: user.photoURL,
    lastLogin: serverTimestamp()
  }

  if (!userSnap.exists()) {
    console.log("Creating new user document")
    await setDoc(userRef, {
      ...userData,
      role: "hunter",
      createdAt: serverTimestamp()
    })
  } else {
    console.log("Updating existing user document")
    await setDoc(userRef, userData, { merge: true })
  }
  console.log("Firestore update complete")
}

export async function signInWithEmailAndPassword(email: string, password: string) {
  try {
    console.log("Starting email sign-in process")
    const result = await signInWithEmailAndPasswordFirebase(auth, email, password)
    console.log("Email sign-in successful, updating Firestore")
    await updateUserInFirestore(result.user)
    return result.user
  } catch (error) {
    console.error("Error signing in with email/password:", error)
    throw error
  }
}

export const signOut = async () => {
  try {
    console.log("Signing out user")
    await firebaseSignOut(auth)
    console.log("Sign out successful")
  } catch (error) {
    console.error("Error signing out:", error)
    throw error
  }
} 