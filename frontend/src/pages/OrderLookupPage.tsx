import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseOrderId } from '../context/orderTrackingStore';

export default function OrderLookupPage() {
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = parseOrderId(orderNumber.trim());
    if (id === null) {
      setError('Enter a positive whole-number order number using digits only (1–9007199254740991).');
      return;
    }
    setError(null);
    navigate(`/orders/${id}/track`);
  }

  return (
    <section className="max-w-xl mx-auto card p-6 sm:p-8">
      <p className="eyebrow">Locate your delivery</p>
      <h1 className="mt-2 text-3xl text-alien-700">Track order</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="order-number" className="block text-sm font-bold text-slate-700">Order number</label>
          <p id="order-number-help" className="mt-2 text-sm text-slate-600">
            Use the number from your confirmation, without the #. No email or customer details needed.
          </p>
          <input
            id="order-number"
            name="orderNumber"
            type="text"
            inputMode="numeric"
            value={orderNumber}
            onChange={(event) => { setOrderNumber(event.target.value); setError(null); }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'order-number-help order-number-error' : 'order-number-help'}
            className="mt-3 w-full rounded border border-slate-300 bg-white p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-alien-500"
          />
          {error && <p id="order-number-error" role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        <button type="submit" className="btn-primary">Track order</button>
      </form>
    </section>
  );
}
