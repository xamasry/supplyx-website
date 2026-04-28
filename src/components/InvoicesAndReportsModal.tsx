import { useState, useEffect, useRef } from 'react';
import { 
  X, FileText, Download, TrendingUp, DollarSign, Package, 
  Calendar, ChevronRight, Printer, ExternalLink, ArrowDownLeft, ArrowUpRight,
  Image as ImageIcon, FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area
} from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import Logo from './ui/Logo';

interface InvoicesAndReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'buyer' | 'supplier';
}

export default function InvoicesAndReportsModal({ isOpen, onClose, role }: InvoicesAndReportsModalProps) {
  const [activeTab, setActiveTab] = useState<'invoices' | 'reports'>('reports');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({
    totalAmount: 0,
    count: 0,
    average: 0
  });

  const fixOklchInClone = (clonedDoc: Document) => {
    // 1. Force a clean style ignore for oklch in the clone
    const style = clonedDoc.createElement('style');
    style.innerHTML = `
      :root {
        --color-primary: #0f172a !important;
      }
      * {
        color: #1e293b !important; /* Default dark slate */
        border-color: #e2e8f0 !important; /* Default border */
        background-color: transparent;
      }
      .invoice-container {
        background-color: #ffffff !important;
      }
      .invoice-header-bg {
        background-color: #000000 !important;
        color: #ffffff !important;
      }
      .text-primary-fallback {
        color: #0f172a !important;
      }
      .bg-primary-fallback {
        background-color: #0f172a !important;
      }
    `;
    clonedDoc.head.appendChild(style);

    // 2. Remove any OKLCH variables from the root of the clone
    const root = clonedDoc.documentElement;
    const computed = window.getComputedStyle(root);
    for (let i = 0; i < root.style.length; i++) {
        const prop = root.style[i];
        if (prop.startsWith('--') && root.style.getPropertyValue(prop).includes('oklch')) {
            root.style.setProperty(prop, '#000000');
        }
    }
  };

  const handleSaveAsImage = async () => {
    if (!invoiceRef.current || !selectedInvoice) return;
    setIsSaving(true);
    const toastId = toast.loading('جاري حفظ الفاتورة كصورة...');
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          fixOklchInClone(clonedDoc);
        }
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `فاتورة-${selectedInvoice.id.slice(0, 8)}.png`;
      link.click();
      toast.success('تم الحفظ بنجاح', { id: toastId });
    } catch (error) {
      console.error('Error saving image:', error);
      toast.error('فشل حفظ الصورة، يرجى المحاولة مرة أخرى', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsPDF = () => {
    // Relying on native browser print dialog, which allows saving as PDF effortlessly and faithfully.
    setTimeout(() => {
      window.print();
    }, 100);
  };
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;

    const userIdField = role === 'buyer' ? 'buyerId' : 'supplierId';
    const q = query(
      collection(db, 'requests'),
      where(userIdField, '==', auth.currentUser.uid),
      where('status', '==', 'delivered'),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvoices(docs);
      
      // Calculate Stats
      const total = docs.reduce((acc, curr: any) => acc + (curr.price || 0), 0);
      setStats({
        totalAmount: total,
        count: docs.length,
        average: docs.length > 0 ? total / docs.length : 0
      });

      // Prepare Chart Data (last 30 days or based on available data)
      const dailyData: Record<string, number> = {};
      docs.forEach((doc: any) => {
        const date = doc.updatedAt?.toDate() || new Date();
        const key = format(date, 'yyyy-MM-dd');
        dailyData[key] = (dailyData[key] || 0) + (doc.price || 0);
      });

      const chart = Object.entries(dailyData)
        .map(([date, amount]) => ({
          date,
          amount,
          label: format(new Date(date), 'dd MMM', { locale: ar })
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setChartData(chart);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, role]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-[#F8FAFC] w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans"
        dir="rtl"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 leading-tight">مركز الفواتير والتقارير</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {role === 'buyer' ? 'إجمالي المشتريات والمصروفات' : 'إجمالي المبيعات والأرباح'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Tabs navigation */}
        <div className="px-6 pt-4 bg-white flex gap-6 border-b border-slate-100 shrink-0">
          <button 
            onClick={() => setActiveTab('reports')}
            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'reports' ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}
          >
            التقارير المالية
            {activeTab === 'reports' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-primary)] rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('invoices')}
            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'invoices' ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}
          >
            سجل الفواتير
            {activeTab === 'invoices' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-primary)] rounded-t-full" />}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
               <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                 <TrendingUp className="w-8 h-8 opacity-20" />
               </motion.div>
               <p className="text-xs font-bold mt-4">جاري تحميل البيانات...</p>
            </div>
          ) : activeTab === 'reports' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                      {role === 'buyer' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <span className="text-xs font-bold text-slate-500">{role === 'buyer' ? 'إجمالي الإنفاق' : 'إجمالي الأرباح'}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-900">{stats.totalAmount.toLocaleString('ar-EG')}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">ج.م</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-500">عدد المعاملات</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-900">{stats.count}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">فاتورة</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-500">متوسط قيمة الفاتورة</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-900">{Math.round(stats.average).toLocaleString('ar-EG')}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">ج.م</span>
                  </div>
                </div>
              </div>

              {/* Chart Section */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />
                    تحليل {role === 'buyer' ? 'المصروفات' : 'المبيعات'} (آخر 30 يوم)
                  </h3>
                  <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">المبالغ بالجنيه المصري</div>
                </div>
                
                <div className="h-64 mt-4 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="label" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        reversed
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        orientation="right"
                        tickFormatter={(value) => `${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
                          direction: 'rtl',
                          fontFamily: 'inherit'
                        }}
                        itemStyle={{ color: 'var(--color-primary)', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="var(--color-primary)" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorAmount)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Transactions List Preview */}
              <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                <div className="p-4 bg-slate-50/50 border-b border-slate-100 px-6 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm">أحدث المعاملات</h3>
                  <button onClick={() => setActiveTab('invoices')} className="text-xs font-bold text-[var(--color-primary)]">عرض الكل</button>
                </div>
                <div className="divide-y divide-slate-50">
                  {invoices.slice(0, 5).map((inv) => (
                    <div key={inv.id} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{inv.productName}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{format(inv.updatedAt?.toDate() || new Date(), 'dd MMMM yyyy (hh:mm a)', { locale: ar })}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-[var(--color-primary)] text-sm">{inv.price?.toLocaleString('ar-EG')} ج.م</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">#{inv.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">
              {invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                  <FileText className="w-16 h-16 opacity-10 mb-4" />
                  <p className="font-bold text-sm">لا توجد فواتير مكتملة حتى الآن</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {invoices.map((inv) => (
                    <div 
                      key={inv.id} 
                      className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-[var(--color-primary)]/30 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-[var(--color-primary)]/5 group-hover:text-[var(--color-primary)] transition-colors shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{inv.productName}</span>
                            <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold">مكتمل</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase overflow-hidden">
                            <span>#{inv.id.slice(0, 8).toUpperCase()}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(inv.updatedAt?.toDate() || new Date(), 'dd MMM yyyy', { locale: ar })}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-slate-50">
                        <div className="text-right md:text-left">
                          <p className="text-base font-bold text-[var(--color-primary)]">{inv.price?.toLocaleString('ar-EG')} ج.م</p>
                          <p className="text-[10px] text-slate-400 font-bold">الكمية: {inv.quantity} {inv.unit}</p>
                        </div>
                        <button 
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-md"
                        >
                          <Printer className="w-3.5 h-3.5" /> عرض الفاتورة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] shrink-0">
          <p className="text-slate-400 font-bold">نظام الفواتير الموحد • بنهة {new Date().getFullYear()}</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-slate-500 font-bold uppercase tracking-widest">Live Sync Enabled</span>
          </div>
        </div>

        {/* Detailed Invoice Modal (Internal) */}
        <AnimatePresence>
          {selectedInvoice && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedInvoice(null)}
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                className="bg-white w-full max-w-xl rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
                dir="rtl"
              >
                <div className="flex-1 overflow-y-auto">
                  <div className="p-10 flex-col gap-8 invoice-container" id="printable-invoice" ref={invoiceRef} style={{ backgroundColor: '#ffffff' }}>
                    {/* Invoice Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8 gap-4" style={{ borderBottomColor: '#000000' }}>
                     <div className="text-right">
                       <Logo size="lg" />
                     </div>
                     <div className="text-left font-display flex flex-col items-end">
                       <h1 className="text-3xl font-black opacity-10 leading-none mb-2" style={{ color: '#000000', opacity: 0.1 }}>INVOICE</h1>
                       <div className="bg-black text-white px-3 py-1 text-xs font-bold rounded mb-2" style={{ backgroundColor: '#000000', color: '#ffffff' }}>نسخة أصلية</div>
                       <p className="text-[10px] text-slate-500 font-bold" style={{ color: '#64748b' }}>#{selectedInvoice.id.slice(0, 10).toUpperCase()}</p>
                       <p className="text-[10px] text-slate-500 font-bold" style={{ color: '#64748b' }}>{format(selectedInvoice.updatedAt?.toDate() || new Date(), 'dd MMMM yyyy', { locale: ar })}</p>
                     </div>
                  </div>

                  {/* Billing Details */}
                  <div className="grid grid-cols-2 gap-10 mb-8 pb-8 border-b border-slate-100" style={{ borderBottomColor: '#f1f5f9' }}>
                    <div>
                      <h4 className="text-[10px] text-slate-400 font-bold uppercase mb-2" style={{ color: '#94a3b8' }}>جهة التوريد</h4>
                      <p className="text-sm font-bold text-slate-900 mb-1" style={{ color: '#0f172a' }}>{selectedInvoice.supplierName}</p>
                      <p className="text-[10px] text-slate-500 mb-0.5" style={{ color: '#64748b' }}>رقم المورد: #{selectedInvoice.supplierId?.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] text-slate-400 font-bold uppercase mb-2 tracking-widest" style={{ color: '#94a3b8' }}>جهة الاستلام (العميل)</h4>
                      <p className="text-sm font-bold text-slate-900 mb-1" style={{ color: '#0f172a' }}>{selectedInvoice.buyerName}</p>
                      <p className="text-[10px] text-slate-500 mb-0.5" style={{ color: '#64748b' }}>{selectedInvoice.deliveryAddress}</p>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="mb-8">
                    <table className="w-full text-right">
                      <thead className="border-b border-slate-900" style={{ borderBottomColor: '#000000' }}>
                        <tr>
                          <th className="py-2 text-[10px] text-slate-400 font-bold uppercase" style={{ color: '#94a3b8' }}>الوصف</th>
                          <th className="py-2 text-[10px] text-slate-400 font-bold uppercase" style={{ color: '#94a3b8' }}>الكمية</th>
                          <th className="py-2 text-[10px] text-slate-400 font-bold uppercase" style={{ color: '#94a3b8' }}>سعر الوحدة</th>
                          <th className="py-2 text-[10px] text-slate-400 font-bold uppercase text-left" style={{ color: '#94a3b8' }}>الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50" style={{ borderBottomColor: '#f8fafc' }}>
                        {(selectedInvoice.requestType === 'bulk' && selectedInvoice.items ? selectedInvoice.items : [{
                          productName: selectedInvoice.productName,
                          quantity: selectedInvoice.quantity,
                          unit: selectedInvoice.unit,
                          price: selectedInvoice.price
                        }]).map((item: any, index: number) => {
                          const itemPrice = selectedInvoice.requestType === 'bulk' && selectedInvoice.itemsPrices 
                                            ? Number(selectedInvoice.itemsPrices[index] || 0) 
                                            : Number(item.price || 0);
                          const quantity = Number(item.quantity) || 1;
                          const originalItemPrice = selectedInvoice.requestType === 'bulk' ? itemPrice : itemPrice;
                          const pricePerUnit = originalItemPrice / quantity;
                          
                          return (
                            <tr key={index}>
                              <td className="py-4">
                                <p className="text-sm font-bold text-slate-900" style={{ color: '#0f172a' }}>{item.productName}</p>
                                <p className="text-[10px] text-slate-400" style={{ color: '#94a3b8' }}>{selectedInvoice.requestType === 'bulk' ? 'صنف ضمن مناقصة جملة' : 'توريد منتجات عالية الجودة'}</p>
                              </td>
                              <td className="py-4 text-sm font-bold text-slate-600" style={{ color: '#475569' }}>{item.quantity} {item.unit || selectedInvoice.unit}</td>
                              <td className="py-4 text-sm font-bold text-slate-600" style={{ color: '#475569' }}>{pricePerUnit.toFixed(2)}</td>
                              <td className="py-4 text-sm font-bold text-slate-900 text-left" style={{ color: '#0f172a' }}>{originalItemPrice.toLocaleString('ar-EG')} ج.م</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div className="md:w-1/2 mr-auto space-y-2 pt-4 border-t-2 border-slate-900" style={{ borderTopColor: '#000000' }}>
                    <div className="flex justify-between text-xs text-slate-500" style={{ color: '#64748b' }}>
                      <span>الإجمالي الفرعي</span>
                      <span className="font-bold">{selectedInvoice.price?.toLocaleString('ar-EG')} ج.م</span>
                    </div>
                     <div className="flex justify-between text-xs text-slate-500" style={{ color: '#64748b' }}>
                      <span>الضريبة (0%)</span>
                      <span className="font-bold">0.00 ج.م</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-100" style={{ borderTopColor: '#f1f5f9' }}>
                      <span className="text-sm font-black" style={{ color: '#000000' }}>الإجمالي الكلي</span>
                      <span className="text-lg font-black text-primary-fallback" style={{ color: '#0f172a' }}>{selectedInvoice.price?.toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  </div>

                  {/* Footer Notes */}
                  <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between italic text-[10px] text-slate-400" style={{ borderTopColor: '#f1f5f9' }}>
                    <p style={{ color: '#94a3b8' }}>تم إنشاء هذه الفاتورة آلياً ولا تتطلب توقيع.</p>
                    <p style={{ color: '#94a3b8' }}>شكراً لتعاملكم معنا!</p>
                  </div>
                </div>
                </div>

                <div className="p-4 bg-slate-900 flex flex-col sm:flex-row gap-3">
                   <button 
                    onClick={handleSaveAsImage}
                    disabled={isSaving}
                    className="flex-1 bg-white text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                   >
                     <ImageIcon className="w-4 h-4" /> حفظ كصورة
                   </button>
                   <button 
                    onClick={handleSaveAsPDF}
                    disabled={isSaving}
                    className="flex-1 bg-[var(--color-primary)] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 border border-white/20"
                   >
                     <Printer className="w-4 h-4" /> طباعة / حفظ PDF
                   </button>
                   <button 
                    onClick={() => setSelectedInvoice(null)}
                    className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
                   >
                     إغلاق
                   </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Basic styles for print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible;
          }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
