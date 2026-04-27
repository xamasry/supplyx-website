import { db } from '../../src/lib/firebase';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

export interface Session {
  supplierId: string;
  phone: string;
  currentAction: 'awaiting_bid_confirm' | 'awaiting_price' | 'awaiting_delivery_time' | 'awaiting_notes' | 'awaiting_final_confirm' | null;
  requestId: string | null;
  step: number;
  tempData: {
    price?: number;
    deliveryTime?: number;
    notes?: string;
    productName?: string;
    buyerName?: string;
  };
  lastMessageAt?: any;
  expiresAt?: any;
}

// حفظ الجلسة
export async function saveSession(phone: string, session: Partial<Session>): Promise<void> {
  const ref = doc(db, 'whatsapp_sessions', phone);
  // Store an expiration timestamp directly in milliseconds just in case
  const expiryDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await setDoc(ref, {
    ...session,
    lastMessageAt: serverTimestamp(),
    expiresAt: expiryDate
  }, { merge: true });
}

// جلب الجلسة
export async function getSession(phone: string): Promise<Session | null> {
  const ref = doc(db, 'whatsapp_sessions', phone);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  
  const data = snap.data();
  // تحقق إن الجلسة لسه صالحة
  const expiresAt = data.expiresAt;
  if (expiresAt) {
     const expiryTime = expiresAt.toDate ? expiresAt.toDate().getTime() : new Date(expiresAt).getTime();
     if (expiryTime < Date.now()) {
        await deleteDoc(ref);
        return null;
     }
  }
  return data as Session;
}

// حذف الجلسة
export async function clearSession(phone: string): Promise<void> {
  const ref = doc(db, 'whatsapp_sessions', phone);
  await deleteDoc(ref);
}

// تحديث خطوة في الجلسة
export async function updateSessionStep(
  phone: string,
  action: Session['currentAction'],
  tempData?: Session['tempData']
): Promise<void> {
  await saveSession(phone, {
    currentAction: action,
    ...(tempData && { tempData })
  });
}
