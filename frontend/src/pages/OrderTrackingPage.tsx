import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatPrice, type TrackingStatus } from '../api/client';
import { createOrderTrackingStore, parseOrderId } from '../context/orderTrackingStore';

const steps: { status: TrackingStatus; label: string }[] = [
  { status: 'received', label: 'Received' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'baking', label: 'Baking' },
  { status: 'out_for_delivery', label: 'Out for delivery' },
  { status: 'delivered', label: 'Delivered' },
];

function timestamp(value: string) {
  return <time dateTime={value}>{new Date(value).toLocaleString()}</time>;
}

export default function OrderTrackingPage() {
  const { id } = useParams();
  const store = useMemo(() => createOrderTrackingStore(parseOrderId(id), api), [id]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    store.start();
    return store.stop;
  }, [store]);

  if (state.invalidId || state.notFound) {
    return (
      <section className="max-w-2xl mx-auto card p-6 sm:p-8">
        <h1 className="text-3xl text-alien-700">{state.notFound ? 'Order not found' : 'Invalid order number'}</h1>
        <p className="mt-4 text-slate-700">
          {state.notFound ? 'No delivery matches this order number. Please check your confirmation and try its order number again.'
            : 'Please use a positive whole-number order number from your confirmation.'}
        </p>
        <Link to="/" className="btn-secondary mt-6 inline-flex">Return to base</Link>
      </section>
    );
  }

  const { tracking, order } = state;
  const hasError = state.statusError || state.orderError;
  return (
    <section className="max-w-3xl mx-auto card p-6 sm:p-8">
      <p className="eyebrow">Delivery transmission</p>
      <h1 className="mt-2 text-3xl sm:text-4xl text-alien-700">Tracking order #{parseOrderId(id)}</h1>

      {hasError && (
        <div role="alert" className="mt-6 rounded border border-amber-300 bg-amber-50 p-4 text-slate-800">
          {state.statusError && <p>{state.statusError}</p>}
          {state.orderError && <p>{state.orderError}</p>}
          {(tracking || order) && <p className="mt-2">Last known delivery information is kept below.</p>}
          <button type="button" className="btn-secondary mt-3" onClick={store.retry}
            disabled={state.statusLoading || state.orderLoading}>Retry</button>
        </div>
      )}

      <div role="status" aria-live="polite" className="mt-5 text-slate-700">
        {tracking
          ? `Current step: ${steps.find((step) => step.status === tracking.status)?.label}. ${
            tracking.status === 'delivered' ? 'Delivery complete. Automatic refresh stopped.' : 'Status refreshes automatically.'}`
          : state.statusLoading ? 'Contacting the mothership for delivery status…' : 'Delivery status could not be loaded.'}
      </div>
      {tracking && <p className="mt-3 text-slate-700">Estimated delivery: {timestamp(tracking.estimated_delivery_at)}</p>}

      <ol aria-label="Delivery progress" className="mt-6 space-y-3">
        {steps.map(({ status, label }, index) => {
          const current = tracking?.status === status;
          const reached = tracking?.step_timestamps[status];
          return (
            <li key={status} aria-current={current ? 'step' : undefined}
              className={`rounded border p-4 ${current ? 'border-alien-600 bg-alien-50 ring-2 ring-alien-600' : 'border-slate-200'}`}>
              <p className="font-bold text-slate-800">{index + 1}. {label}{current ? ' — Current step' : reached ? ' — Completed' : ' — Pending'}</p>
              {reached && <p className="mt-1 text-sm text-slate-600">Reached: {timestamp(reached)}</p>}
            </li>
          );
        })}
      </ol>

      <h2 className="mt-8 text-xl text-alien-700">Itemized cargo manifest</h2>
      {!order && <p className="mt-3 text-slate-600" role="status">
        {state.orderLoading ? 'Decrypting paid order items…' : 'Items are unavailable until you retry.'}
      </p>}
      {order && (
        <div className="mt-3 rounded border border-slate-200 bg-alien-50/40 p-4">
          <ul className="space-y-3 text-sm text-slate-800">
            {order.items.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2">
                <span className="min-w-0 break-words">{item.name_snapshot} × {item.quantity}
                  <span className="block text-slate-600">{formatPrice(item.unit_price_cents)} each</span>
                </span>
                <span>{formatPrice(item.unit_price_cents * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-slate-200 pt-3 flex flex-wrap justify-between gap-2 font-bold">
            <span>Total charged</span><span>{formatPrice(order.total_cents)}</span>
          </p>
        </div>
      )}
    </section>
  );
}
