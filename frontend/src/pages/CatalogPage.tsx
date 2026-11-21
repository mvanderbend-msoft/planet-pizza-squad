import { useEffect, useState } from 'react';
import { api, type Product } from '../api/client';
import ProductCard from '../components/ProductCard';

export default function CatalogPage({ category, title, subtitle }: { category: 'pizza' | 'merch'; title: string; subtitle: string }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProducts(null);
    setError(null);
    api.listProducts(category).then(setProducts).catch((e) => setError(String(e)));
  }, [category]);

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">{subtitle}</p>
        <h1 className="mt-2 text-4xl text-alien-700">{title}</h1>
      </div>
      {error && <p className="text-red-600">Failed to load: {error}</p>}
      {!products && !error && <p className="text-slate-500">Scanning the cosmos…</p>}
      {products && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
