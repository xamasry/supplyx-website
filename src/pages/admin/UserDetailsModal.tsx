import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, ArrowRightLeft, DollarSign, XCircle, Package, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

interface UserDetailsModalProps {
  user: any;
  requests: any[];
  onClose: () => void;
}

export default function UserDetailsModal({ user, requests, onClose }: UserDetailsModalProps) {
  const stats = useMemo(() => {
    let salesAmount = 0;
    let purchasesAmount = 0;
    let cancelledAsSupplier = 0;
    let cancelledAsBuyer = 0;
    let completedAsSupplier = 0;
    let completedAsBuyer = 0;
    
    // items bought/sold: name -> count
    const consumedMaterials: Record<string, number> = {};
    const soldMaterials: Record<string, number> = {};

    requests.forEach(r => {
      // User as Buyer
      if (r.buyerId === user.id) {
        if (r.status === 'cancelled') {
          cancelledAsBuyer++;
        }
        if (r.status === 'delivered') {
          completedAsBuyer++;
          purchasesAmount += (r.totalAmount || r.price || 0);

          let items = r.items || [];
          if (items.length === 0 && r.productName) {
            items = [{ productName: r.productName, quantity: r.quantity || 1 }];
          }
          items.forEach((item: any) => {
            const name = item.productName || item.name || 'عنصر غير محدد';
            consumedMaterials[name] = (consumedMaterials[name] || 0) + Number(item.quantity || 1);
          });
        }
      }

      // User as Supplier
      if (r.supplierId === user.id) {
        if (r.status === 'cancelled') {
          cancelledAsSupplier++;
        }
        if (r.status === 'delivered') {
          completedAsSupplier++;
          salesAmount += (r.totalAmount || r.price || 0);

          let items = r.items || [];
          if (items.length === 0 && r.productName) {
            items = [{ productName: r.productName, quantity: r.quantity || 1 }];
          }
          items.forEach((item: any) => {
            const name = item.productName || item.name || 'عنصر غير محدد';
            soldMaterials[name] = (soldMaterials[name] || 0) + Number(item.quantity || 1);
          });
        }
      }
    });

    // top 5 consumed
    const topConsumed = Object.entries(consumedMaterials)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    // top 5 sold
    const topSold = Object.entries(soldMaterials)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    return {
      salesAmount,
      purchasesAmount,
      cancelledAsSupplier,
      cancelledAsBuyer,
      completedAsSupplier,
      completedAsBuyer,
      topConsumed,
      topSold
    };
  }, [user, requests]);

  if (!user) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800/20">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl font-bold border border-slate-700">
                  {user.name?.[0] || 'U'}
               </div>
               <div>
                 <h2 className="text-xl font-bold text-white">{user.businessName || user.name}</h2>
                 <p className="text-sm text-slate-400">{user.email}</p>
                 <div className="flex gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.role === 'supplier' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {user.role === 'supplier' ? 'مورد' : 'مشتري'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                       {user.phone || user.whatsappPhone || 'لا يوجد هاتف'}
                    </span>
                 </div>
               </div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                   <div className="flex items-center gap-2 text-slate-400 mb-2">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-xs font-bold">إجمالي المشتريات</span>
                   </div>
                   <p className="text-lg font-black text-white">{stats.purchasesAmount.toLocaleString('en-US')} ج.م</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                   <div className="flex items-center gap-2 text-slate-400 mb-2">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold">إجمالي المبيعات</span>
                   </div>
                   <p className="text-lg font-black text-emerald-500">{stats.salesAmount.toLocaleString('en-US')} ج.م</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-emerald-500/20">
                   <div className="flex items-center gap-2 text-emerald-500 mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-bold">مكتمل</span>
                   </div>
                   <p className="text-lg font-black text-emerald-500">
                     شراء: {stats.completedAsBuyer} <br/>
                     بيع: {stats.completedAsSupplier}
                   </p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-red-500/20">
                   <div className="flex items-center gap-2 text-red-500 mb-2">
                      <XCircle className="w-4 h-4" />
                      <span className="text-xs font-bold">ملغي</span>
                   </div>
                   <p className="text-lg font-black text-red-500">
                     كمشتري: {stats.cancelledAsBuyer} <br/>
                     كمورد: {stats.cancelledAsSupplier}
                   </p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                   <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      أكثر الخامات استهلاكاً (شراء)
                   </h3>
                   {stats.topConsumed.length > 0 ? (
                      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700/50">
                         {stats.topConsumed.map((item, idx) => (
                           <div key={idx} className="flex justify-between p-3 text-sm">
                             <span className="text-white font-medium">{item.name}</span>
                             <span className="text-slate-400">{item.qty} كمية</span>
                           </div>
                         ))}
                      </div>
                   ) : (
                      <p className="text-xs text-slate-500 italic">لا توجد بيانات مشتريات</p>
                   )}
                </div>

                <div className="space-y-3">
                   <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      أكثر الخامات مبيعاً (كمورد)
                   </h3>
                   {stats.topSold.length > 0 ? (
                      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700/50">
                         {stats.topSold.map((item, idx) => (
                           <div key={idx} className="flex justify-between p-3 text-sm">
                             <span className="text-white font-medium">{item.name}</span>
                             <span className="text-slate-400">{item.qty} كمية</span>
                           </div>
                         ))}
                      </div>
                   ) : (
                      <p className="text-xs text-slate-500 italic">لا توجد بيانات مبيعات</p>
                   )}
                </div>
             </div>

             <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 space-y-2">
                <h3 className="text-sm font-bold text-slate-400 mb-4">معلومات إضافية</h3>
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                   <div>
                      <span className="text-slate-500 block text-xs">تاريخ التسجيل</span>
                      <span className="text-white">
                         {user.createdAt ? (user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt)).toLocaleString('ar-EG') : '-'}
                      </span>
                   </div>
                   <div>
                      <span className="text-slate-500 block text-xs">العنوان</span>
                      <span className="text-white">{user.address || '-'}</span>
                   </div>
                   <div>
                      <span className="text-slate-500 block text-xs">حالة الحساب</span>
                      <span className="text-white">{user.disabled ? 'محظور / مجمد' : 'نشط'}</span>
                   </div>
                   <div>
                      <span className="text-slate-500 block text-xs">حالة الموافقة</span>
                      <span className="text-white">{user.status}</span>
                   </div>
                </div>
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
