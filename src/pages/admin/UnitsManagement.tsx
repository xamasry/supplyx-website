import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Scale,
  RefreshCw,
  Search,
  Loader2,
  X,
  PlusCircle,
  ArrowRightLeft,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, OperationType, handleFirestoreError } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { cn } from "../../lib/utils";
import { Unit, UnitConversion } from "../../types";

export default function UnitsManagement() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"units" | "conversions">("units");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"unit" | "conversion">("unit");
  const [isSaving, setIsSaving] = useState(false);

  // Unit Form State
  const [unitForm, setUnitForm] = useState({
    name: "",
    abbreviation: "",
    type: "mass" as Unit["type"],
    isStandard: false,
  });

  // Conversion Form State
  const [convForm, setConvForm] = useState({
    fromUnitId: "",
    toUnitId: "",
    multiplier: 1,
  });

  useEffect(() => {
    const unsubUnits = onSnapshot(
      query(collection(db, "units"), orderBy("name")),
      (snap) => {
        setUnits(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Unit));
        setLoading(false);
      }
    );

    const unsubConvs = onSnapshot(collection(db, "conversions"), (snap) => {
      setConversions(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UnitConversion)
      );
    });

    return () => {
      unsubUnits();
      unsubConvs();
    };
  }, []);

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const unitId = unitForm.name.toLowerCase().replace(/\s+/g, "_");
      await setDoc(doc(db, "units", unitId), {
        ...unitForm,
        updatedAt: serverTimestamp(),
      });
      toast.success("تم حفظ الوحدة بنجاح");
      setIsModalOpen(false);
      setUnitForm({ name: "", abbreviation: "", type: "mass", isStandard: false });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "units");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const convId = `${convForm.fromUnitId}_to_${convForm.toUnitId}`;
      await setDoc(doc(db, "conversions", convId), {
        ...convForm,
        updatedAt: serverTimestamp(),
      });
      toast.success("تم حفظ معامل التحويل بنجاح");
      setIsModalOpen(false);
      setConvForm({ fromUnitId: "", toUnitId: "", multiplier: 1 });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "conversions");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (coll: string, id: string) => {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      await deleteDoc(doc(db, coll, id));
      toast.success("تم الحذف بنجاح");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, coll);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter">وحدات القياس والتحويل</h2>
          <p className="text-slate-400 text-sm mt-1 font-medium italic">إدارة المنظومة المعيارية للكميات والأوزان</p>
        </div>

        <div className="flex bg-[#030712]/60 p-1.5 rounded-2xl border border-white/[0.08] backdrop-blur-xl">
          <button
            onClick={() => setActiveTab("units")}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2",
              activeTab === "units" ? "bg-primary-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-200"
            )}
          >
            <Scale size={14} />
            الوحدات
          </button>
          <button
            onClick={() => setActiveTab("conversions")}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2",
              activeTab === "conversions" ? "bg-primary-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-200"
            )}
          >
            <RefreshCw size={14} />
            التحويلات
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between bg-[#030712]/40 p-4 rounded-3xl border border-white/[0.05] backdrop-blur-md">
        <div className="flex items-center gap-2 text-slate-400">
          {activeTab === "units" ? (
            <span className="text-xs font-bold">إجمالي الوحدات المسجلة: {units.length}</span>
          ) : (
            <span className="text-xs font-bold">إجمالي قواعد التحويل: {conversions.length}</span>
          )}
        </div>
        <button
          onClick={() => {
            setModalType(activeTab === "units" ? "unit" : "conversion");
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95"
        >
          <PlusCircle size={18} />
          إضافة {activeTab === "units" ? "وحدة جديدة" : "تحويل جديد"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "units" ? (
          <motion.div
            key="units-grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {units.map((u) => (
              <div
                key={u.id}
                className="bg-[#030712]/60 border border-white/[0.08] rounded-2xl p-5 group hover:border-primary-500/30 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-primary-500 font-black">
                      {u.abbreviation}
                    </div>
                    <div>
                      <h4 className="text-white font-black text-sm">{u.name}</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{u.type}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete("units", u.id!)}
                    className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {u.isStandard && (
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/10">
                      وحدة معيارية (Base)
                    </span>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="conv-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {conversions.map((c) => {
              const fromUnit = units.find((u) => u.id === c.fromUnitId);
              const toUnit = units.find((u) => u.id === c.toUnitId);
              return (
                <div
                  key={c.id}
                  className="bg-[#030712]/60 border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between group hover:border-primary-500/30 transition-all"
                >
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-black">1 {fromUnit?.name || c.fromUnitId}</span>
                      <ChevronRight size={14} className="text-slate-600" />
                      <div className="bg-primary-500/10 border border-primary-500/20 text-primary-500 font-black px-3 py-1 rounded-lg text-sm">
                        x {c.multiplier}
                      </div>
                      <ChevronRight size={14} className="text-slate-600" />
                      <span className="text-white font-black">{toUnit?.name || c.toUnitId}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete("conversions", c.id!)}
                    className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-[#030712] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
              dir="rtl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-white tracking-tighter">
                  {modalType === "unit" ? "إضافة وحدة جديدة" : "إضافة قاعدة تحويل"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              {modalType === "unit" ? (
                <form onSubmit={handleSaveUnit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 mr-2 uppercase tracking-widest">اسم الوحدة (مثل: كيلوجرام)</label>
                    <input
                      required
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500"
                      value={unitForm.name}
                      onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 mr-2 uppercase tracking-widest">الاختصار (مثل: كجم)</label>
                    <input
                      required
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500"
                      value={unitForm.abbreviation}
                      onChange={(e) => setUnitForm({ ...unitForm, abbreviation: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 mr-2 uppercase tracking-widest">النوع</label>
                      <select
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500 appearance-none font-bold"
                        value={unitForm.type}
                        onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value as any })}
                      >
                        <option value="mass">وزن (Mass)</option>
                        <option value="volume">حجم (Volume)</option>
                        <option value="count">عدد (Count)</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>
                    <div className="flex flex-col justify-end pb-4 items-center">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={unitForm.isStandard}
                          onChange={(e) => setUnitForm({ ...unitForm, isStandard: e.target.checked })}
                        />
                        <div className={cn(
                          "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                          unitForm.isStandard ? "bg-primary-500 border-primary-500 shadow-lg shadow-primary-500/20" : "border-white/10"
                        )}>
                          {unitForm.isStandard && <Scale size={14} className="text-white" />}
                        </div>
                        <span className="text-xs font-black text-slate-300">وحدة معيارية</span>
                      </label>
                    </div>
                  </div>
                  <button
                    disabled={isSaving}
                    className="w-full bg-primary-600 hover:bg-primary-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-primary-500/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : "حفظ الوحدة"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSaveConversion} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 mr-2 uppercase tracking-widest">من وحدة</label>
                      <select
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500 appearance-none font-bold"
                        value={convForm.fromUnitId}
                        onChange={(e) => setConvForm({ ...convForm, fromUnitId: e.target.value })}
                      >
                        <option value="">اختر الوحدة</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id} className="bg-slate-900">{u.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 mr-2 uppercase tracking-widest">إلى وحدة</label>
                      <select
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500 appearance-none font-bold"
                        value={convForm.toUnitId}
                        onChange={(e) => setConvForm({ ...convForm, toUnitId: e.target.value })}
                      >
                        <option value="">اختر الوحدة</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id} className="bg-slate-900">{u.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 mr-2 uppercase tracking-widest">المعامل الضرب (Multiplier)</label>
                    <div className="relative">
                      <input
                        required
                        type="number"
                        step="any"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary-500 font-black text-center text-xl"
                        value={convForm.multiplier}
                        onChange={(e) => setConvForm({ ...convForm, multiplier: parseFloat(e.target.value) })}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                        <ArrowRightLeft size={20} />
                      </div>
                    </div>
                    <p className="text-[10px] text-center text-slate-500 mt-2 font-bold italic">
                      مثال: للتحويل من كيلوجرام لجرام، المعامل = 1000
                    </p>
                  </div>
                  <button
                    disabled={isSaving}
                    className="w-full bg-primary-600 hover:bg-primary-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-primary-500/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : "حفظ معامل التحويل"}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
