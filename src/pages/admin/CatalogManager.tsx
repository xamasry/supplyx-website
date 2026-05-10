import React, { useState } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
  Store,
  Tag,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ArrowUpDown,
  ShoppingBag,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ProductFormModal from "../../components/supplier/ProductFormModal";
import { db, OperationType, handleFirestoreError } from "../../lib/firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { cn } from "../../lib/utils";
import { CATEGORIES as APP_CATEGORIES } from "../../constants";

const CATEGORIES = APP_CATEGORIES.map((c) => c.name);

interface CatalogManagerProps {
  users: any[];
  products: any[];
  offers: any[];
}

export default function CatalogManager({
  users,
  products,
  offers,
}: CatalogManagerProps) {
  const [view, setView] = useState<"suppliers" | "products" | "offers">(
    "suppliers",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"product" | "offer">("product");
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    unit: "كجم",
    category: CATEGORIES[0],
    available: true,
    image: "",
    supplierId: "",
    variants: [] as any[],
  });

  const [offerFormData, setOfferFormData] = useState({
    title: "",
    description: "",
    offerPrice: "",
    originalPrice: "",
    stock: "",
    image: "",
    supplierId: "",
    unit: "قطعة",
  });

  const suppliers = users.filter((u) => u.role === "supplier");

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone?.includes(searchTerm),
  );

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSupplier = selectedSupplierId ? p.supplierId === selectedSupplierId : true;
    return matchesSearch && matchesSupplier;
  });

  const filteredOffers = offers.filter((o) => {
    const matchesSearch = o.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSupplier = selectedSupplierId ? o.supplierId === selectedSupplierId : true;
    return matchesSearch && matchesSupplier;
  });

  const handleOpenModal = (type: "product" | "offer", item: any = null, supplierId: string | null = null) => {
    setModalType(type);
    setEditingItem(item);
    
    if (type === "product") {
      setFormData({
        name: item?.name || "",
        description: item?.description || "",
        price: item?.price?.toString() || "",
        stock: item?.stock?.toString() || "",
        unit: item?.unit || "كجم",
        category: item?.category || CATEGORIES[0],
        available: item?.available !== undefined ? item.available : true,
        image: item?.image || "",
        supplierId: item?.supplierId || supplierId || (suppliers[0]?.id || ""),
      });
    } else {
      setOfferFormData({
        title: item?.title || "",
        description: item?.description || "",
        offerPrice: item?.offerPrice?.toString() || "",
        originalPrice: item?.originalPrice?.toString() || "",
        stock: item?.stock?.toString() || "",
        image: item?.image || "",
        supplierId: item?.supplierId || supplierId || (suppliers[0]?.id || ""),
        unit: item?.unit || "قطعة",
      });
    }
    setIsModalOpen(true);
  };

  const handleProductSubmit = async (modalFormData: any, variants: any[]) => {
    setIsSaving(true);
    try {
        const supplier = users.find(u => u.id === modalFormData.supplierId);
        
        // Map default variant to root fields for backwards compatibility
        let price = parseFloat(modalFormData.price) || 0;
        let stock = parseFloat(modalFormData.stock) || 0;
        let unit = modalFormData.unit;
        
        if (variants.length > 0) {
           const defaultVariant = variants.find(v => v.isDefault) || variants[0];
           if (defaultVariant) {
              price = defaultVariant.price;
              stock = defaultVariant.stock;
              const { generateVariantName } = await import('../../lib/inventoryUnits');
              unit = generateVariantName(defaultVariant) || defaultVariant.baseUnit;
           }
        }

        const data = {
          name: modalFormData.name.trim(),
          description: modalFormData.description.trim(),
          price,
          stock,
          unit,
          variants,
          category: modalFormData.category,
          available: modalFormData.available,
          image: modalFormData.image.trim() || null,
          supplierId: modalFormData.supplierId || supplier?.id || "",
          supplierName: supplier?.businessName || supplier?.name || "مورد",
          updatedAt: serverTimestamp(),
        };

        if (editingItem) {
          await updateDoc(doc(db, "products", editingItem.id), data);
          toast.success("تم تحديث المنتج بنجاح");
        } else {
          await addDoc(collection(db, "products"), {
            ...data,
            createdAt: serverTimestamp(),
          });
          toast.success("تم إضافة المنتج بنجاح");
        }
        setIsModalOpen(false);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (modalType === "product") {
        const supplier = users.find(u => u.id === formData.supplierId);
        const data = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          price: parseFloat(formData.price),
          stock: parseFloat(formData.stock) || 0,
          unit: formData.unit,
          category: formData.category,
          available: formData.available,
          image: formData.image.trim() || null,
          supplierId: formData.supplierId,
          supplierName: supplier?.businessName || supplier?.name || "مورد",
          updatedAt: serverTimestamp(),
        };

        if (editingItem) {
          await updateDoc(doc(db, "products", editingItem.id), data);
          toast.success("تم تحديث المنتج بنجاح");
        } else {
          await addDoc(collection(db, "products"), {
            ...data,
            createdAt: serverTimestamp(),
          });
          toast.success("تم إضافة المنتج بنجاح");
        }
      } else {
        const supplier = users.find(u => u.id === offerFormData.supplierId);
        const data = {
          title: offerFormData.title.trim(),
          description: offerFormData.description.trim(),
          offerPrice: parseFloat(offerFormData.offerPrice),
          originalPrice: parseFloat(offerFormData.originalPrice),
          stock: parseFloat(offerFormData.stock) || 0,
          unit: offerFormData.unit,
          image: offerFormData.image.trim() || null,
          supplierId: offerFormData.supplierId,
          supplierName: supplier?.businessName || supplier?.name || "مورد",
          status: "active",
          updatedAt: serverTimestamp(),
        };

        if (editingItem) {
          await updateDoc(doc(db, "offers", editingItem.id), data);
          toast.success("تم تحديث العرض بنجاح");
        } else {
          await addDoc(collection(db, "offers"), {
            ...data,
            createdAt: serverTimestamp(),
            views: 0,
            orders: 0,
          });
          toast.success("تم إضافة العرض بنجاح");
        }
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (type: "product" | "offer", id: string) => {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      await deleteDoc(doc(db, type === "product" ? "products" : "offers", id));
      toast.success("تم الحذف بنجاح");
    } catch (error) {
      toast.error("فشل الحذف");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Tabs */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter">الكتالوج الشامل</h2>
          <p className="text-slate-400 text-sm mt-1 font-medium">إدارة كافة المعروضات من منتجات وعروض من الموردين</p>
        </div>
        
        <div className="flex bg-[#030712]/60 p-1.5 rounded-2xl border border-white/[0.08] backdrop-blur-xl">
          <button
            onClick={() => { setView("suppliers"); setSelectedSupplierId(null); }}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black transition-all",
              view === "suppliers" ? "bg-primary-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-200"
            )}
          >
            الموردين
          </button>
          <button
            onClick={() => { setView("products"); setSelectedSupplierId(null); }}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black transition-all",
              view === "products" ? "bg-primary-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-200"
            )}
          >
            المنتجات
          </button>
          <button
            onClick={() => { setView("offers"); setSelectedSupplierId(null); }}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black transition-all",
              view === "offers" ? "bg-primary-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-200"
            )}
          >
            العروض
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-[#030712]/40 p-4 rounded-3xl border border-white/[0.05] backdrop-blur-md">
        <div className="relative flex-1 group w-full">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-primary-500 transition-colors" />
          <input
            type="text"
            placeholder={
              view === "suppliers" ? "بحث عن مورد بالاسم أو الهاتف..." :
              view === "products" ? "بحث عن منتج..." : "بحث عن عرض..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-2xl py-3 pr-12 pl-4 text-sm text-white outline-none focus:border-primary-500/50 transition-all"
          />
        </div>
        
        {view !== "suppliers" && (
          <button
            onClick={() => handleOpenModal(view === "products" ? "product" : "offer")}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-primary-500/20 active:scale-95"
          >
            <Plus size={18} />
            إضافة {view === "products" ? "منتج" : "عرض"}
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {view === "suppliers" && (
          <motion.div
            key="suppliers"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filteredSuppliers.map((s) => (
              <div
                key={s.id}
                className="bg-[#030712]/60 border border-white/[0.08] rounded-3xl p-6 hover:border-primary-500/30 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5 flex items-center justify-center text-primary-500 font-black text-2xl shadow-inner">
                      {s.businessName ? s.businessName[0] : s.name[0]}
                    </div>
                    <div>
                      <h3 className="font-black text-white text-lg leading-tight uppercase">{s.businessName || s.name}</h3>
                      <p className="text-slate-500 text-xs mt-1 font-bold">{s.phone}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/10">
                          {products.filter(p => p.supplierId === s.id).length} منتج
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/10">
                          {offers.filter(o => o.supplierId === s.id).length} عرض
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setSelectedSupplierId(s.id); setView("products"); }}
                    className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white py-3 rounded-2xl text-xs font-black transition-all border border-white/5"
                  >
                    <Package size={14} />
                    عرض المنتجات
                  </button>
                  <button
                    onClick={() => { setSelectedSupplierId(s.id); setView("offers"); }}
                    className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white py-3 rounded-2xl text-xs font-black transition-all border border-white/5"
                  >
                    <Tag size={14} />
                    عرض العروض
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {view === "products" && (
          <motion.div
            key="products"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {selectedSupplierId && (
              <div className="flex items-center gap-3 text-slate-400 bg-white/5 p-4 rounded-2xl border border-white/5">
                <Store size={18} />
                <span className="text-sm font-bold">منتجات المورد: {users.find(u => u.id === selectedSupplierId)?.businessName}</span>
                <button 
                  onClick={() => setSelectedSupplierId(null)}
                  className="mr-auto text-[10px] font-black text-primary-400 hover:underline"
                >
                  عرض كافة الموردين
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#030712]/60 border border-white/[0.08] rounded-3xl overflow-hidden hover:border-primary-500/30 transition-all group flex flex-col h-full"
                >
                  <div className="aspect-square relative bg-black/40 overflow-hidden">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-800">
                        <Package size={64} />
                      </div>
                    )}
                    <div className="absolute top-4 right-4 flex gap-2">
                       <button 
                        onClick={() => handleOpenModal("product", p)}
                        className="p-2.5 bg-black/60 backdrop-blur-md text-white rounded-xl border border-white/10 hover:bg-primary-600 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete("product", p.id)}
                        className="p-2.5 bg-black/60 backdrop-blur-md text-white rounded-xl border border-white/10 hover:bg-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="absolute bottom-4 right-4 bg-primary-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-xl uppercase tracking-tighter">
                      {p.category}
                    </div>
                  </div>
                  
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-white font-black text-lg leading-tight line-clamp-1">{p.name}</h4>
                      <p className="text-slate-500 text-xs italic mt-1 line-clamp-2 min-h-[2rem]">{p.description}</p>
                      
                      <div className="mt-4 flex flex-col gap-2">
                        {p.variants && p.variants.length > 0 ? (
                           <div className="flex flex-col gap-1 text-[10px] bg-primary-500/10 border border-primary-500/20 p-2 rounded-xl">
                              <span className="font-bold text-primary-400">نظام تسعير متقدم ({p.variants.length} خيارات)</span>
                              <div className="flex items-center justify-between text-slate-300">
                                <span>يبدأ من:</span>
                                <span className="font-black text-white">{Math.min(...p.variants.map((v: any) => v.price))} ج.م</span>
                              </div>
                           </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-white">{p.price}</span>
                                <span className="text-[10px] text-slate-500 font-bold">ج.م / {p.unit}</span>
                              </div>
                              <div className={`text-[10px] font-black px-2 py-1 rounded-lg border ${p.available ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10' : 'bg-red-500/10 text-red-500 border-red-500/10'}`}>
                                {p.available ? 'متاح' : 'غير متاح'}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 bg-white/5 p-2 rounded-lg">
                              <span>الكمية المتاحة:</span>
                              <span className="text-white">{p.stock || 0} {p.unit}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-primary-500">
                        {p.supplierName[0]}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 line-clamp-1">{p.supplierName}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {view === "offers" && (
          <motion.div
            key="offers"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {selectedSupplierId && (
              <div className="flex items-center gap-3 text-slate-400 bg-white/5 p-4 rounded-2xl border border-white/5">
                <Tag size={18} />
                <span className="text-sm font-bold">عروض المورد: {users.find(u => u.id === selectedSupplierId)?.businessName}</span>
                <button 
                  onClick={() => setSelectedSupplierId(null)}
                  className="mr-auto text-[10px] font-black text-primary-400 hover:underline"
                >
                  عرض كافة الموردين
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredOffers.map((o) => (
                <div
                  key={o.id}
                  className="bg-[#030712]/60 border border-white/[0.08] rounded-3xl overflow-hidden hover:border-primary-500/30 transition-all group flex flex-col h-full"
                >
                  <div className="aspect-video relative bg-black/40 overflow-hidden">
                    {o.image ? (
                      <img src={o.image} alt={o.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-800">
                        <Tag size={64} />
                      </div>
                    )}
                    <div className="absolute top-4 right-4 flex gap-2">
                       <button 
                        onClick={() => handleOpenModal("offer", o)}
                        className="p-2.5 bg-black/60 backdrop-blur-md text-white rounded-xl border border-white/10 hover:bg-primary-600 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete("offer", o.id)}
                        className="p-2.5 bg-black/60 backdrop-blur-md text-white rounded-xl border border-white/10 hover:bg-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="absolute bottom-4 right-4 bg-amber-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-xl">
                      {Math.round((1 - o.offerPrice/o.originalPrice) * 100)}% خصم
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-white font-black text-lg leading-tight line-clamp-1">{o.title}</h4>
                      <p className="text-slate-500 text-xs italic mt-1 line-clamp-2 min-h-[2rem]">{o.description}</p>
                      
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <span className="text-2xl font-black text-white">{o.offerPrice}</span>
                              <span className="text-[10px] text-slate-500 font-bold line-through">{o.originalPrice} ج.م</span>
                           </div>
                           <div className="text-[10px] font-black px-2 py-1 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/10">
                             {o.stock || 0} {o.unit || 'قطعة'} متوفر
                           </div>
                        </div>
                        <p className="text-[10px] text-emerald-500 font-black">سعر العرض الحصري</p>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-primary-500">
                          {o.supplierName[0]}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 line-clamp-1">{o.supplierName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-500">
                        <div className="flex items-center gap-1">
                          <Eye size={12} />
                          <span className="text-[10px] font-bold">{o.views || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ShoppingBag size={12} />
                          <span className="text-[10px] font-bold">{o.orders || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product / Offer Modal */}
      <AnimatePresence>
        {isModalOpen && modalType === "offer" && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#030712] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
              dir="rtl"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tighter">
                    {editingItem ? "تعديل" : "إضافة"} {modalType === "product" ? "منتج" : "عرض"}
                  </h3>
                  <p className="text-slate-500 text-xs mt-1">يرجى ملء كافة البيانات المطلوبة للمنتج</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Supplier Selection (Only for Add) */}
                {!editingItem && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 mr-2 uppercase tracking-widest">المورد المالك</label>
                    <select
                      value={offerFormData.supplierId}
                      onChange={(e) => setOfferFormData({ ...offerFormData, supplierId: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500/50 appearance-none font-bold"
                      required
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id} className="bg-slate-900">{s.businessName || s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <>
                  <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 mr-2">عنوان العرض</label>
                      <input
                        type="text"
                        value={offerFormData.title}
                        onChange={(e) => setOfferFormData({ ...offerFormData, title: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500/50 font-bold"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 mr-2">وحدة القياس</label>
                        <input
                          type="text"
                          value={offerFormData.unit}
                          onChange={(e) => setOfferFormData({ ...offerFormData, unit: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500/50 font-bold"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 mr-2">سعر العرض (ج.م)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={offerFormData.offerPrice}
                          onChange={(e) => setOfferFormData({ ...offerFormData, offerPrice: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500/50 font-bold"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 mr-2">السعر الأصلي (ج.م)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={offerFormData.originalPrice}
                          onChange={(e) => setOfferFormData({ ...offerFormData, originalPrice: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500/50 font-bold"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 mr-2">الكمية المتوفرة</label>
                        <input
                          type="number"
                          value={offerFormData.stock}
                          onChange={(e) => setOfferFormData({ ...offerFormData, stock: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500/50 font-bold"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 mr-2">الوصف</label>
                      <textarea
                        value={offerFormData.description}
                        onChange={(e) => setOfferFormData({ ...offerFormData, description: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500/50 font-bold min-h-[100px]"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 mr-2">رابط صورة العرض</label>
                      <input
                        type="url"
                        value={offerFormData.image}
                        onChange={(e) => setOfferFormData({ ...offerFormData, image: e.target.value })}
                        placeholder="https://example.com/image.jpg"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500/50 font-mono text-sm"
                      />
                    </div>
                  </>

                <div className="pt-8 flex gap-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:bg-primary-800 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-primary-500/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      editingItem ? "حفظ التعديلات" : "إضافة العرض"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-sm transition-all border border-white/5"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
