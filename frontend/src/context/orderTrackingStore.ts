import { ApiError } from '../api/ApiError';
import type { Order, OrderTracking } from '../api/client';

export function parseOrderId(value: string | undefined): number | null {
  if (!value || !/^[0-9]+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export type TrackingSnapshot = {
  order: Order | null;
  tracking: OrderTracking | null;
  statusLoading: boolean;
  orderLoading: boolean;
  statusError: string | null;
  orderError: string | null;
  invalidId: boolean;
  notFound: boolean;
};

type TrackingApi = {
  getOrder(id: number, signal?: AbortSignal): Promise<Order>;
  getOrderStatus(id: number, signal?: AbortSignal): Promise<OrderTracking>;
};

type TrackingTimers = {
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
};

export function createOrderTrackingStore(
  id: number | null,
  api: TrackingApi,
  timers: TrackingTimers = { setTimeout, clearTimeout },
) {
  const { setTimeout: schedule, clearTimeout: cancel } = timers;
  const valid = id !== null && Number.isSafeInteger(id) && id > 0;
  let state: TrackingSnapshot = {
    order: null, tracking: null, statusLoading: valid, orderLoading: valid,
    statusError: null, orderError: null, invalidId: !valid, notFound: false,
  };
  const listeners = new Set<() => void>();
  let active = false;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let statusRequest: AbortController | undefined;
  let orderRequest: AbortController | undefined;

  function publish(patch: Partial<TrackingSnapshot>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  function clearTimer() {
    if (timer !== undefined) cancel(timer);
    timer = undefined;
  }

  function stop() {
    active = false;
    generation++;
    clearTimer();
    statusRequest?.abort();
    orderRequest?.abort();
    statusRequest = orderRequest = undefined;
  }

  function missingOrder() {
    stop();
    publish({
      notFound: true, order: null, tracking: null,
      statusLoading: false, orderLoading: false, statusError: null, orderError: null,
    });
  }

  function isAbort(error: unknown) {
    return error instanceof Error && error.name === 'AbortError';
  }

  function delivered() {
    return state.tracking?.status === 'delivered';
  }

  async function fetchStatus() {
    if (!active || !valid || statusRequest || delivered()) return;
    clearTimer();
    const current = generation;
    const controller = new AbortController();
    statusRequest = controller;
    publish({ statusLoading: true });
    try {
      const tracking = await api.getOrderStatus(id!, controller.signal);
      if (!active || generation !== current) return;
      publish({ tracking, statusError: null });
    } catch (error) {
      if (!active || generation !== current || isAbort(error)) return;
      if (error instanceof ApiError && error.status === 404) {
        missingOrder();
        return;
      }
      publish({ statusError: 'Status transmission interrupted. We will retry automatically; you can also Retry now.' });
    } finally {
      if (active && generation === current) {
        statusRequest = undefined;
        publish({ statusLoading: false });
        if (!delivered()) {
          timer = schedule(() => {
            timer = undefined;
            void fetchStatus();
          }, 15_000);
        }
      }
    }
  }

  async function fetchOrder() {
    if (!active || !valid || orderRequest || state.order) return;
    const current = generation;
    const controller = new AbortController();
    orderRequest = controller;
    publish({ orderLoading: true });
    try {
      const order = await api.getOrder(id!, controller.signal);
      if (!active || generation !== current) return;
      publish({ order, orderError: null });
    } catch (error) {
      if (!active || generation !== current || isAbort(error)) return;
      if (error instanceof ApiError && error.status === 404) {
        missingOrder();
        return;
      }
      publish({ orderError: 'Cargo manifest unavailable. Retry to load your paid order items.' });
    } finally {
      if (active && generation === current) {
        orderRequest = undefined;
        publish({ orderLoading: false });
      }
    }
  }

  function retry() {
    void fetchStatus();
    void fetchOrder();
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start() {
      if (active || !valid || state.notFound) return;
      active = true;
      retry();
    },
    stop,
    retry,
  };
}
