import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatPrice, type Order } from '../api/client';

export default function OrderConfirmationPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getOrder(Number(id)).then(setOrder).catch((e) => setError(String(e)));
  }, [id]);

  if (error) return <p className="text-red-600">Order not found.</p>;
  if (!order) return <p className="text-slate-500">Decrypting confirmation…</p>;

  return (
    <div className="max-w-2xl mx-auto card p-8">
      <p className="eyebrow">Transmission received</p>
      <h1 className="mt-2 text-4xl text-alien-700">Order #{order.id} confirmed 👽</h1>
      <p className="mt-4 text-slate-700">
        Thanks, <span className="text-alien-700 font-bold">{order.customer_name}</span>. The mothership is preparing your delivery.
      </p>

      <div className="mt-6 rounded border border-slate-200 p-4 bg-alien-50/40">
        <h2 className="text-lg text-alien-700 mb-3">Itemized cargo manifest</h2>
        <ul className="space-y-1 text-sm font-mono text-slate-800">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between">
              <span>{it.name_snapshot} × {it.quantity}</span>
              <span>{formatPrice(it.unit_price_cents * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <hr className="my-3 border-slate-200" />
        <div className="flex justify-between font-mono text-lg">
          <span className="text-slate-700">Total charged</span>
          <span className="text-alien-700">{formatPrice(order.total_cents)}</span>
        </div>
      </div>

      <p className="mt-6 text-sm text-slate-600">
        Drop coordinates: <span className="text-slate-900">{order.shipping_address}</span>
      </p>

      <Link to="/" className="btn-secondary mt-8 inline-flex">Return to base</Link>
    </div>
  );
}
