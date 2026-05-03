import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';
import metadata from '../../metadata.json';

const APP_VERSION = metadata.version;

export function useVersionCheck() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ minVersion: string, message: string } | null>(null);

  useEffect(() => {
    // Listen to global config for versioning
    const unsub = onSnapshot(doc(db, 'system', 'config'), (snap) => {
      if (snap.exists()) {
        const { minVersion, message, currentVersion } = snap.data();
        
        // Version comparison logic (simple semantic check)
        if (minVersion && isVersionLower(APP_VERSION, minVersion)) {
          setNeedsUpdate(true);
          setUpdateInfo({ minVersion, message: message || 'إصدار جديد متوفر. يرجى تحديث التطبيق للمتابعة.' });
        } else if (currentVersion && APP_VERSION !== currentVersion) {
           // Optional update notification
           console.log(`Update available: ${currentVersion} (Current: ${APP_VERSION})`);
        }
      }
    });

    return () => unsub();
  }, []);

  return { needsUpdate, updateInfo, currentVersion: APP_VERSION };
}

function isVersionLower(current: string, required: string): boolean {
  const cParts = current.split('.').map(Number);
  const rParts = required.split('.').map(Number);

  for (let i = 0; i < Math.max(cParts.length, rParts.length); i++) {
    const c = cParts[i] || 0;
    const r = rParts[i] || 0;
    if (c < r) return true;
    if (c > r) return false;
  }
  return false;
}
