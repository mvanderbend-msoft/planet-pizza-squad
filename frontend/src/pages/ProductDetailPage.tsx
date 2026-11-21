import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, formatPrice, type Product } from '../api/client';
import { useCart } from '../context/CartContext';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!id) return;
    api.getProduct(Number(id)).then(setProduct).catch((e) => setError(String(e)));
  }, [id]);

  if (error) return <p className="text-red-600">Not found.</p>;
  if (!product) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="card overflow-hidden bg-gradient-to-br from-sky2-50 to-alien-50">
        <img
          src={product.image_url}
          alt={product.name}
          className="aspect-square w-full object-cover"
          onError={(e) => ((e.currentTarget as HTMLImageElement).src = '/images/placeholder.svg')}
        />
      </div>
      <div className="flex flex-col gap-4">
        <p className="eyebrow">
          {product.category === 'pizza' ? 'Hand-tossed · Hangar 18' : 'Limited issue · Area 51'}
        </p>
        <h1 className="text-4xl text-alien-700">{product.name}</h1>
        <p className="font-mono text-2xl text-slate-900">{formatPrice(product.price_cents)}</p>
        <p className="text-slate-700">{product.description}</p>
        <div className="mt-4 flex items-center gap-3">
          <label className="font-mono text-sm uppercase text-slate-600">Qty</label>
          <input
            type="number"
            min={1}
            max={product.stock}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="input w-20"
          />
          <button
            className="btn-primary"
            onClick={() => {
              add(product, qty);
              navigate('/cart');
            }}
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
