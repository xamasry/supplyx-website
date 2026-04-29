
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, Chrome } from 'lucide-react';
import { motion } from 'motion/react';

const OWNER_EMAIL = 'masriboro@gmail.com';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAdminSuccess = async (user: any) => {
    try {
      const adminDoc = await getDoc(doc(db, 'admins', user.uid));
      
      if (adminDoc.exists()) {
        navigate('/admin/dashboard');
        return;
      }

      // Auto-bootstrap for the specific owner email
      if (user.email === OWNER_EMAIL) {
        const { serverTimestamp } = await import('firebase/firestore');
        await setDoc(doc(db, 'admins', user.uid), {
          email: user.email,
          addedAt: serverTimestamp(),
          isSuperAdmin: true,
          role: 'super_admin'
        }, { merge: true });
        navigate('/admin/dashboard');
      } else {
        await auth.signOut();
        setError('عذراً، هذا الحساب ليس لديه صلاحيات مدير النظام.');
      }
    } catch (err) {
      console.error("Admin verification error:", err);
      setError('حدث خطأ أثناء التحقق من صلاحيات الإدارة');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await handleAdminSuccess(userCredential.user);
    } catch (err: any) {
      console.error("Admin email login error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('تسجيل الدخول بالبريد غير مفعل في إعدادات Firebase الخاصة بك. يرجى استخدام Google أو تفعيله من الكونسول.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('بيانات الدخول غير صحيحة');
      } else {
        setError('حدث خطأ أثناء تسجيل الدخول');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary-500/10 p-4 rounded-2xl mb-4">
            <Shield className="w-10 h-10 text-primary-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">دخول الإدارة</h1>
          <p className="text-slate-400 text-sm mt-2">لوحة تحكم صاحب المشروع</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3 mb-6">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div>
              <label className="block text-slate-400 text-sm font-bold mb-2 mr-1">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@supplyx.com"
                  className="w-full bg-slate-800 border border-slate-700 text-white px-12 py-3 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm font-bold mb-2 mr-1">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 text-white px-12 py-3 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>دخول ببيانات الإدارة</span>
                  <ArrowRight className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-800 text-center">
          <p className="text-slate-500 text-xs italic">
            هذه المنطقة محمية. أي محاولة دخول غير مصرح بها يتم رصدها آلياً.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

