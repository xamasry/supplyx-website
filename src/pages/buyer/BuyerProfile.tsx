import { Link, useNavigate } from 'react-router-dom';
import { User, Store, MapPin, Bell, CreditCard, FileText, HelpCircle, LogOut } from 'lucide-react';

export default function BuyerProfile() {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/auth/login');
  };

  return (
    <div className="space-y-6 md:pb-0 px-2 sm:px-0 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-bold font-display text-slate-900">الملف الشخصي</h1>
      </header>

      {/* User Info Card */}
      <div className="bg-[var(--color-primary)] text-white rounded-3xl p-6 shadow-lg flex items-center gap-4 relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 text-white/5 text-8xl rotate-12">
          <Store />
        </div>
        <div className="w-16 h-16 rounded-full border-2 border-white/20 bg-white/10 flex items-center justify-center overflow-hidden shrink-0 z-10">
          <img src="https://ui-avatars.com/api/?name=مطعم+الامل&background=transparent&color=fff" alt="Logo" className="w-full h-full object-cover" />
        </div>
        <div className="z-10">
          <h2 className="font-bold text-2xl font-display">مطعم الأمل</h2>
          <p className="text-white/80 text-sm mt-1 mb-2">أحمد محمود (المدير)</p>
          <div className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded text-xs font-bold font-mono">
            ID: #BNH-7729
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
              <p className="font-bold text-slate-800" dir="ltr">+20 100 123 4567</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold mb-1">العنوان</p>
              <p className="font-bold text-slate-800 flex items-start gap-1">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" /> شارع فريد ندا، بنها، القليوبية
              </p>
            </div>
            <button className="text-sm font-bold text-[var(--color-primary)] hover:underline border-t border-slate-100 mt-2 pt-4 w-full text-right">
              تعديل تفاصيل الملف الشخصي
            </button>
          </div>
        </div>

        {/* Settings list */}
        <div className="bg-white rounded-3xl p-2 border border-slate-200 shadow-sm">
          <div className="flex flex-col">
            <button className="flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-right relative border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">طرق الدفع</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">إدارة الكروت المحفوظة وحساب فوري</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-right relative border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">الإشعارات</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">التحكم في تنبيهات التطبيق</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-right relative border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">الفواتير والتقارير</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">تحميل فواتير المشتريات (PDF)</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-right relative">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">الدعم الفني</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">تواصل معنا لحل أي مشكلة</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <button onClick={handleLogout} className="w-full bg-white border border-red-200 text-red-600 rounded-3xl p-4 font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors shadow-sm">
        <LogOut className="w-5 h-5" /> تسجيل الخروج
      </button>
    </div>
  );
}
