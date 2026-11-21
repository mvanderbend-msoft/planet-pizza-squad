import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { api, type Product } from '../api/client';
import { useDailyPromotion } from './DailyPromotionContext';
import { addCartItem, priceCart, restoreCartProducts, type CartItem, type CartPricing } from './cartPricing';
export type { CartItem } from './cartPricing';

type CartContextValue = {
  items: CartPricing['items'];
  add: (product: Product, qty?: number) => void;
  remove: (productId: number) => void;
  updateQuantity: (productId: number, qty: number) => void;
  clear: () => void;
  totalCents: number;
  totalCount: number;
  pricingStatus: CartPricing['status'];
  refreshPricing: () => Promise<CartPricing>;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'planet-pizza-cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const daily = useDailyPromotion();
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const needsBaseRestore = useRef(items.some((item) => item.product.category === 'pizza'));
  const [baseStatus, setBaseStatus] = useState<'ready' | 'loading' | 'unavailable'>(
    needsBaseRestore.current ? 'loading' : 'ready'
  );
  const baseRequest = useRef<Promise<boolean> | null>(null);
  const restoreBasePrices = useCallback((): Promise<boolean> => {
    if (!needsBaseRestore.current) return Promise.resolve(true);
    if (baseRequest.current) return baseRequest.current;
    setBaseStatus('loading');
    baseRequest.current = api.listProducts('pizza').then((products) => {
      const restored = restoreCartProducts(itemsRef.current, products);
      itemsRef.current = restored;
      setItems(restored);
      needsBaseRestore.current = false;
      setBaseStatus('ready');
      return true;
    }).catch(() => {
      setBaseStatus('unavailable');
      return false;
    }).finally(() => { baseRequest.current = null; });
    return baseRequest.current;
  }, []);

  useEffect(() => { void restoreBasePrices(); }, [restoreBasePrices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((product: Product, qty = 1) => {
    setItems((prev) => addCartItem(prev, product, qty));
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

  const pricing = priceCart(items, daily);
  if (items.some((item) => item.product.category === 'pizza') && baseStatus !== 'ready') {
    pricing.status = baseStatus;
  }
  const refreshPricing = async () => {
    if (itemsRef.current.some((item) => item.product.category === 'pizza')) {
      const verified = await restoreBasePrices();
      await daily.refresh();
      const fresh = priceCart(itemsRef.current, daily.getSnapshot());
      return verified ? fresh : { ...fresh, status: 'unavailable' as const };
    }
    return priceCart(itemsRef.current, daily.getSnapshot());
  };
  const totalCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  const value: CartContextValue = {
    items: pricing.items, add, remove, updateQuantity, clear,
    totalCents: pricing.totalCents, totalCount, pricingStatus: pricing.status, refreshPricing,
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
