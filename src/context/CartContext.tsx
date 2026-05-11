import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { cartService } from '../services/CartService';
import { Cart, CartItem } from '../types';

interface CartContextType {
  cart: Cart | null;
  addItem: (item: Omit<CartItem, 'id'>) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setCart(null);
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const unsub = cartService.subscribe(currentUser.uid, (newCart) => {
      setCart(newCart);
    });

    return () => unsub();
  }, [currentUser]);

  const addItem = async (item: Omit<CartItem, 'id'>) => {
    if (!currentUser) return;
    await cartService.addItem(currentUser.uid, item);
  };

  const removeItem = async (itemId: string) => {
    if (!currentUser) return;
    await cartService.removeItem(currentUser.uid, itemId);
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (!currentUser) return;
    await cartService.updateQuantity(currentUser.uid, itemId, quantity);
  };

  const clearCart = async () => {
    if (!currentUser) return;
    await cartService.clearCart(currentUser.uid);
  };

  const totalItems = cart?.items.reduce((acc, item) => acc + item.quantity, 0) || 0;
  const totalPrice = cart?.items.reduce((acc, item) => acc + (item.price * item.quantity), 0) || 0;

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
