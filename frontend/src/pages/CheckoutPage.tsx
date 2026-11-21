import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { useCart } from '../context/CartContext';

export default function CheckoutPage() {
  const { items, totalCents, clear } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', address: '' });

  if (items.length === 0 && !submitting) return <Navigate to="/cart" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const order = await api.createOrder({
        customer: form,
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      });
      clear();
      navigate(`/order/${order.id}`, { replace: true });
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
      <form onSubmit={onSubmit} className="card p-6 space-y-4">
        <h1 className="text-3xl text-alien-700">Mock Checkout</h1>
        <p className="eyebrow">No real payment — this is a demo</p>

        <div>
          <label className="font-mono text-sm uppercase text-slate-600">Earthling Name</label>
          <input className="input mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="font-mono text-sm uppercase text-slate-600">Email Transmission</label>
          <input type="email" className="input mt-1" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="font-mono text-sm uppercase text-slate-600">Drop Coordinates</label>
          <textarea className="input mt-1" rows={3} required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Transmitting…' : `Pay ${formatPrice(totalCents)} (mock)`}
        </button>
      </form>

      <aside className="card p-6">
        <h2 className="text-xl text-alien-700 mb-4">Your Cargo</h2>
        <ul className="space-y-2 text-sm text-slate-700">
          {items.map((i) => (
            <li key={i.product.id} className="flex justify-between">
              <span>{i.product.name} × {i.quantity}</span>
              <span className="font-mono">{formatPrice(i.product.price_cents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <hr className="my-3 border-slate-200" />
        <div className="flex justify-between font-mono text-lg">
          <span className="text-slate-700">Total</span>
          <span className="text-alien-700">{formatPrice(totalCents)}</span>
        </div>
      </aside>
    </div>
  );
}
