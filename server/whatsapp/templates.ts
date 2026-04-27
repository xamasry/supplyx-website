import { sendTextMessage, sendButtonMessage } from './sender';

// ===== إشعار طلب جديد للمورد =====
export async function sendNewRequestNotification(
  supplierPhone: string,
  request: {
    id: string;
    productName: string;
    quantity: string;
    unit: string;
    categoryName: string;
    buyerName: string;
    distanceKm: number;
    notes?: string;
    maxPrice?: number;
    expiresInMinutes: number;
  }
) {
  const notesLine = request.notes ? `\n📝 ملاحظات: ${request.notes}` : '';
  const maxPriceLine = request.maxPrice ? `\n💰 أقصى سعر: ${request.maxPrice} ج.م` : '';
  
  const messageText = 
`🔔 *طلب جديد — SupplyX*

📦 المنتج: *${request.productName}*
🔢 الكمية: ${request.quantity} ${request.unit}
📂 الفئة: ${request.categoryName}
🏪 العميل: ${request.buyerName}
📍 المسافة: ${request.distanceKm.toFixed(1)} كم${maxPriceLine}${notesLine}

⏰ الطلب مفتوح لمدة: ${request.expiresInMinutes} دقيقة

هل تريد تقديم عرض؟`;

  return await sendButtonMessage(
    supplierPhone,
    messageText,
    [
      { id: `BID_YES_${request.id}`, title: '✅ نعم، أقدم عرض' },
      { id: `BID_NO_${request.id}`, title: '❌ لا، تجاوز' }
    ],
    '🛒 طلب جديد قريب منك'
  );
}

// ===== طلب إدخال السعر =====
export async function sendAskPrice(phone: string, productName: string) {
  return await sendTextMessage(
    phone,
    `💰 *أدخل السعر الإجمالي بالجنيه المصري*\n\nللمنتج: ${productName}\n\nمثال: اكتب فقط الرقم\n👇 *150*`
  );
}

// ===== طلب إدخال وقت التوصيل =====
export async function sendAskDeliveryTime(phone: string) {
  return await sendButtonMessage(
    phone,
    '🚚 *كم دقيقة تحتاج للتوصيل؟*',
    [
      { id: 'TIME_15', title: '⚡ 15 دقيقة' },
      { id: 'TIME_30', title: '🕐 30 دقيقة' },
      { id: 'TIME_60', title: '🕑 ساعة' },
    ]
  );
}

// ===== طلب ملاحظة إضافية =====
export async function sendAskNotes(phone: string) {
  return await sendButtonMessage(
    phone,
    '📝 هل تريد إضافة ملاحظة للعرض؟',
    [
      { id: 'NOTES_SKIP', title: '⏭️ تخطي' },
      { id: 'NOTES_ADD', title: '✏️ إضافة ملاحظة' },
    ]
  );
}

// ===== تأكيد العرض =====
export async function sendBidConfirmation(
  phone: string,
  bid: { productName: string; price: number; deliveryTime: number; notes?: string }
) {
  const notesLine = bid.notes ? `\n📝 ملاحظة: ${bid.notes}` : '';
  
  return await sendButtonMessage(
    phone,
    `✅ *تأكيد عرضك*

📦 المنتج: ${bid.productName}
💰 السعر: ${bid.price} ج.م
🚚 التوصيل: ${bid.deliveryTime} دقيقة${notesLine}

هل تريد إرسال العرض؟`,
    [
      { id: 'CONFIRM_BID', title: '✅ تأكيد الإرسال' },
      { id: 'CANCEL_BID', title: '❌ إلغاء' },
    ]
  );
}

// ===== تم إرسال العرض =====
export async function sendBidSubmitted(phone: string, rank: number) {
  const rankText = rank === 1 ? '🥇 أنت الأفضل سعراً دلوقتي!' :
                   rank === 2 ? '🥈 أنت في المركز الثاني' :
                   `📊 أنت في المركز ${rank}`;
  
  return await sendTextMessage(
    phone,
    `🎉 *تم إرسال عرضك بنجاح!*\n\n${rankText}\n\n⏳ انتظر رد العميل...\nهتتلقى إشعار فوري لو اتقبل عرضك.`
  );
}

// ===== تم قبول العرض =====
export async function sendBidAccepted(
  phone: string,
  order: { productName: string; price: number; deliveryAddress: string; buyerPhone?: string }
) {
  const phoneText = order.buyerPhone 
    ? `\n📞 تواصل مع العميل: ${order.buyerPhone}` 
    : '';
  
  return await sendTextMessage(
    phone,
    `🎊 *تهانينا! تم قبول عرضك!*\n\n📦 المنتج: ${order.productName}\n💰 المبلغ: ${order.price} ج.م\n📍 عنوان التسليم: ${order.deliveryAddress}${phoneText}\n\n🚀 ابدأ التجهيز فوراً!\n\nبعد التسليم اضغط: *تم التسليم*`
  );
}

// ===== تم رفض العرض =====
export async function sendBidRejected(phone: string, productName: string) {
  return await sendTextMessage(
    phone,
    `ℹ️ للأسف تم اختيار مورد آخر لطلب "${productName}".\n\nلا تقلق، هيجيلك طلبات تانية قريباً! 💪`
  );
}

// ===== إشعار انتهاء الطلب بدون قبول =====
export async function sendRequestExpired(phone: string, productName: string) {
  return await sendTextMessage(
    phone,
    `⏰ انتهت مدة طلب "${productName}" بدون اختيار.\n\nعرضك كان جيداً، حظ أوفر في الطلبات القادمة!`
  );
}

// ===== تأكيد التوصيل من المورد =====
export async function sendAskDeliveryConfirmation(phone: string, orderDetails: string) {
  return await sendButtonMessage(
    phone,
    `📦 ${orderDetails}\n\nهل تم التسليم؟`,
    [
      { id: 'DELIVERED_YES', title: '✅ نعم، تم التسليم' },
      { id: 'DELIVERED_ISSUE', title: '⚠️ في مشكلة' },
    ]
  );
}
