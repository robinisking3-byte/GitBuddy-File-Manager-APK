import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  getDocFromServer,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export interface FirebasePatAccount {
  id?: string;
  username: string;
  patToken: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

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
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Firestore gracefully operates in offline mode when backend has not responded
    const msg = error instanceof Error ? error.message : String(error);
    console.info('Firestore initialized in resilient mode:', msg);
  }
}

// Save or update user PAT account
export async function savePatAccountToFirestore(account: {
  username: string;
  patToken: string;
  avatarUrl?: string;
}): Promise<void> {
  const cleanId = account.username.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const path = `pat_accounts/${cleanId}`;
  try {
    await setDoc(doc(db, 'pat_accounts', cleanId), {
      username: account.username,
      patToken: account.patToken,
      avatarUrl: account.avatarUrl || '',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Fetch all saved PAT accounts from Firestore
export async function fetchPatAccountsFromFirestore(): Promise<FirebasePatAccount[]> {
  const path = 'pat_accounts';
  try {
    const snap = await getDocs(collection(db, path));
    const accounts: FirebasePatAccount[] = [];
    snap.forEach((d) => {
      const data = d.data() as FirebasePatAccount;
      accounts.push({
        id: d.id,
        username: data.username,
        patToken: data.patToken,
        avatarUrl: data.avatarUrl,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });
    return accounts;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

// Real-time listener for PAT accounts
export function subscribeToPatAccounts(
  callback: (accounts: FirebasePatAccount[]) => void
): () => void {
  const path = 'pat_accounts';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const accounts: FirebasePatAccount[] = [];
      snap.forEach((d) => {
        const data = d.data() as FirebasePatAccount;
        accounts.push({
          id: d.id,
          username: data.username,
          patToken: data.patToken,
          avatarUrl: data.avatarUrl,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      callback(accounts);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

// Delete user PAT account from Firestore
export async function deletePatAccountFromFirestore(username: string): Promise<void> {
  const cleanId = username.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const path = `pat_accounts/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'pat_accounts', cleanId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
