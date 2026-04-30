import { useEffect } from 'react';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import toast from 'react-hot-toast';

export function useNotifications() {
  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen for new notifications assigned to this user
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
      where('read', '==', false),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Check if it's a very fresh notification to avoid toast storm on initial load
          const createdAt = data.createdAt?.toMillis?.() || (data.createdAt instanceof Date ? data.createdAt.getTime() : new Date(data.createdAt).getTime());
          const now = Date.now();
          
          if (now - createdAt < 15000) { // Only show for notifications created in the last 15 seconds
             toast(`${data.title}: ${data.message || data.body}`, {
               icon: '🔔',
               duration: 5000,
             });
          }
        }
      });
    }, (err) => {
      console.warn("Notification listener error (likely missing index):", err);
    });

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);
}
