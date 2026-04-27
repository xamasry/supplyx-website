import { useNavigate } from 'react-router-dom';
import { User, Store, MapPin, Bell, CreditCard, FileText, HelpCircle, LogOut, Loader2, X, Plus, Trash2 } from 'lucide-react';
import { useState, useEffect, type FormEvent } from 'react';
import { auth, db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, setDoc, getDoc, serverTimestamp, collection, addDoc, deleteDoc } from 'firebase/firestore';

export default function BuyerProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // Form states
  const [editFormData, setEditFormData] = useState({
    businessName: '',
    phone: '',
    address: ''
  });
  
  const [paymentFormData, setPaymentFormData] = useState({
    cardHolder: '',
    cardNumber: '',
    expiryDate: '',
    type: 'visa'
  });

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubPayments: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (unsubProfile) unsubProfile();
      if (unsubPayments) unsubPayments();

      if (currentUser) {
        // Fetch/Init Profile
        const profileRef = doc(db, 'users', currentUser.uid);
        unsubProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile(data);
          } else {
            // Create initial profile
            setDoc(profileRef, {
              displayName: currentUser.displayName,
              role: 'buyer',
              updatedAt: serverTimestamp()
            });
          }
        }, (error) => {
          console.error("Buyer Profile error:", error);
        });

        // Fetch Payment Methods
        const paymentsRef = collection(db, 'users', currentUser.uid, 'payment_methods');
        unsubPayments = onSnapshot(paymentsRef, (snapshot) => {
          setPaymentMethods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
          console.error("Buyer Payments error:", error);
        });

      } else {
        setProfile(null);
        setPaymentMethods([]);
      }
      setLoading(false);
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubPayments) unsubPayments();
    };
  }, []);

  // Set form data when modal opens
  useEffect(() => {
    if (isEditModalOpen && profile) {
      setEditFormData({
        businessName: profile.businessName || '',
        phone: profile.phone || '',
        address: profile.address || ''
      });
    }
  }, [isEditModalOpen, profile]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/auth/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...editFormData,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setIsEditModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleAddPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'payment_methods'), {
        ...paymentFormData,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      setPaymentFormData({ cardHolder: '', cardNumber: '', expiryDate: '', type: 'visa' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/payment_methods`);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'payment_methods', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/payment_methods/${id}`);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
      <Loader2 className="w-10 h-10 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 md:pb-0 px-2 sm:px-0 font-sans text-right relative">
      <header className="mb-6">
        <h1 className="text-2xl font-bold font-display text-slate-900">الملف الشخصي</h1>
      </header>

      {/* User Info Card */}
      <div className="bg-[var(--color-primary)] text-white rounded-3xl p-6 shadow-lg flex items-center gap-4 relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 text-white/5 text-8xl rotate-12">
          <Store />
        </div>
        <div className="w-16 h-16 rounded-full border-2 border-white/20 bg-white/10 flex items-center justify-center overflow-hidden shrink-0 z-10">
          <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.businessName || "U")}&background=fff&color=22C55E`} alt="Logo" className="w-full h-full object-cover" />
        </div>
        <div className="z-10 flex-1">
          <h2 className="font-bold text-2xl font-display">{profile?.businessName || user?.displayName || 'مستخدم جديد'}</h2>
          <p className="text-white/80 text-sm mt-1 mb-2">{user?.email}</p>
          <div className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded text-xs font-bold font-mono" dir="ltr">
            ID: #{user?.uid.slice(0, 8).toUpperCase() || 'BNH-7729'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Account Details */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-[var(--color-accent)]" /> تفاصيل الحساب
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] text-slate-500 font-bold mb-1">رقم الهاتف</p>
              <p className="font-bold text-slate-800" dir="ltr">{profile?.phone || 'غير مسجل'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold mb-1">العنوان</p>
              <p className="font-bold text-slate-800 flex items-start gap-1">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" /> {profile?.address || 'غير مسجل'}
              </p>
            </div>
            <button 
              onClick={() => setIsEditModalOpen(true)}
              className="text-sm font-bold text-[var(--color-primary)] hover:underline border-t border-slate-100 mt-2 pt-4 w-full text-right"
            >
              تعديل تفاصيل الملف الشخصي
            </button>
          </div>
        </div>

        {/* Settings list */}
        <div className="bg-white rounded-3xl p-2 border border-slate-200 shadow-sm">
          <div className="flex flex-col">
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-right relative border-b border-slate-100 w-full"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-sm">طرق الدفع</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">إدارة الكروت المحفوظة وحساب فوري</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-right relative border-b border-slate-100 w-full">
              <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-sm">الإشعارات</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">التحكم في تنبيهات التطبيق</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-right relative border-b border-slate-100 w-full">
              <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-sm">الفواتير والتقارير</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">تحميل فواتير المشتريات (PDF)</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-right relative w-full">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-sm">الدعم الفني</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">تواصل معنا لحل أي مشكلة</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <button onClick={handleLogout} className="w-full bg-white border border-red-200 text-red-600 rounded-3xl p-4 font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors shadow-sm mb-20">
        <LogOut className="w-5 h-5" /> تسجيل الخروج
      </button>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl">تعديل الملف الشخصي</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">اسم النشاط / المطعم</label>
                <input 
                  type="text" 
                  value={editFormData.businessName}
                  onChange={e => setEditFormData({...editFormData, businessName: e.target.value})}
                  className="w-full border border-slate-300 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">رقم الهاتف</label>
                <input 
                  type="tel" 
                  value={editFormData.phone}
                  onChange={e => setEditFormData({...editFormData, phone: e.target.value})}
                  className="w-full border border-slate-300 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">العنوان</label>
                <textarea 
                  rows={3}
                  value={editFormData.address}
                  onChange={e => setEditFormData({...editFormData, address: e.target.value})}
                  className="w-full border border-slate-300 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[var(--color-primary)] outline-none resize-none"
                  required
                />
              </div>
              <button type="submit" className="w-full py-4 bg-[var(--color-primary)] text-white font-bold rounded-2xl shadow-lg">حفظ التغييرات</button>
            </form>
          </div>
        </div>
      )}

      {/* Payment Methods Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl">طرق الدفع</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Existing Cards */}
            <div className="space-y-3 mb-6">
               {paymentMethods.map(method => (
                 <div key={method.id} className="relative group bg-gradient-to-br from-blue-600 to-blue-800 text-white p-4 rounded-2xl shadow-md">
                    <div className="flex justify-between items-start mb-4">
                      <CreditCard className="w-8 h-8 opacity-50" />
                      <button onClick={() => handleDeletePayment(method.id)} className="p-1 hover:bg-red-500 rounded-lg transition-colors text-white">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-lg font-mono mb-2" dir="ltr">**** **** **** {method.cardNumber.slice(-4)}</p>
                    <div className="flex justify-between items-end text-[10px]">
                      <div>
                        <p className="opacity-60 uppercase">CARD HOLDER</p>
                        <p className="font-bold uppercase">{method.cardHolder}</p>
                      </div>
                      <div>
                        <p className="opacity-60 text-right uppercase">EXPIRES</p>
                        <p className="font-bold">{method.expiryDate}</p>
                      </div>
                    </div>
                 </div>
               ))}
               {paymentMethods.length === 0 && (
                 <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400">
                   لا توجد كروت محفوظة حالياً
                 </div>
               )}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h4 className="font-bold text-sm mb-4">إضافة كارت جديد</h4>
              <form onSubmit={handleAddPayment} className="space-y-3">
                <input 
                  type="text" 
                  placeholder="الاسم على الكارت"
                  value={paymentFormData.cardHolder}
                  onChange={e => setPaymentFormData({...paymentFormData, cardHolder: e.target.value})}
                  className="w-full border border-slate-300 rounded-2xl py-3 px-4 outline-none" required
                />
                <input 
                  type="text" 
                  placeholder="رقم الكارت (16 رقم)"
                  value={paymentFormData.cardNumber}
                  onChange={e => setPaymentFormData({...paymentFormData, cardNumber: e.target.value})}
                  className="w-full border border-slate-300 rounded-2xl py-3 px-4 outline-none" required
                />
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="MM/YY"
                    value={paymentFormData.expiryDate}
                    onChange={e => setPaymentFormData({...paymentFormData, expiryDate: e.target.value})}
                    className="w-full border border-slate-300 rounded-2xl py-3 px-4 outline-none" required
                  />
                  <select 
                    value={paymentFormData.type}
                    onChange={e => setPaymentFormData({...paymentFormData, type: e.target.value})}
                    className="w-full border border-slate-300 rounded-2xl py-3 px-4 outline-none bg-white"
                  >
                    <option value="visa">Visa</option>
                    <option value="mastercard">MasterCard</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" /> إضافة الكارت
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
