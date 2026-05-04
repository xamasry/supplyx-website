import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: 'buyer' | 'supplier' | 'admin';
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setIsAuthenticated(true);
        try {
          // Check admin collection first if allowedRole is admin or generally
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists()) {
            setUserRole('admin');
          } else {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.disabled) {
                await auth.signOut();
                setIsAuthenticated(false);
                alert('عذراً، تم تجميد حسابك حالياً. يرجى التواصل مع الإدارة.');
              } else {
                setUserRole(data.role);
              }
            } else {
              // User exists in Auth but not in Firestore users or admins
              // This might happen if registration crashed halfway
              setUserRole(null);
            }
          }
        } catch (error) {
          console.error("Error fetching user role", error);
        }
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary-500" />
          <p className="text-slate-400 font-bold animate-pulse">جاري التحقق من الهوية...</p>
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

  // If role is required but not yet determined or wrong
  if (allowedRole && userRole !== allowedRole && userRole !== 'admin') {
    if (userRole === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (userRole === 'supplier') return <Navigate to="/supplier/home" replace />;
    if (userRole === 'buyer') return <Navigate to="/buyer/home" replace />;
    
    // If user has no document in Firestore yet but is authenticated
    // We might want to allow them through if allowedRole is not specified
    // but usually they need a role.
    if (!userRole) {
       return <Navigate to="/auth/signup" replace />;
    }

    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
