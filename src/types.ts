export type UserRole = 'buyer' | 'supplier' | 'admin';

export interface User {
  id: string;
  phone: string;
  name: string;
  userType: UserRole;
  role?: UserRole; 
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
  subscriptionTier?: 'standard' | 'premium';
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

// Enterprise Unit System
export interface Unit {
  id: string;
  name: string; // e.g., "Kilogram", "Carton"
  abbreviation: string; // e.g., "kg", "ctn"
  isStandard: boolean; // if true, it's a base unit for its type (e.g., kg for Mass)
  type: 'mass' | 'volume' | 'count' | 'other';
}

export interface UnitConversion {
  id: string;
  fromUnitId: string;
  toUnitId: string;
  multiplier: number; // e.g., from "Carton" to "Pack" multiplier could be 24
}

export interface PackagingLevel {
  id: string;
  unitId: string;
  name: string; // e.g., "24 Pack Carton"
  quantityInBaseUnit: number; // e.g., 24
  price: number; // Price for this specific packaging level
  stock?: number;
}

export interface SupplierStoreProduct {
  id: string;
  supplierId: string;
  supplierName: string;
  name: string;
  description: string;
  basePrice: number; // Price per base unit
  baseUnitId: string; // ID of the base unit (e.g., "Piece")
  category: string;
  image?: string;
  available: boolean;
  moq: number; // Minimum Order Quantity in base units
  packagingLevels: PackagingLevel[];
  stock: number; // Total stock in base units
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface CartItem {
  id: string; // unique for cart item
  productId: string;
  supplierId: string;
  productName: string;
  image?: string;
  packagingLevelId?: string; // Optional, defaults to base if not specified
  packagingLevelName?: string;
  quantity: number; // quantity of the selected packaging level or base unit
  price: number;
  unitId: string;
  notes?: string;
}

export interface Cart {
  id: string; // userId
  items: CartItem[];
  updatedAt: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'rejected' | 'partially_fulfilled';

export interface OrderItem {
  productId: string;
  productName: string;
  unitId: string;
  unitName: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  notes?: string;
}

export interface SupplierOrder {
  id: string;
  parentOrderId: string;
  supplierId: string;
  supplierName: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  shippingAddress: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  deliveryDate?: string;
  type?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  totalAmount: number;
  status: OrderStatus;
  shippingAddress: string;
  contactPhone: string;
  createdAt: string;
  updatedAt: string;
  supplierOrders: string[]; // IDs of child orders
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'bid_accepted' | 'new_bid' | 'system' | 'order_update' | 'inventory_alert';
  read: boolean;
  createdAt: string;
  link?: string;
}
