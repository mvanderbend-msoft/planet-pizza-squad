import { ApiError } from '../api/ApiError';
import type { CartPricing } from './cartPricing';

const cartIdentity = (pricing: CartPricing) =>
  JSON.stringify(pricing.items.map((item) => [item.product.id, item.quantity, item.unitPriceCents]));

export async function submitReviewedCart<T>(
  reviewed: CartPricing,
  refresh: () => Promise<CartPricing>,
  submit: (pricing: CartPricing) => Promise<T>
): Promise<{ order: T } | { review: string }> {
  const fresh = await refresh();
  if (fresh.status === 'loading' || fresh.status === 'unavailable') {
    return { review: 'Pizza pricing unavailable. Retry pricing before paying; your cart is unchanged.' };
  }
  if (fresh.totalCents !== reviewed.totalCents || cartIdentity(fresh) !== cartIdentity(reviewed)) {
    return { review: 'Your cargo prices changed. Review the updated total and click Pay again.' };
  }
  try {
    return { order: await submit(fresh) };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 409 ||
        error.body.code !== 'PROMOTION_DATE_CHANGED') throw error;
    await refresh();
    return { review: 'The daily offer changed. Review the updated prices and click Pay again. Your cart is unchanged.' };
  }
}
