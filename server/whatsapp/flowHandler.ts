import { getSession, saveSession, clearSession, updateSessionStep } from './sessionManager';
import {
  sendAskPrice, sendAskDeliveryTime, sendAskNotes,
  sendBidConfirmation, sendBidSubmitted, sendBidRejected
} from './templates';
import { sendTextMessage } from './sender';
import { db } from '../../src/lib/firebase';
import { collection, addDoc, doc, getDoc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';

// ===== المعالج الرئيسي لكل رسالة واردة =====
export async function handleIncomingMessage(
  phone: string,
  messageType: 'text' | 'button' | 'interactive',
  content: string, // النص أو الـ button ID
  messageId: string
): Promise<void> {
  
  console.log(`📥 Message from ${phone}: [${messageType}] "${content}"`);
  
  // جلب الجلسة الحالية
  const session = await getSession(phone);
  
  // ===== CASE 1: رد على زر "نعم، أقدم عرض" =====
  if (content.startsWith('BID_YES_')) {
    const requestId = content.replace('BID_YES_', '');
    
    // جلب تفاصيل الطلب
    const requestDoc = await getDoc(doc(db, 'requests', requestId));
    if (!requestDoc.exists()) {
      await sendTextMessage(phone, '⚠️ هذا الطلب لم يعد متاحاً.');
      return;
    }
    
    const request = requestDoc.data();
    
    // التحقق إن الطلب لسه active
    if (request.status !== 'active') {
      await sendTextMessage(phone, '⚠️ انتهت مدة هذا الطلب أو تم اختيار مورد آخر.');
      return;
    }
    
    // حفظ الجلسة
    await saveSession(phone, {
      currentAction: 'awaiting_price',
      requestId,
      step: 1,
      tempData: {
        productName: request.productName,
        buyerName: request.buyerName
      }
    });
    
    // اسأل عن السعر
    await sendAskPrice(phone, request.productName);
    return;
  }
  
  // ===== CASE 2: رفض الطلب =====
  if (content.startsWith('BID_NO_')) {
    await sendTextMessage(phone, '👍 تم. سنرسل لك طلبات أخرى عندما تتوفر.');
    return;
  }
  
  // ===== CASE 3: اختيار وقت التوصيل =====
  if (content.startsWith('TIME_')) {
    const timeMap: Record<string, number> = {
      'TIME_15': 15,
      'TIME_30': 30,
      'TIME_60': 60
    };
    const deliveryTime = timeMap[content];
    if (deliveryTime && session) {
      await updateSessionStep(phone, 'awaiting_notes', {
        ...session.tempData,
        deliveryTime
      });
      await sendAskNotes(phone);
    }
    return;
  }
  
  // ===== CASE 4: إضافة ملاحظة أو تخطي =====
  if (content === 'NOTES_SKIP' && session) {
    // اعرض ملخص العرض للتأكيد
    await updateSessionStep(phone, 'awaiting_final_confirm', session.tempData);
    await sendBidConfirmation(phone, {
      productName: session.tempData.productName!,
      price: session.tempData.price!,
      deliveryTime: session.tempData.deliveryTime!,
    });
    return;
  }
  
  if (content === 'NOTES_ADD' && session) {
    await updateSessionStep(phone, 'awaiting_notes', session.tempData);
    await sendTextMessage(phone, '✏️ اكتب ملاحظتك:');
    return;
  }
  
  // ===== CASE 5: تأكيد الإرسال النهائي =====
  if (content === 'CONFIRM_BID' && session?.requestId) {
    await submitBid(phone, session);
    return;
  }
  
  // ===== CASE 6: إلغاء العرض =====
  if (content === 'CANCEL_BID') {
    await clearSession(phone);
    await sendTextMessage(phone, '❌ تم إلغاء العرض.\nيمكنك تقديم عرض جديد عند استقبال الطلب مرة أخرى.');
    return;
  }
  
  // ===== CASE 7: تأكيد التسليم =====
  if (content === 'DELIVERED_YES') {
    // TODO: تحديث حالة الطلب لـ delivered
    await sendTextMessage(phone, '✅ ممتاز! تم تسجيل التسليم.\nسيتم إشعار العميل للتأكيد وتحرير مبلغك.');
    return;
  }
  
  // ===== CASE 8: رسائل نصية حسب الجلسة الحالية =====
  if (session?.currentAction === 'awaiting_price') {
    const price = parseFloat(content.replace(/[^\d.]/g, ''));
    if (isNaN(price) || price <= 0) {
      await sendTextMessage(phone, '⚠️ يرجى إدخال رقم صحيح.\nمثال: اكتب *150*');
      return;
    }
    
    await updateSessionStep(phone, 'awaiting_delivery_time', {
      ...session.tempData,
      price
    });
    await sendAskDeliveryTime(phone);
    return;
  }
  
  if (session?.currentAction === 'awaiting_notes') {
    // المستخدم كتب الملاحظة
    await updateSessionStep(phone, 'awaiting_final_confirm', {
      ...session.tempData,
      notes: content
    });
    await sendBidConfirmation(phone, {
      productName: session.tempData.productName!,
      price: session.tempData.price!,
      deliveryTime: session.tempData.deliveryTime!,
      notes: content
    });
    return;
  }
  
  // ===== CASE 9: رسالة غير معروفة =====
  await sendTextMessage(
    phone,
    '👋 مرحباً بك في *SupplyX*!\n\nستصلك إشعارات الطلبات الجديدة تلقائياً.\n\nللمساعدة تواصل معنا على رقم الدعم.'
  );
}

// ===== إرسال العرض لـ Firestore =====
async function submitBid(phone: string, session: any): Promise<void> {
  try {
    // جلب بيانات المورد
    const suppliersQuery = query(
      collection(db, 'users'),
      where('whatsappPhone', '==', phone)
    );
    const suppliersSnap = await getDocs(suppliersQuery);
    if (suppliersSnap.empty) {
      await sendTextMessage(phone, '⚠️ لم يتم العثور على حسابك. تواصل مع الدعم.');
      return;
    }
    
    const supplierDoc = suppliersSnap.docs[0];
    const supplier = supplierDoc.data();
    
    // التحقق إن الطلب لسه active
    const requestDoc = await getDoc(doc(db, 'requests', session.requestId));
    if (!requestDoc.exists() || requestDoc.data()?.status !== 'active') {
      await sendTextMessage(phone, '⚠️ انتهت مدة هذا الطلب.');
      await clearSession(phone);
      return;
    }
    
    // إضافة العرض
    const bidRef = collection(db, `requests/${session.requestId}/bids`);
    await addDoc(bidRef, {
      supplierId: supplierDoc.id,
      supplierName: supplier.businessName,
      supplierPhone: phone,
      supplierRating: supplier.rating || 0,
      price: session.tempData.price,
      deliveryTimeMinutes: session.tempData.deliveryTime,
      notes: session.tempData.notes || '',
      status: 'pending',
      source: 'whatsapp', // مهم — عشان تعرف جه من واتساب
      createdAt: serverTimestamp()
    });
    
    // حساب ترتيب العرض
    const allBids = await getDocs(
      query(bidRef, orderBy('price', 'asc'))
    );
    const rank = allBids.docs.findIndex(d => d.data().supplierId === supplierDoc.id) + 1;
    
    await clearSession(phone);
    await sendBidSubmitted(phone, rank);
    
    console.log(`✅ Bid submitted via WhatsApp from ${phone} for request ${session.requestId}`);
    
  } catch (error) {
    console.error('Error submitting bid:', error);
    await sendTextMessage(phone, '⚠️ حدث خطأ أثناء إرسال العرض. حاول مرة أخرى.');
  }
}
