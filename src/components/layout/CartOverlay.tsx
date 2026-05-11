import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { 
  ShoppingBag, 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  Loader2, 
  ShoppingCart, 
  ArrowLeft,
  CreditCard,
  MapPin,
  Phone,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { orderService } from '../../services/OrderService';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';

export default function CartOverlay() {
  const { cart, removeItem, updateQuantity, clearCart, totalPrice, totalItems } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'address' | 'confirmation'>('cart');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Load initial address/phone from profile
    const loadProfile = async () => {
      if (auth.currentUser) {
        const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (snap.exists()) {
          setAddress(snap.data().address || '');
          setPhone(snap.data().phone || snap.data().phoneNumber || '');
        }
      }
    };
    if (isOpen) loadProfile();
  }, [isOpen]);

  const handleCheckout = async () => {
    if (!cart || cart.items.length === 0 || !auth.currentUser) return;
    
    setIsCheckingOut(true);
    try {
      await orderService.createOrderFromCart(auth.currentUser.uid, cart, {
        address,
        phone,
        paymentMethod: 'cash_on_delivery'
      });
      
      await clearCart();
      setCheckoutStep('confirmation');
      toast.success('تم إرسال الطلب بنجاح');
      
      setTimeout(() => {
        setIsOpen(false);
        setCheckoutStep('cart');
        navigate('/buyer/orders');
      }, 3000);
      
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'orders');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <>
      {/* Floating Cart Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 right-8 z-50 bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl transition-all active:scale-95 group overflow-hidden border border-white/10",
          totalItems === 0 && "translate-y-32 opacity-0 pointer-events-none"
        )}
      >
        <div className="absolute inset-0 bg-primary-500/10 rounded-full scale-0 group-hover:scale-150 transition-transform duration-700" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative">
            <ShoppingBag size={24} />
            <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 animate-in zoom-in duration-300">
              {totalItems}
            </span>
          </div>
          <span className="font-black text-sm tracking-tight">{totalPrice} ج.م</span>
        </div>
      </button>

      {/* Cart Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden rounded-l-[3rem]"
              dir="rtl"
            >
              {/* Header */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter">سلة المشتريات</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">لديك {totalItems} منتجات في السلة</p>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-colors shadow-sm"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {checkoutStep === 'cart' && (
                  <div className="space-y-4">
                    {cart?.items.map((item) => (
                      <div key={item.id} className="group flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100 hover:border-primary-500/20 transition-all">
                        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shadow-sm overflow-hidden p-1">
                          {item.image ? (
                            <img src={item.image} className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            "📦"
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-black text-slate-900 line-clamp-1">{item.productName}</h4>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">{item.packagingLevelName}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-black text-primary-600">{item.price * item.quantity} ج.م</span>
                            
                            <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1">
                              <button 
                                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                className="p-1 text-slate-400 hover:text-primary-500 transition-colors"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-8 text-center text-xs font-black text-slate-900">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="p-1 text-slate-400 hover:text-primary-500 transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    
                    {(!cart || cart.items.length === 0) && (
                      <div className="h-full flex flex-col items-center justify-center text-center py-20">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6 text-slate-200">
                          <ShoppingCart size={48} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900">سلتك فارغة</h3>
                        <p className="text-sm text-slate-400 font-bold mt-2">ابدأ بإضافة منتجات من الكتالوج</p>
                        <button 
                          onClick={() => setIsOpen(false)}
                          className="mt-8 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm active:scale-95 transition-all"
                        >
                          استكشف المنتجات
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {checkoutStep === 'address' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="bg-primary-50 p-6 rounded-3xl border border-primary-100 border-dashed">
                      <h4 className="text-sm font-black text-primary-700 mb-2">معلومات التوصيل</h4>
                      <p className="text-[10px] text-primary-600 font-bold">يرجى التأكد من عنوان التوصيل ورقم الهاتف لتسهيل عملية الشحن</p>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">عنوان التوصيل بالتفصيل</label>
                        <div className="relative">
                          <textarea
                            required
                            rows={3}
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="المحافظة، المنطقة، الشارع..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-12 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                          />
                          <MapPin size={20} className="absolute right-4 top-4 text-slate-300" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">رقم هاتف للتواصل</label>
                        <div className="relative">
                          <input
                            required
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="01xxxxxxxxx"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-12 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500 transition-all text-left"
                            dir="ltr"
                          />
                          <Phone size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>

                      <div className="p-6 bg-slate-900 rounded-[2rem] text-white">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-xs font-bold opacity-60 italic">طريقة الدفع</span>
                          <span className="flex items-center gap-2 text-xs font-black">
                            <CreditCard size={14} className="text-primary-500" />
                            الدفع عند الاستلام
                          </span>
                        </div>
                        <div className="h-px bg-white/10 my-4" />
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold opacity-60">الإجمالي النهائي</span>
                          <span className="text-2xl font-black text-primary-500">{totalPrice} ج.م</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {checkoutStep === 'confirmation' && (
                  <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10">
                      <CheckCircle2 size={48} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">تهانينا!</h3>
                    <p className="text-sm text-slate-400 font-bold mt-2">تم استلام طلبك بنجاح وجاري العمل عليه</p>
                    <div className="mt-8 space-y-3 w-full">
                       <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center gap-3">
                         <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                         <span className="text-[10px] font-black text-slate-500 uppercase">جاري توجيهك لصفحة الطلبات...</span>
                       </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {cart && cart.items.length > 0 && checkoutStep !== 'confirmation' && (
                <div className="p-8 border-t border-slate-100 bg-slate-50/50">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-sm font-black text-slate-400 uppercase tracking-widest">المجموع الكلي</span>
                    <span className="text-2xl font-black text-slate-900">{totalPrice} ج.م</span>
                  </div>
                  
                  {checkoutStep === 'cart' ? (
                    <button 
                      onClick={() => setCheckoutStep('address')}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white py-5 rounded-[2rem] font-black text-sm flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95"
                    >
                      متابعة الشراء
                      <ArrowLeft size={18} />
                    </button>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      <button 
                         onClick={() => setCheckoutStep('cart')}
                         className="bg-white border border-slate-200 text-slate-900 p-5 rounded-[2rem] font-black text-sm hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                      >
                        رجوع
                      </button>
                      <button 
                        disabled={isCheckingOut || !address || !phone}
                        onClick={handleCheckout}
                        className="col-span-2 bg-primary-600 hover:bg-primary-500 text-white p-5 rounded-[2rem] font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-primary-500/20 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isCheckingOut ? <Loader2 className="animate-spin" /> : <>إتمام الطلب <ShoppingBag size={18} /></>}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
