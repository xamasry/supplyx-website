import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Cart, CartItem, SupplierStoreProduct } from '../types';

class CartService {
  private static instance: CartService;
  private cart: Cart | null = null;
  private listeners: ((cart: Cart | null) => void)[] = [];

  private constructor() {}

  public static getInstance(): CartService {
    if (!CartService.instance) {
      CartService.instance = new CartService();
    }
    return CartService.instance;
  }

  public subscribe(userId: string, callback: (cart: Cart | null) => void) {
    this.listeners.push(callback);
    
    // Remote sync listener
    const unsub = onSnapshot(doc(db, 'carts', userId), (docSnap) => {
      if (docSnap.exists()) {
        this.cart = { id: docSnap.id, ...docSnap.data() } as Cart;
      } else {
        this.cart = { id: userId, items: [], updatedAt: new Date().toISOString() };
      }
      this.notify();
    });

    return () => {
      unsub();
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.cart));
  }

  public async addItem(userId: string, item: Omit<CartItem, 'id'>) {
    const cartRef = doc(db, 'carts', userId);
    const cartSnap = await getDoc(cartRef);
    
    let items: CartItem[] = [];
    if (cartSnap.exists()) {
      items = (cartSnap.data() as Cart).items;
    }

    // Check if item already exists with same level
    const existingIndex = items.findIndex(i => 
      i.productId === item.productId && i.packagingLevelId === item.packagingLevelId
    );

    if (existingIndex > -1) {
      items[existingIndex].quantity += item.quantity;
    } else {
      items.push({
        ...item,
        id: Math.random().toString(36).substr(2, 9)
      });
    }

    await setDoc(cartRef, {
      items,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  public async removeItem(userId: string, itemId: string) {
    if (!this.cart) return;
    
    const newItems = this.cart.items.filter(i => i.id !== itemId);
    await updateDoc(doc(db, 'carts', userId), {
      items: newItems,
      updatedAt: new Date().toISOString()
    });
  }

  public async updateQuantity(userId: string, itemId: string, quantity: number) {
    if (!this.cart) return;
    
    const newItems = this.cart.items.map(i => 
      i.id === itemId ? { ...i, quantity } : i
    );
    
    await updateDoc(doc(db, 'carts', userId), {
      items: newItems,
      updatedAt: new Date().toISOString()
    });
  }

  public async clearCart(userId: string) {
    await setDoc(doc(db, 'carts', userId), {
      items: [],
      updatedAt: new Date().toISOString()
    });
  }

  public getCart() {
    return this.cart;
  }
}

export const cartService = CartService.getInstance();
