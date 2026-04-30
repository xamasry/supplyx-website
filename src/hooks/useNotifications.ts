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
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Check if it's a very fresh notification to avoid toast storm on initial load
          const createdAt = data.createdAt?.toMillis?.() || new Date(data.createdAt).getTime();
          const now = Date.now();
          
          if (now - createdAt < 10000) { // Only show for notifications created in the last 10 seconds
             toast(`${data.title}: ${data.body}`, {
               icon: '🔔',
               duration: 6000,
             });
          }
        }
      });
    });

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);
}
