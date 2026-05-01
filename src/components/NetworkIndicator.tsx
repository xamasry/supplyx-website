import React from 'react';
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { motion, AnimatePresence } from 'framer-motion';

export function NetworkIndicator() {
  const isOnline = useNetworkStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-rose-500 text-white px-4 py-2 flex items-center justify-center gap-2 shadow-md w-full pt-[calc(env(safe-area-inset-top,0px)+8px)]"
        >
          <WifiOff className="w-5 h-5" />
          <span className="font-bold text-sm">أنت في وضع عدم الاتصال (Offline) - قد تكون البيانات غير محدثة</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
