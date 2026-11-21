import { Link } from 'react-router-dom';
import { formatPrice } from '../api/client';
import { useCart } from '../context/CartContext';
import { useDailyPromotion } from '../context/DailyPromotionContext';

export default function DailyPizzaBanner() {
  const { promotion, product } = useDailyPromotion();
  const { add } = useCart();
  if (!promotion || !product) return null;

  return (
    <section aria-labelledby="daily-pizza-title" className="card overflow-hidden border-alien-400 bg-gradient-to-br from-white to-alien-50 sm:flex">
      <Link to={`/product/${product.id}`} className="block h-56 shrink-0 bg-sky2-50 sm:h-auto sm:w-1/3">
        <img
          src={product.image_url}
          alt={product.name}
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = '/images/placeholder.svg';
          }}
        />
      </Link>
      <div className="flex flex-col items-start gap-4 p-6 sm:p-8">
        <p className="eyebrow">today's classified deal — 20% off</p>
        <h2 id="daily-pizza-title" className="text-2xl sm:text-3xl">Pizza of the Day</h2>
        <Link to={`/product/${product.id}`} className="font-display text-xl font-bold text-alien-700 hover:text-alien-600">
          {product.name}
        </Link>
        <p className="text-sm text-slate-600">{product.description}</p>
        <div className="flex flex-wrap items-center gap-3 font-mono">
          <span className="sr-only">Original price</span>
          <del className="text-lg text-slate-500">{formatPrice(promotion.originalPriceCents)}</del>
          <span className="sr-only">Discounted price</span>
          <span className="text-2xl font-bold text-alien-700">{formatPrice(promotion.discountedPriceCents)}</span>
        </div>
        <button type="button" className="btn-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-alien-700" onClick={() => add(product)}>
          Add to cart
        </button>
        <p className="text-xs text-slate-500">Valid {promotion.validDate}, until midnight UTC.</p>
      </div>
    </section>
  );
}
