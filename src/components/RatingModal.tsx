import React, { useState } from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc, increment, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

export default function RatingModal({ isOpen, onClose, order }: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('يرجى اختيار التقييم');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Add review to reviews collection
      await addDoc(collection(db, 'reviews'), {
        orderId: order.id,
        buyerId: order.buyerId,
        buyerName: order.buyerName,
        supplierId: order.supplierId,
        supplierName: order.supplierName,
        rating,
        comment,
        createdAt: serverTimestamp()
      });

      // 2. Update supplier stats
      const supplierRef = doc(db, 'users', order.supplierId);
      const supplierSnap = await getDoc(supplierRef);
      
      if (supplierSnap.exists()) {
        const data = supplierSnap.data();
        const currentRating = data.rating || 0;
        const totalRatings = data.totalRatings || 0;
        
        const newTotalRatings = totalRatings + 1;
        const newRating = ((currentRating * totalRatings) + rating) / newTotalRatings;

        await updateDoc(supplierRef, {
          rating: newRating,
          totalRatings: newTotalRatings,
          updatedAt: serverTimestamp()
        });
      }

      // 3. Mark order as rated
      await updateDoc(doc(db, 'requests', order.id), {
        isRated: true
      });

      toast.success('شكراً لتقييمك!');
      onClose();
    } catch (err) {
      console.error('Error submitting rating:', err);
      toast.error('فشل تقديم التقييم');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-xl text-slate-900">تقييم المورد</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center mb-6">
          <p className="text-sm text-slate-500 mb-4">كيف كانت تجربتك مع <span className="font-bold text-slate-900">{order.supplierName}</span>؟</p>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="transition-transform active:scale-90"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
              >
                <Star 
                  className={`w-10 h-10 ${
                    (hover || rating) >= star 
                      ? 'fill-amber-400 text-amber-400' 
                      : 'text-slate-200 fill-slate-200'
                  }`} 
                />
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="اكتب رأيك هنا (اختياري)..."
            className="w-full border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
            rows={3}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-[var(--color-primary)] text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال التقييم'}
          </button>
        </form>
      </div>
    </div>
  );
}
