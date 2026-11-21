import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import type { Product } from '../api/client';

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  add: (product: Product, qty?: number) => void;
  remove: (productId: number) => void;
  updateQuantity: (productId: number, qty: number) => void;
  clear: () => void;
  totalCents: number;
  totalCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'planet-pizza-cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((product: Product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { product, quantity: qty }];
    });
  }, []);

  const remove = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.product.id !== productId)
        : prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totalCents = useMemo(
    () => items.reduce((sum, i) => sum + i.product.price_cents * i.quantity, 0),
    [items]
  );
  const totalCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  const value: CartContextValue = { items, add, remove, updateQuantity, clear, totalCents, totalCount };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
