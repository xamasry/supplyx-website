import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ImageUploadProps {
  value?: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
  className?: string;
  label?: string;
}

export default function ImageUpload({ value, onChange, onRemove, className, label }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2MB for Base64 storage in Firestore)
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 2 ميجابايت.');
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        onChange(base64String);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-xs font-bold text-slate-500 block mb-1">{label}</label>}
      
      <div className="relative group/upload">
        {value ? (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200">
            <img src={value} alt="Uploaded" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/upload:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-colors"
              >
                <Upload size={18} />
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="p-2 bg-rose-500 rounded-full text-white hover:bg-rose-600 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-video border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-[var(--color-primary)] hover:bg-slate-50 transition-all text-slate-400 group/btn"
          >
            {isUploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            ) : (
              <>
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center group-hover/btn:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700">اضغط لرفع الصورة</p>
                  <p className="text-[10px]">يدعم JPG, PNG (حد أقصى 2MB)</p>
                </div>
              </>
            )}
          </button>
        )}
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
      </div>
    </div>
  );
}
