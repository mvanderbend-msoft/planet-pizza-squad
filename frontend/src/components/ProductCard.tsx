import { Link } from 'react-router-dom';
import type { Product } from '../api/client';
import { formatPrice } from '../api/client';
import { useCart } from '../context/CartContext';

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  return (
    <div className="card flex flex-col overflow-hidden group">
      <Link to={`/product/${product.id}`} className="block aspect-square overflow-hidden bg-gradient-to-br from-sky2-50 to-alien-50">
        <img
          src={product.image_url}
          alt={product.name}
          className="h-full w-full object-cover transition group-hover:scale-105"
          onError={(e) => ((e.currentTarget as HTMLImageElement).src = '/images/placeholder.svg')}
        />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link to={`/product/${product.id}`} className="font-display text-lg font-bold text-alien-700 hover:text-alien-600">
          {product.name}
        </Link>
        <p className="flex-1 text-sm text-slate-600 line-clamp-2">{product.description}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-lg text-slate-900">{formatPrice(product.price_cents)}</span>
          <button className="btn-primary text-xs" onClick={() => add(product)}>Add</button>
        </div>
      </div>
    </div>
  );
}
