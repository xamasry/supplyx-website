import { db } from '../../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { sendNewRequestNotification } from '../whatsapp/templates';
import admin from 'firebase-admin';

// Initialize admin if not already
if (!admin.apps.length) {
  admin.initializeApp();
}

interface Request {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  categoryName: string;
  buyerName: string;
  coordinates?: { lat: number; lng: number };
  notes?: string;
  maxPrice?: number;
  categoryId: string;
}

// حساب المسافة بين نقطتين (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function notifyNearbySuppliers(request: Request): Promise<void> {
  try {
    // جلب كل الموردين النشطين
    const suppliersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'supplier'),
      where('isAvailable', '==', true)
    );
    
    const suppliersSnap = await getDocs(suppliersQuery);
    if (suppliersSnap.empty) {
      console.log('No available suppliers found');
      return;
    }
    
    const suppliers = suppliersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    
    let notifiedCount = 0;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    for (const supplier of suppliers) {
      // 1. التحقق من أوقات العمل
      if (supplier.availableHoursStart && supplier.availableHoursEnd) {
        const [startH, startM] = supplier.availableHoursStart.split(':').map(Number);
        const [endH, endM] = supplier.availableHoursEnd.split(':').map(Number);
        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;
        if (currentTime < startTime || currentTime > endTime) continue;
      }

      // 2. التحقق من التخصص
      if (supplier.specialties?.length > 0 && request.categoryName) {
        const hasSpecialty = supplier.specialties.some(
          (s: string) => s === request.categoryName || s === 'الكل'
        );
        if (!hasSpecialty) continue;
      }

      // 3. حساب المسافة
      let distanceKm = 5; // افتراضي لو مفيش إحداثيات
      if (request.coordinates && supplier.locationLat && supplier.locationLng) {
        distanceKm = calculateDistance(
          request.coordinates.lat,
          request.coordinates.lng,
          supplier.locationLat,
          supplier.locationLng
        );
        
        // التحقق من نطاق التوصيل
        const radius = supplier.deliveryRadiusKm || 10;
        if (distanceKm > radius) continue;
      }

      // 4. إرسال إشعار دفع (Push Notification)
      if (supplier.fcmTokens && supplier.fcmTokens.length > 0) {
        const message = {
          notification: {
            title: `طلب جديد: ${request.productName}`,
            body: `الكمية: ${request.quantity} ${request.unit} - من: ${request.buyerName}`,
          },
          data: {
            requestId: request.id,
            type: 'new_request',
            click_action: 'FLUTTER_NOTIFICATION_CLICK', // Legacy but common
            link: `/supplier/request/${request.id}`
          },
          tokens: supplier.fcmTokens,
        };

        try {
          const response = await admin.messaging().sendEachForMulticast(message);
          console.log(`Successfully sent FCM messages: ${response.successCount}`);
          
          // Clean up failed tokens if needed
          if (response.failureCount > 0) {
            console.log(`Failed FCM tokens: ${response.failureCount}`);
          }
        } catch (error) {
          console.error('Error sending FCM:', error);
        }
      }

      // 5. إرسال إشعار واتساب
      if (supplier.whatsappOptIn && supplier.whatsappPhone) {
        const expiresInMinutes = 120; // ساعتين
        await sendNewRequestNotification(supplier.whatsappPhone, {
          id: request.id,
          productName: request.productName,
          quantity: String(request.quantity),
          unit: request.unit,
          categoryName: request.categoryName,
          buyerName: request.buyerName,
          distanceKm,
          notes: request.notes,
          maxPrice: request.maxPrice,
          expiresInMinutes
        });
      }
      
      notifiedCount++;
      
      // Delay لتجنب الضغط على السيرفرات
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`📱 Notified ${notifiedCount} suppliers for request ${request.id}`);
    
  } catch (err) {
    console.error('Error notifying suppliers:', err);
  }
}
