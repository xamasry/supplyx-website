import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Gift, User, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import Logo from '../ui/Logo';

export default function BuyerLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [unreadCount, setUnreadCount] = useState(0);
  const path = location.pathname;

  useEffect(() => {
    let unsubNotifs: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', u.uid),
          where('read', '==', false)
        );
        unsubNotifs = onSnapshot(q, (snapshot) => {
          setUnreadCount(snapshot.size);
        });
      } else {
        setUnreadCount(0);
      }
    });

    return () => {
      unsubAuth();
      if (unsubNotifs) unsubNotifs();
    };
  }, []);

  const isActive = (p: string) => path.includes(p);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans pb-20 md:pb-0">
      <header className="h-20 bg-white border-b border-slate-100 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Logo size="sm" />
          <div className="hidden md:flex items-center gap-3 pl-6 border-l border-slate-100">
            <div className="w-10 h-10 bg-[#22C55E]/10 text-[#22C55E] rounded-xl flex items-center justify-center font-black text-xl">
              {user?.displayName ? user.displayName[0] : 'S'}
            </div>
            <div>
              <h1 className="font-bold text-[#0B1D2A] leading-tight truncate max-w-[150px] md:max-w-none">
                {user?.displayName || 'مطعم الأمل'}
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {user?.email || 'حساب مطعم'}
              </p>
            </div>
          </div>
        </div>
        <Link to="/buyer/notifications" className="relative w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-[#0B1D2A] cursor-pointer hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-danger)] text-[8px] flex items-center justify-center rounded-full border-2 border-[var(--color-primary)] font-bold">
              {unreadCount > 9 ? '+9' : unreadCount}
            </span>
          )}
        </Link>
      </header>

      <main className="flex-1 p-4 md:p-6 w-full lg:max-w-5xl mx-auto overflow-hidden">
        {children || <Outlet />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-300 pb-safe z-50 md:sticky md:h-16 md:flex md:items-center">
        <div className="flex items-center justify-around h-16 w-full lg:max-w-5xl mx-auto px-2 md:px-20">
          <Link to="/buyer/home" className={cn("flex flex-col items-center justify-center gap-1 w-16", isActive('/buyer/home') ? "text-[var(--color-primary)]" : "text-slate-500")}>
            <Home className={cn("w-6 h-6", isActive('/buyer/home') && "fill-current")} />
            <span className="text-[10px] font-bold">الرئيسية</span>
          </Link>
          <Link to="/buyer/orders" className={cn("flex flex-col items-center justify-center gap-1 w-16", isActive('/buyer/orders') ? "text-[var(--color-primary)]" : "text-slate-500")}>
            <ClipboardList className="w-6 h-6" />
            <span className="text-[10px] font-bold">طلباتي</span>
          </Link>
          <Link to="/buyer/offers" className={cn("flex flex-col items-center justify-center gap-1 w-16", isActive('/buyer/offers') ? "text-[var(--color-primary)]" : "text-slate-500")}>
            <Gift className="w-6 h-6" />
            <span className="text-[10px] font-bold">العروض</span>
          </Link>
          <Link to="/buyer/profile" className={cn("flex flex-col items-center justify-center gap-1 w-16", isActive('/buyer/profile') ? "text-[var(--color-primary)]" : "text-slate-500")}>
            <User className="w-6 h-6" />
            <span className="text-[10px] font-bold">حسابي</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
