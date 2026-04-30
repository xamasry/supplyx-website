export type UserRole = 'buyer' | 'supplier' | 'admin';

export interface User {
  id: string;
  phone: string;
  name: string;
  userType: UserRole;
  role?: UserRole; // Support both for compatibility
  businessName: string;
  businessAddress: string;
  locationLat?: number;
  locationLng?: number;
  governorate?: string;
  city?: string;
  profileImageUrl?: string;
  isVerified: boolean;
  isApproved?: boolean;
  isTrial?: boolean;
  subscriptionStatus?: 'active' | 'expired' | 'not_subscribed';
  subscriptionStart?: string;
  subscriptionExpiry?: string;
  totalOrders: number;
  rating: number;
  description?: string;
  specialties?: string[];
  disabled?: boolean;
  wishlist?: string[];
}

export interface AppSettings {
  commissionRate: number;
  buyerSubPrice: number;
  supplierSubPrice: number;
  updatedAt: string;
}

export interface SubscriptionPayment {
  id: string;
  userId: string;
  userRole: UserRole;
  userName: string;
  businessName: string;
  amount: number;
  durationMonths: number;
  paymentDate: string;
  expiryDate: string;
}

export interface Category {
  id: string;
  nameAr: string;
  icon: string;
}

export interface Product {
  id: string;
  categoryId: string;
  nameAr: string;
  unit: string;
}

export type RequestStatus = 'open' | 'bidding' | 'accepted' | 'in_delivery' | 'completed' | 'cancelled';

export interface Request {
  id: string;
  buyerId: string;
  buyerName: string;
  categoryId: string;
  categoryNameAr?: string;
  productName: string;
  quantity: number;
  unit: string;
  description?: string;
  locationLat?: number;
  locationLng?: number;
  deliveryAddress: string;
  status: RequestStatus;
  expiresAt: string;
  createdAt: string;
  bidsCount: number;
}

export interface Bid {
  id: string;
  requestId: string;
  supplierId: string;
  supplierName: string;
  supplierRating: number;
  price: number;
  deliveryTimeMinutes: number;
  distanceKm?: number;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
}

export interface SupplierStoreProduct {
  id: string;
  supplierId: string;
  supplierName: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  image?: string;
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'bid_accepted' | 'new_bid' | 'system' | 'product_order';
  read: boolean;
  createdAt: string;
  link?: string;
}
