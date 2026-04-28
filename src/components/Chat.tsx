import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, User } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { cn } from '../lib/utils';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: any;
}

interface ChatProps {
  requestId: string;
  receiverId: string;
  receiverName: string;
  collectionName?: string;
}

export default function Chat({ requestId, receiverId, receiverName, collectionName = 'requests' }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isComponentMounted = useRef(true);

  useEffect(() => {
    isComponentMounted.current = true;
    return () => { isComponentMounted.current = false; };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(err => console.error('Notification permission error:', err));
      }
    }
  }, []);

  useEffect(() => {
    if (!requestId) return;

    const messagesRef = collection(db, collectionName, requestId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      setMessages(msgs);
      setLoading(false);
      
      // Auto scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `${collectionName}/${requestId}/messages`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [requestId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, collectionName, requestId, 'messages'), {
        text,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'مستخدم',
        createdAt: serverTimestamp(),
        participants: [auth.currentUser.uid, receiverId]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${collectionName}/${requestId}/messages`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full sm:h-[500px] bg-white sm:rounded-3xl border-0 sm:border border-slate-200 shadow-none sm:shadow-sm overflow-hidden font-sans min-h-0">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
          <User className="w-4 h-4" />
        </div>
        <h3 className="font-bold text-sm text-slate-900">{receiverName}</h3>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50"
      >
        {messages.map((msg) => {
          const isMe = msg.senderId === auth.currentUser?.uid;
          return (
            <div 
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[80%] animate-in fade-in slide-in-from-bottom-2",
                isMe ? "mr-auto items-start" : "ml-auto items-end"
              )}
            >
              <div className={cn(
                "px-4 py-2 rounded-2xl text-sm font-medium shadow-sm",
                isMe 
                  ? "bg-[var(--color-primary)] text-white rounded-tl-none" 
                  : "bg-white border border-slate-200 text-slate-800 rounded-tr-none"
              )}>
                {msg.text}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1 font-bold">
                {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'جاري الإرسال...'}
              </span>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
            <p className="text-xs font-bold">ابدأ المحادثة الآن لتنسيق الطلب</p>
          </div>
        )}
      </div>

      <form 
        onSubmit={handleSendMessage}
        className="p-4 border-t border-slate-100 bg-white flex gap-2 shrink-0"
      >
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="اكتب رسالتك هنا..."
          className="flex-1 bg-slate-100 border-none rounded-2xl px-4 py-2 text-base outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all font-bold"
        />
        <button 
          type="submit"
          className="w-10 h-10 bg-[var(--color-primary)] text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <Send className="w-5 h-5 rotate-180" />
        </button>
      </form>
    </div>
  );
}
