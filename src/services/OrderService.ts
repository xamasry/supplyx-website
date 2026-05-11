import { collection, doc, writeBatch, serverTimestamp, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, SupplierOrder, CartItem, OrderItem, OrderStatus, SupplierStoreProduct, User, Cart } from '../types';
import { inventoryService } from './InventoryService';

class OrderService {
  private static instance: OrderService;

  private constructor() {}

  public static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService();
    }
    return OrderService.instance;
  }

  /**
   * High-level method to create an order from a cart object.
   */
  public async createOrderFromCart(userId: string, cart: Cart, options: { 
    address: string, 
    phone: string, 
    paymentMethod: string 
  }) {
    const buyerSnap = await getDoc(doc(db, 'users', userId));
    if (!buyerSnap.exists()) throw new Error('User not found');
    const buyer = { id: buyerSnap.id, ...buyerSnap.data() } as User;

    return this.createOrder(buyer, cart.items, options.address, options.phone);
  }

  public async createOrder(buyer: User, items: CartItem[], shippingAddress: string, contactPhone: string) {
    const batch = writeBatch(db);
    const parentOrderId = doc(collection(db, 'orders')).id;
    const parentOrderRef = doc(db, 'orders', parentOrderId);
    
    // Group items by supplier
    const supplierItemsMap = new Map<string, { supplierName: string, items: OrderItem[] }>();
    
    let totalAmount = 0;

    for (const item of items) {
      // Fetch fresh product data for price and stock validation
      const productDoc = await getDoc(doc(db, 'products', item.productId));
      if (!productDoc.exists()) throw new Error(`Product ${item.productId} not found`);
      
      const product = { id: productDoc.id, ...productDoc.data() } as SupplierStoreProduct;
      
      // Calculate base quantity for stock update
      const baseQty = inventoryService.calculateBaseQuantity(product, item.quantity, item.packagingLevelId);
      
      if (product.stock !== undefined && product.stock < baseQty) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      // Determine price
      let unitPrice = product.basePrice;
      let unitName = 'Base Unit';
      
      if (item.packagingLevelId && item.packagingLevelId !== 'base') {
        const level = product.packagingLevels?.find(l => l.id === item.packagingLevelId);
        if (level) {
          unitPrice = level.price;
          unitName = level.name;
        }
      }

      const totalPriceValue = unitPrice * item.quantity;
      totalAmount += totalPriceValue;

      const orderItem: OrderItem = {
        productId: item.productId,
        productName: product.name,
        unitId: item.unitId,
        unitName: unitName,
        quantity: item.quantity,
        pricePerUnit: unitPrice,
        totalPrice: totalPriceValue,
        notes: item.notes
      };

      if (!supplierItemsMap.has(item.supplierId)) {
        supplierItemsMap.set(item.supplierId, { 
          supplierName: product.supplierName, 
          items: [] 
        });
      }
      supplierItemsMap.get(item.supplierId)!.items.push(orderItem);

      // Decrement stock in the batch if tracking is enabled
      if (product.stock !== undefined) {
        batch.update(doc(db, 'products', item.productId), {
          stock: product.stock - baseQty,
          updatedAt: serverTimestamp()
        });
      }
    }

    const supplierOrderIds: string[] = [];

    // Create supplier orders
    for (const [supplierId, data] of supplierItemsMap.entries()) {
      const sOrderId = doc(collection(db, 'supplier_orders')).id;
      const sOrderRef = doc(db, 'supplier_orders', sOrderId);
      
      const subtotal = data.items.reduce((sum, i) => sum + i.totalPrice, 0);
      
      const supplierOrder: Partial<SupplierOrder> = {
        id: sOrderId,
        parentOrderId: parentOrderId,
        supplierId: supplierId,
        supplierName: data.supplierName,
        items: data.items,
        subtotal: subtotal,
        deliveryFee: 0,
        total: subtotal,
        status: 'pending',
        buyerId: buyer.id,
        buyerName: buyer.businessName || buyer.name,
        buyerPhone: contactPhone,
        shippingAddress: shippingAddress,
      };

      batch.set(sOrderRef, {
        ...supplierOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      supplierOrderIds.push(sOrderId);

      // Add Notification for each supplier
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: supplierId,
        title: 'طلب شراء جديد من الكتالوج',
        message: `وصلك طلب شراء جديد من ${buyer.businessName || buyer.name} بقيمة ${subtotal} ج.م`,
        type: 'product_order',
        read: false,
        createdAt: serverTimestamp(),
        link: `/supplier/orders/${sOrderId}`
      });
    }

    // Create parent order
    const parentOrder: Partial<Order> = {
      id: parentOrderId,
      buyerId: buyer.id,
      buyerName: buyer.businessName || buyer.name,
      totalAmount: totalAmount,
      status: 'pending',
      shippingAddress: shippingAddress,
      contactPhone: contactPhone,
      supplierOrders: supplierOrderIds,
    };

    batch.set(parentOrderRef, {
      ...parentOrder,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Clear cart (delete the cart document)
    batch.delete(doc(db, 'carts', buyer.id));

    await batch.commit();
    return parentOrderId;
  }
}

export const orderService = OrderService.getInstance();
