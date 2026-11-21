import type { Product } from '../api/client';
import type { DailyPromotionState } from './dailyPromotionStore';

export type CartItem = { product: Product; quantity: number };
export type PricedCartItem = CartItem & { unitPriceCents: number };
export type CartPricing = {
  items: PricedCartItem[];
  totalCents: number;
  status: 'ready' | 'base' | 'loading' | 'unavailable';
  promotionDate?: string;
};

export function priceCart(
  items: CartItem[], state: DailyPromotionState, today = new Date().toISOString().slice(0, 10)
): CartPricing {
  const hasPizza = items.some((item) => item.product.category === 'pizza');
  const promotion = state.promotion?.validDate === today ? state.promotion : null;
  const noOffer = state.noOfferDate === today;
  const priced = items.map((item) => ({
    ...item,
    unitPriceCents: item.product.category === 'pizza' && item.product.id === promotion?.productId
      ? promotion.discountedPriceCents : item.product.price_cents,
  }));
  return {
    items: priced,
    totalCents: priced.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
    status: !hasPizza ? 'ready' : state.loading ? 'loading' :
      promotion ? 'ready' : noOffer ? 'base' : 'unavailable',
    promotionDate: hasPizza ? promotion?.validDate ?? (noOffer ? today : undefined) : undefined,
  };
}

export function addCartItem(items: CartItem[], product: Product, quantity = 1): CartItem[] {
  const existing = items.find((item) => item.product.id === product.id);
  return existing
    ? items.map((item) => item.product.id === product.id
      ? { product, quantity: item.quantity + quantity } : item)
    : [...items, { product, quantity }];
}

export function restoreCartProducts(items: CartItem[], products: Product[]): CartItem[] {
  return items.map((item) => {
    if (item.product.category !== 'pizza') return item;
    const product = products.find((product) => product.id === item.product.id);
    if (!product) throw new Error('Restored pizza is no longer on the menu');
    return { ...item, product };
  });
}
