import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, Package } from 'lucide-react';
import { CATEGORIES as APP_CATEGORIES } from '../../constants';
import { cn } from '../../lib/utils';
import ImageUpload from '../ui/ImageUpload';
import { SupplierStoreProduct } from '../../types';
import { MEASUREMENT_SYSTEMS, PACKAGING_TYPES, generateVariantName, ProductVariant } from '../../lib/inventoryUnits';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any, variants: ProductVariant[]) => void;
  product?: SupplierStoreProduct | null;
  adminMode?: boolean;
  suppliers?: any[];
}

export default function ProductFormModal({ isOpen, onClose, onSubmit, product, adminMode = false, suppliers = [] }: ProductFormModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'variants'>('basic');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: APP_CATEGORIES[0].name,
    available: true,
    image: '',
    price: '',
    stock: '',
    unit: 'كجم',
    supplierId: ''
  });

  const [variants, setVariants] = useState<ProductVariant[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setFormData({
          name: product.name,
          description: product.description || '',
          category: product.category,
          available: product.available ?? true,
          image: product.image || '',
          price: product.price.toString(),
          stock: (product.stock || 0).toString(),
          unit: product.unit || 'كجم',
          supplierId: product.supplierId || (suppliers[0]?.id || '')
        });
        if (product.variants && product.variants.length > 0) {
          setVariants(product.variants);
          setActiveTab('variants');
        } else {
          setVariants([]);
          setActiveTab('basic');
        }
      } else {
        setFormData({
          name: '',
          description: '',
          category: APP_CATEGORIES[0].name,
          available: true,
          image: '',
          price: '',
          stock: '',
          unit: 'كجم',
          supplierId: suppliers[0]?.id || ''
        });
        setVariants([]);
        setActiveTab('basic');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, product]);

  const handleAddVariant = () => {
    setVariants([...variants, {
      id: crypto.randomUUID(),
      system: 'weight',
      baseUnit: 'kg',
      unitValue: 1,
      packaging: 'single',
      qtyPerPackage: 1,
      price: 0,
      stock: 0,
      isDefault: variants.length === 0
    }]);
    setActiveTab('variants');
  };

  const updateVariant = (id: string, field: keyof ProductVariant, value: any) => {
    setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const setAsDefault = (id: string) => {
    setVariants(variants.map(v => ({ ...v, isDefault: v.id === id })));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData, variants);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        className="relative w-full max-w-2xl bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex flex-col border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 sm:p-8 pb-4">
            <div>
              <h2 className="text-xl font-display font-bold text-slate-900">
                {product ? 'تعديل المنتج' : 'إضافة منتج جديد'}
              </h2>
              <p className="text-xs text-slate-500 font-bold mt-1">تكوين المنتج، الوحدات والتسعير المتقدم</p>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-100 text-slate-500 rounded-2xl hidden sm:block hover:bg-slate-200 transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex gap-4 px-6 sm:px-8 px-8 overflow-x-auto scrollbar-none">
            <button
               onClick={() => setActiveTab('basic')}
               className={cn(
                 "pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap",
                 activeTab === 'basic' ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-slate-400 hover:text-slate-600"
               )}
            >
              البيانات الأساسية
            </button>
            <button
               onClick={() => setActiveTab('variants')}
               className={cn(
                 "pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap",
                 activeTab === 'variants' ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-slate-400 hover:text-slate-600"
               )}
            >
              <Package size={14} />
              العبوات والتسعير المتقدم
              {variants.length > 0 && (
                 <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">{variants.length}</span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 scrollbar-thin">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {adminMode && !product && suppliers.length > 0 && (
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">المورد المالك</label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                    required
                  >
                    {suppliers.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.businessName || s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">اسم المنتج</label>
                  <input 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="مثال: أرز بسمتي هندي"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">التصنيف</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                     {APP_CATEGORIES.map((cat) => (
                       <button
                         key={cat.name}
                         type="button"
                         onClick={() => setFormData({ ...formData, category: cat.name })}
                         className={cn(
                           "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5",
                           formData.category === cat.name
                             ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20"
                             : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                         )}
                       >
                         <span className="text-xl">{cat.icon}</span>
                         <span className="text-[10px] font-bold truncate w-full text-center">{cat.name}</span>
                       </button>
                     ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">وصف المنتج (اختياري)</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="أضف تفاصيل أكثر عن المنتج..."
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)] min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">صورة المنتج</label>
                  <ImageUpload 
                    value={formData.image}
                    onChange={(val) => setFormData({...formData, image: val})}
                    onRemove={() => setFormData({...formData, image: ''})}
                  />
                </div>
                
                {variants.length === 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">السعر (بسيط)</label>
                      <input 
                        type="number" step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">الكمية المتوفرة</label>
                      <input 
                        type="number"
                        value={formData.stock}
                        onChange={(e) => setFormData({...formData, stock: e.target.value})}
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">الوحدة</label>
                      <input 
                        type="text"
                        value={formData.unit}
                        onChange={(e) => setFormData({...formData, unit: e.target.value})}
                        placeholder="مثل: كجم، قطعة..."
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                  </div>
                )}
                
                {variants.length === 0 && (
                   <div className="bg-primary-50 text-primary-700 p-4 rounded-2xl text-xs font-bold border border-primary-100 flex justify-between items-center mt-4">
                     <div>
                       هل تبيع المنتج بأشكال متعددة (كرتونة، عبوة، حبة)؟ 
                     </div>
                     <button onClick={handleAddVariant} className="bg-primary-600 text-white px-3 py-1.5 rounded-lg">إعداد متقدم</button>
                   </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'variants' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                 <div>
                    <h3 className="font-bold text-slate-900 text-sm">الباقات والوحدات المتقدمة</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">أضف جميع خيارات التعبئة للمنتج (مثال: حبة، كرتونة، باليتة)</p>
                 </div>
                 <button 
                  onClick={handleAddVariant}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                 >
                   <Plus size={14} /> إضافة تعبئة
                 </button>
              </div>

              {variants.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                  <Package size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-500">لا توجد خيارات تعبئة. سيتم استخدام التسعير البسيط.</p>
                  <button onClick={handleAddVariant} className="mt-4 text-primary-600 text-sm font-black hover:underline">أضف أول وحدة الآن</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {variants.map((variant, index) => {
                     const currentSystem = MEASUREMENT_SYSTEMS.find(s => s.id === variant.system) || MEASUREMENT_SYSTEMS[0];
                     return (
                       <div key={variant.id} className={cn("border-2 rounded-2xl p-4 transition-all", variant.isDefault ? "border-primary-500 bg-primary-50/10" : "border-slate-100 bg-slate-50")}>
                          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200/50">
                             <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-black">{index + 1}</div>
                               <h4 className="font-black text-slate-800">{generateVariantName(variant) || 'عبوة جديدة'}</h4>
                               {variant.isDefault && (
                                 <span className="bg-primary-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">الوحدة الافتراضية</span>
                               )}
                             </div>
                             <div className="flex items-center gap-2">
                               {!variant.isDefault && (
                                 <button onClick={() => setAsDefault(variant.id)} className="text-[10px] font-bold text-slate-500 hover:text-primary-600 underline">تعيين كافتراضي</button>
                               )}
                               <button onClick={() => removeVariant(variant.id)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                                 <Trash2 size={16} />
                               </button>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                             <div className="col-span-2">
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">نظام القياس</label>
                               <select 
                                 value={variant.system}
                                 onChange={(e) => {
                                   const newSystem = MEASUREMENT_SYSTEMS.find(s => s.id === e.target.value);
                                   if(newSystem) {
                                      updateVariant(variant.id, 'system', newSystem.id);
                                      updateVariant(variant.id, 'baseUnit', newSystem.units[0]);
                                   }
                                 }}
                                 className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:border-primary-500 outline-none"
                               >
                                 {MEASUREMENT_SYSTEMS.map(sys => <option key={sys.id} value={sys.id}>{sys.label}</option>)}
                               </select>
                             </div>
                             
                             <div>
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">وحدة القياس</label>
                               <select 
                                 value={variant.baseUnit}
                                 onChange={(e) => updateVariant(variant.id, 'baseUnit', e.target.value)}
                                 className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:border-primary-500 outline-none"
                               >
                                 {currentSystem.units.map(u => <option key={u} value={u}>{u}</option>)}
                               </select>
                             </div>

                             <div>
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">قيمة الوحدة</label>
                               <input 
                                 type="number"
                                 value={variant.unitValue}
                                 onChange={(e) => updateVariant(variant.id, 'unitValue', Number(e.target.value))}
                                 placeholder="مثال: 330"
                                 className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:border-primary-500 outline-none"
                               />
                             </div>

                             <div className="col-span-2">
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">نوع التعبئة</label>
                               <select 
                                 value={variant.packaging}
                                 onChange={(e) => updateVariant(variant.id, 'packaging', e.target.value)}
                                 className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:border-primary-500 outline-none"
                               >
                                 {PACKAGING_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                               </select>
                             </div>

                             <div className="col-span-2">
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">الكمية داخل التعبئة</label>
                               <input 
                                 type="number"
                                 value={variant.qtyPerPackage}
                                 onChange={(e) => updateVariant(variant.id, 'qtyPerPackage', Number(e.target.value))}
                                 placeholder="مثال: 24 (في الكرتونة)"
                                 disabled={variant.packaging === 'single'}
                                 className={cn("w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:border-primary-500 outline-none", variant.packaging === 'single' && 'opacity-50 bg-slate-100')}
                               />
                             </div>

                             <div className="col-span-2">
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">السعر (ج.م)</label>
                               <input 
                                 type="number" step="0.01"
                                 value={variant.price || ''}
                                 onChange={(e) => updateVariant(variant.id, 'price', Number(e.target.value))}
                                 className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-green-600 focus:ring-1 focus:border-primary-500 outline-none"
                               />
                             </div>

                             <div className="col-span-2">
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">المخزون المتوفر</label>
                               <input 
                                 type="number"
                                 value={variant.stock || ''}
                                 onChange={(e) => updateVariant(variant.id, 'stock', Number(e.target.value))}
                                 placeholder="عدد العبوات المتوفرة"
                                 className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:border-primary-500 outline-none"
                               />
                             </div>
                             
                             <div className="col-span-4 mt-2">
                               <label className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                 <input type="checkbox" checked={variant.isDefault} onChange={() => setAsDefault(variant.id)} className="w-4 h-4 text-primary-600 rounded border-slate-300" />
                                 <span className="text-[11px] font-bold text-slate-700">هذه هي الوحدة الافتراضية التي تظهر للعملاء أولاً</span>
                               </label>
                             </div>
                          </div>
                       </div>
                     )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-6 sm:p-8 pt-4 border-t border-slate-100 bg-slate-50/50 flex gap-3">
           <button 
             type="button" onClick={onClose}
             className="flex-1 py-3 text-slate-500 font-bold border-2 border-slate-200/50 rounded-2xl hover:bg-slate-100 hover:text-slate-700 transition-colors text-sm"
           >
             إلغاء التعديلات
           </button>
           <button 
             type="button" onClick={handleSave}
             className="flex-[2] py-3 bg-[var(--color-primary)] text-white font-bold rounded-2xl shadow-xl shadow-[var(--color-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm"
           >
             {product ? 'حفظ وتطبيق' : 'إنشاء المنتج الجديد'}
           </button>
        </div>
      </motion.div>
    </div>
  );
}
