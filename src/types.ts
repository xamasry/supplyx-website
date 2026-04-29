export type UserRole = 'buyer' | 'supplier' | 'admin';

export interface User {
  id: string;
  phone: string;
  name: string;
  userType: UserRole;
  businessName: string;
  businessAddress: string;
  locationLat?: number;
  locationLng?: number;
  governorate?: string;
  city?: string;
  profileImageUrl?: string;
  isVerified: boolean;
  rating: number;
  totalOrders: number;
  description?: string;
  specialties?: string[];
  disabled?: boolean;
  wishlist?: string[];
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

export interface SupplierOffer {
  id: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  titleAr: string;
  offerPrice: number;
  originalPrice: number;
  discountPercentage: number;
  validUntil: string;
}
