import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Gift, User, Bell, Heart, Smartphone } from 'lucide-react';
import { cn } from '../../lib/utils';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Logo from '../ui/Logo';
import { useNotifications } from '../../hooks/useNotifications';
import { usePWAInstall } from '../../hooks/usePWAInstall';

import { motion, AnimatePresence } from 'motion/react';

export default function BuyerLayout({ children }: { children?: React.ReactNode }) {
  useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const path = location.pathname;

  const { isInstallable, isStandalone, install } = usePWAInstall();

  useEffect(() => {
    let unsubNotifs: (() => void) | null = null;
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);

      if (unsubNotifs) {
        unsubNotifs();
        unsubNotifs = null;
      }
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (u) {
        // Fetch profile for businessName and status check
        unsubProfile = onSnapshot(doc(db, 'users', u.uid), (snap) => {
          if (snap.exists()) {
             const data = snap.data();
             setUserProfile(data);
          }
        });

        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', u.uid),
          where('read', '==', false)
        );
        unsubNotifs = onSnapshot(q, (snapshot) => {
          setUnreadCount(snapshot.size);
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, 'notifications', true);
        });
      } else {
        setUnreadCount(0);
        setUserProfile(null);
      }
    });

    return () => {
      unsubAuth();
      if (unsubNotifs) unsubNotifs();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const isActive = (p: string) => path === p || path.startsWith(p + '/');

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans pb-24 md:pb-0">
      {/* Desktop Navigation Side - Optional, but keeping current top header for consistency */}
      <header className="h-16 md:h-20 bg-white border-b border-slate-100 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          <div className="hidden md:block h-6 w-px bg-slate-200 mx-2" />
          
          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-4">
            {[
              { to: '/buyer/home', icon: Home, label: 'الرئيسية' },
              { to: '/buyer/orders', icon: ClipboardList, label: 'طلباتي' },
              { to: '/buyer/offers', icon: Gift, label: 'العروض' },
              { to: '/buyer/wishlist', icon: Heart, label: 'المفضلة' },
              { to: '/buyer/profile', icon: User, label: 'حسابي' },
            ].map((item) => (
              <Link 
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-bold text-sm",
                  isActive(item.to) ? "bg-green-50 text-green-600" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <Link to="/buyer/notifications" className="relative w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400 hover:text-[var(--color-primary)] transition-all">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold">
                {unreadCount}
              </span>
            )}
          </Link>
          {isInstallable && !isStandalone && (
            <button 
              onClick={install}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-all active:scale-95"
            >
              <Smartphone size={18} />
              <span className="hidden sm:inline">تثبيت التطبيق</span>
            </button>
          )}
          <Link to="/buyer/profile" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 border border-slate-200 group-hover:border-[var(--color-primary)] transition-all">
              {userProfile?.businessName?.[0] || user?.displayName?.[0] || 'U'}
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full lg:max-w-7xl mx-auto overflow-x-hidden pt-4 px-2 md:px-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="w-full"
          >
            {children || <Outlet />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 px-4 pb-safe z-50 md:hidden">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {[
            { to: '/buyer/home', icon: Home, label: 'الرئيسية' },
            { to: '/buyer/orders', icon: ClipboardList, label: 'طلباتي' },
            { to: '/buyer/offers', icon: Gift, label: 'العروض' },
            { to: '/buyer/wishlist', icon: Heart, label: 'المفضلة' },
            { to: '/buyer/profile', icon: User, label: 'حسابي' },
          ].map((item) => (
            <Link 
              key={item.to}
              to={item.to} 
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-14 transition-all duration-300 relative", 
                isActive(item.to) ? "text-[var(--color-primary)] -translate-y-1" : "text-slate-400"
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-all", isActive(item.to) && "scale-110")} />
              <span className={cn("text-[9px] font-bold transition-all", isActive(item.to) ? "opacity-100" : "opacity-70")}>{item.label}</span>
              {isActive(item.to) && (
                <motion.div 
                  layoutId="indicator" 
                  className="absolute -bottom-2 w-1 h-1 bg-[var(--color-primary)] rounded-full"
                />
              )}
            </Link>
          ))}
        </div>
      </nav>
      
      {/* Desktop Footer Nav - Subtle */}
      <footer className="hidden md:block py-10 mt-12 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-8 flex justify-between items-center opacity-50">
           <Logo size="xs" grayscale />
           <p className="text-[10px] font-bold">بوابة المشتري الصناعية الذكية © ٢٠٢٤</p>
        </div>
      </footer>
    </div>
  );
}

