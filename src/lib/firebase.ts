import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDocFromCache, getDocFromServer, updateDoc, arrayUnion } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';
import toast from 'react-hot-toast';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistence only in the browser
export const db = typeof window !== 'undefined' 
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    }, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();

export let messaging: Messaging | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  }).catch(console.error);
}

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationType = typeof OperationType[keyof typeof OperationType];

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

import { monitor } from './monitor';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, suppressThrow: boolean = true) {
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
  }
  
  // Log to centralized monitoring
  monitor.logError(`Firestore Error: ${operationType} at ${path}`, errInfo);

  console.error('Firestore Error Detailed Object:', error);
  console.error('Firestore Error Info JSON:', JSON.stringify(errInfo));
  if (errInfo.error.includes('permissions')) {
    toast.error("عذراً، لا نملك صلاحية تنفيذ هذه العملية. يرجى محاولة تسجيل الدخول مرة أخرى.");
  } else {
    toast.error("حدث خطأ أثناء التواصل مع قاعدة البيانات. يرجى المحاولة لاحقاً.");
  }
  if (!suppressThrow) {
    throw error; 
  }
}

// Notification Helpers
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('هذا المتصفح لا يدعم الإشعارات.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      if (!messaging) return null;
      
        const registration = await navigator.serviceWorker.ready;
        const config: any = { serviceWorkerRegistration: registration };
        if (import.meta.env.VITE_VAPID_KEY) {
           config.vapidKey = import.meta.env.VITE_VAPID_KEY;
        }
        const token = await getToken(messaging, config);

      if (token && auth.currentUser) {
        // Save token to user profile in Firestore
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(token),
          notificationsEnabled: true,
          updatedAt: new Date()
        });
        return token;
      }
    }
  } catch (error: any) {
    console.error('Error getting notification permission:', error);
    if (error.message && error.message.includes('VAPID')) {
       toast.error("VAPID Key is missing! Please configure Web Push in Firebase Console and add VITE_VAPID_KEY to your environment variables.", { duration: 10000 });
    }
  }
  return null;
}

export function onMessageListener(callback: (payload: any) => void) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}

// Optional: Test connection to Firestore
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
