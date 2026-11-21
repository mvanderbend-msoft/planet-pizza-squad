import { Link } from 'react-router-dom';
import { formatPrice } from '../api/client';
import { useCart } from '../context/CartContext';

export default function CartPage() {
  const { items, updateQuantity, remove, totalCents } = useCart();

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl text-alien-700 mb-4">Your cargo bay is empty</h1>
        <p className="text-slate-600 mb-6">Nothing to beam up yet.</p>
        <Link to="/pizzas" className="btn-primary">Browse pizzas</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl text-alien-700 mb-6">Cargo Bay</h1>
      <div className="card divide-y divide-slate-200">
        {items.map(({ product, quantity }) => (
          <div key={product.id} className="flex items-center gap-4 p-4">
            <img
              src={product.image_url}
              alt=""
              className="h-20 w-20 rounded object-cover bg-gradient-to-br from-sky2-50 to-alien-50"
              onError={(e) => ((e.currentTarget as HTMLImageElement).src = '/images/placeholder.svg')}
            />
            <div className="flex-1">
              <Link to={`/product/${product.id}`} className="font-display text-lg text-alien-700 hover:text-alien-600">{product.name}</Link>
              <p className="font-mono text-sm text-slate-500">{formatPrice(product.price_cents)}</p>
            </div>
            <input
              type="number"
              min={0}
              max={product.stock}
              value={quantity}
              onChange={(e) => updateQuantity(product.id, Number(e.target.value) || 0)}
              className="input w-20"
            />
            <div className="w-24 text-right font-mono text-slate-900">{formatPrice(product.price_cents * quantity)}</div>
            <button onClick={() => remove(product.id)} className="text-slate-400 hover:text-red-500 text-xl px-2" aria-label="Remove">×</button>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <div className="font-mono text-xl text-slate-700">
          Total: <span className="text-alien-700 text-2xl">{formatPrice(totalCents)}</span>
        </div>
        <Link to="/checkout" className="btn-primary">Proceed to checkout</Link>
      </div>
    </div>
  );
}
