'use server';
import { initializeApp, getApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

interface FirebaseServerAuth {
  auth: Auth;
  firestore: Firestore;
  firebaseApp: App;
}

// Store the initialized app in a global variable to avoid re-initialization
// during hot-reloads in development.
declare global {
  var firebaseAdminApp: App | undefined;
}

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export async function initializeFirebaseServer(): Promise<FirebaseServerAuth> {
  if (global.firebaseAdminApp) {
    const firebaseApp = global.firebaseAdminApp;
    return {
      auth: getAuth(firebaseApp),
      firestore: getFirestore(firebaseApp),
      firebaseApp
    };
  }
  
  if (getApps().length > 0) {
    const firebaseApp = getApp();
    global.firebaseAdminApp = firebaseApp;
    return {
      auth: getAuth(firebaseApp),
      firestore: getFirestore(firebaseApp),
      firebaseApp
    };
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : undefined;

  const firebaseApp = initializeApp(serviceAccount ? { credential: cert(serviceAccount) } : undefined);
  global.firebaseAdminApp = firebaseApp;

  return {
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    firebaseApp
  };
}
