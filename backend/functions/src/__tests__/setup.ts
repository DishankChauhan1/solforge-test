import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';
import { beforeAll, afterAll, afterEach } from '@jest/globals';
import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Initialize Firebase Admin with a test project config
const testConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'test-project',
};

// Set environment variables for emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';

// Initialize admin SDK
if (!admin.apps.length) {
  admin.initializeApp(testConfig);
}

// Initialize the firebase-functions-test SDK
export const testEnv = functionsTest(testConfig, './service-account.json');

// Global test setup
beforeAll(() => {
  // Add any global setup here
  console.log('Using test configuration with Firebase emulators');
});

// Global test teardown
afterAll(async () => {
  // Clean up test environment
  await Promise.all(admin.apps.map(app => app?.delete()));
  testEnv.cleanup();
});

// Reset state between tests
afterEach(async () => {
  // Clear any test data from Firestore
  const collections = ['bounties', 'users', 'payments'];
  try {
    await Promise.all(
      collections.map(async collection => {
        const snapshot = await admin.firestore().collection(collection).get();
        if (snapshot.empty) return;
        
        const batch = admin.firestore().batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      })
    );
  } catch (error) {
    console.warn('Error cleaning up test data:', error);
  }
}); 