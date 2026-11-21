import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Product } from '../api/client';
import ProductCard from '../components/ProductCard';

export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  useEffect(() => {
    api.listProducts().then((all) => setFeatured(all.slice(0, 4))).catch(console.error);
  }, []);
  return (
    <div className="space-y-12">
      <section className="rounded-2xl border border-alien-200 bg-gradient-to-br from-white via-sky2-50 to-alien-50 p-10 text-center shadow-glow">
        <p className="eyebrow">classified — eyes only</p>
        <h1 className="mt-3 text-5xl font-black text-alien-700 md:text-6xl">They came for the pizza.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-700">
          Hand-tossed in Area 51's most secure hangar. Delivered by unmarked craft.
          Pizzas, merch, and zero plausible deniability.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link to="/pizzas" className="btn-primary">Order Pizza</Link>
          <Link to="/merch" className="btn-secondary">Shop Merch</Link>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl text-alien-700">Featured Transmissions</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </div>
  );
}
