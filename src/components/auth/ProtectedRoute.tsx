import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, WifiOff, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: 'buyer' | 'supplier' | 'admin';
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const cachedRole = localStorage.getItem('supplyx_user_role');
  
  // High-performance loading bypass: if we have auth and a cached role, render instantly
  const [loading, setLoading] = useState(() => {
    return !(auth.currentUser && cachedRole);
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!auth.currentUser || !!cachedRole;
  });
  const [userRole, setUserRole] = useState<string | null>(() => cachedRole);
  const [fetchFailed, setFetchFailed] = useState(false);
  
  const location = useLocation();

  useEffect(() => {
    // 1. Pre-initialize state from active cache signals
    const currentCachedRole = localStorage.getItem('supplyx_user_role');
    if (currentCachedRole) {
      setUserRole(currentCachedRole);
      setIsAuthenticated(true);
      if (auth.currentUser) {
        setLoading(false);
      }
    }

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setIsAuthenticated(true);
        const freshCached = localStorage.getItem('supplyx_user_role');
        
        if (freshCached) {
          setUserRole(freshCached);
          setLoading(false); // Enable rapid rendering of layouts
        }

        try {
          // Perform verification checks in background
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists()) {
            setUserRole('admin');
            localStorage.setItem('supplyx_user_role', 'admin');
            setLoading(false);
            setFetchFailed(false);
          } else {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.disabled || data.status === 'pending' || data.status === 'rejected') {
                localStorage.removeItem('supplyx_user_role');
                setUserRole(null);
                setIsAuthenticated(false);
                setLoading(false);
                await auth.signOut();
                
                if (data.status === 'pending') {
                  toast.error('حسابك قيد المراجعة حالياً ولن تتمكن من الدخول حتى توافق الإدارة.', { duration: 6000 });
                } else if (data.status === 'rejected') {
                  toast.error('لقد تم رفض طلب تسجيل حسابك من قبل الإدارة.', { duration: 6000 });
                } else {
                  toast.error('عذراً، تم تجميد حسابك حالياً. يرجى التواصل مع الإدارة.', { duration: 6000 });
                }
              } else {
                setUserRole(data.role);
                localStorage.setItem('supplyx_user_role', data.role);
                setLoading(false);
                setFetchFailed(false);
              }
            } else {
              // Confirmed user exists in Auth but has no record in Firestore users or admins
              // We should direct them to register
              localStorage.removeItem('supplyx_user_role');
              setUserRole(null);
              setLoading(false);
              setFetchFailed(false);
            }
          }
        } catch (error: any) {
          console.error("Background role validation encountered error:", error);
          
          // Network errors or offline behavior should never lead to forced signouts or signup redirects!
          if (freshCached) {
            setUserRole(freshCached);
            setLoading(false);
            setFetchFailed(false);
          } else {
            setFetchFailed(true);
            setLoading(false);
          }
        }
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
        localStorage.removeItem('supplyx_user_role');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleRetry = () => {
    setLoading(true);
    setFetchFailed(false);
    
    // Attempt local reload/refresh
    if (auth.currentUser) {
      auth.currentUser.reload()
        .then(() => {
          window.location.reload();
        })
        .catch((err) => {
          console.error("Reloading auth currentUser failed:", err);
          window.location.reload();
        });
    } else {
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-[#22C55E]" />
          <p className="text-slate-400 font-bold animate-pulse">جاري التحقق من الهوية...</p>
        </div>
      </div>
    );
  }

  // Elegant offline fallback when user has NO cache and database verification fails
  if (fetchFailed && !userRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-6 font-sans">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-100 shadow-xl text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-6">
            <WifiOff className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-3">فشل الاتصال بالخادم</h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            حدث خطأ أثناء الاتصال بقاعدة البيانات. تيار الإنترنت ضعيف أو قد تكون غير متصل بالشبكة حالياً. يرجى التأكد من الاتصال والمحاولة مجدداً.
          </p>
          <button 
            onClick={handleRetry}
            className="w-full py-4 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 group shadow-lg shadow-green-500/20"
          >
            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            <span>إعادة المحاولة الآن</span>
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // If trying to access admin dashboard, redirect to admin login
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (allowedRole && userRole !== allowedRole && userRole !== 'admin') {
    if (userRole === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (userRole === 'supplier') return <Navigate to="/supplier/home" replace />;
    if (userRole === 'buyer') return <Navigate to="/buyer/home" replace />;
    
    // Only route to signup if we are authenticated but have fully verified that the database record is absent (!userRole)
    if (!userRole && !fetchFailed) {
       return <Navigate to="/auth/signup" replace />;
    }

    console.warn(`Role mismatch: Expected ${allowedRole}, but got ${userRole}`);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
