import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Improved Firestore initialization with long-polling for better reliability in restricted environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId || '(default)');

export const auth = getAuth(app);

// Test Connection with retry and delay
async function testConnection(retries = 5) {
  // Wait a bit for initial network stability in iframe
  await new Promise(r => setTimeout(r, 3000));
  
  try {
    // Try to get a non-existent document using fromCache first to see if offline persistence works
    // but here we want to test the server connection
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Connected Successfully");
  } catch (error: any) {
    const isUnavailable = error?.code === 'unavailable' || error?.message?.includes('unavailable');
    const isOffline = error?.message?.includes('the client is offline');
    
    if (retries > 0 && (isUnavailable || isOffline)) {
      console.warn(`Firebase connection pending (code: ${error?.code})... retrying in 5s (${retries} left)`);
      await new Promise(r => setTimeout(r, 5000));
      return testConnection(retries - 1);
    }
    
    if (isUnavailable || isOffline || error?.message?.includes('deadline-exceeded')) {
      console.warn("Firestore backend unreachable. This often happens in restricted network environments or during initial startup. The app will continue in offline mode.");
    } else {
      console.error("Firebase connection error:", error);
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
