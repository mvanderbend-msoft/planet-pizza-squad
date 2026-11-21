import { ApiError } from './ApiError';

export type Product = {
  id: number;
  sku: string;
  name: string;
  description: string;
  price_cents: number;
  category: 'pizza' | 'merch';
  image_url: string;
  stock: number;
};

export type DailyPizza = {
  product: Product;
  original_price_cents: number;
  discounted_price_cents: number;
  valid_date: string;
};

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price_cents: number;
  name_snapshot: string;
};

export type Order = {
  id: number;
  created_at: string;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  total_cents: number;
  status: string;
  items: OrderItem[];
};

export type TrackingStatus = 'received' | 'preparing' | 'baking' | 'out_for_delivery' | 'delivered';

export type OrderTracking = {
  order_id: number;
  status: TrackingStatus;
  step_timestamps: Partial<Record<TrackingStatus, string>>;
  estimated_delivery_at: string;
};

const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { error: text }; }
    throw new ApiError(res.status, body ?? {});
  }
  return res.json() as Promise<T>;
}

export const api = {
  getDailyPizza: (signal?: AbortSignal) =>
    request<DailyPizza>('/pizza-of-the-day', { cache: 'no-store', signal }),
  listProducts: (category?: 'pizza' | 'merch') =>
    request<Product[]>(`/products${category ? `?category=${category}` : ''}`),
  getProduct: (id: number) => request<Product>(`/products/${id}`),
  createOrder: (body: {
    customer: { name: string; email: string; address: string };
    items: { productId: number; quantity: number }[];
    promotion_date?: string;
  }) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(body) }),
  getOrder: (id: number, signal?: AbortSignal) =>
    request<Order>(`/orders/${id}`, { cache: 'no-store', signal }),
  getOrderStatus: (id: number, signal?: AbortSignal) =>
    request<OrderTracking>(`/orders/${id}/status`, { cache: 'no-store', signal }),
};

export const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
