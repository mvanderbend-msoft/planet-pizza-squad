import type { DailyPizza, Product } from '../api/client';
import { ApiError } from '../api/ApiError';

export type DailyPromotion = {
  productId: number;
  originalPriceCents: number;
  discountedPriceCents: number;
  validDate: string;
};

export type DailyPromotionState = {
  promotion: DailyPromotion | null;
  product: Product | null;
  loading: boolean;
  error: string | null;
  noOfferDate: string | null;
};

type Clock = {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void;
};

const utcDate = (instant: number) => new Date(instant).toISOString().slice(0, 10);

export function createDailyPromotionStore(
  load: (signal: AbortSignal) => Promise<DailyPizza>,
  clock: Clock = {
    now: Date.now,
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (timer) => clearTimeout(timer),
  }
) {
  let state: DailyPromotionState = { promotion: null, product: null, loading: true, error: null, noOfferDate: null };
  let generation = 0;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  function publish(next: DailyPromotionState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  async function refresh(): Promise<DailyPromotion | null> {
    const request = ++generation;
    controller?.abort();
    controller = new AbortController();
    const requestDate = utcDate(clock.now());
    const current = state.promotion?.validDate === utcDate(clock.now());
    publish({
      promotion: current ? state.promotion : null,
      product: current ? state.product : null,
      loading: true,
      error: null,
      noOfferDate: null,
    });
    try {
      const daily = await load(controller.signal);
      if (request !== generation) return null;
      if (
        daily.valid_date !== utcDate(clock.now()) ||
        daily.product.category !== 'pizza' ||
        !Number.isSafeInteger(daily.product.id) ||
        !Number.isSafeInteger(daily.original_price_cents) ||
        !Number.isSafeInteger(daily.discounted_price_cents) ||
        daily.original_price_cents !== daily.product.price_cents ||
        daily.discounted_price_cents < 0 ||
        daily.discounted_price_cents > daily.original_price_cents
      ) {
        throw new Error('Daily promotion is not valid for today');
      }
      const promotion: DailyPromotion = {
        productId: daily.product.id,
        originalPriceCents: daily.original_price_cents,
        discountedPriceCents: daily.discounted_price_cents,
        validDate: daily.valid_date,
      };
      publish({ promotion, product: daily.product, loading: false, error: null, noOfferDate: null });
      return promotion;
    } catch (error) {
      if (request === generation) {
        const noOffer = error instanceof ApiError && error.status === 503 &&
          error.body.error === 'Daily promotion unavailable' && requestDate === utcDate(clock.now());
        publish({
          promotion: null, product: null, loading: false,
          error: noOffer ? null : String(error), noOfferDate: noOffer ? requestDate : null,
        });
      }
      return null;
    }
  }

  function scheduleMidnight() {
    if (timer !== undefined) clock.clearTimeout(timer);
    const now = clock.now();
    const midnight = (Math.floor(now / 86_400_000) + 1) * 86_400_000;
    timer = clock.setTimeout(() => {
      void refresh();
      scheduleMidnight();
    }, midnight - now);
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    refresh,
    resume: () => {
      scheduleMidnight();
      return refresh();
    },
    start: () => {
      scheduleMidnight();
      void refresh();
    },
    stop: () => {
      ++generation;
      controller?.abort();
      if (timer !== undefined) clock.clearTimeout(timer);
    },
  };
}
