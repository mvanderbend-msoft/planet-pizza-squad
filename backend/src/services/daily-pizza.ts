import { DatabaseSync } from 'node:sqlite';

export type Product = {
  id: number;
  sku: string;
  name: string;
  description: string;
  price_cents: number;
  category: 'pizza' | 'merch';
  image_url: string;
  stock: number;
};

export type DailyPizza = {
  product: Product;
  original_price_cents: number;
  discounted_price_cents: number;
  valid_date: string;
};

export function discountedUnitPrice(priceCents: number): number {
  return Math.floor((priceCents * 80 + 50) / 100);
}

export function resolveDailyPizza(
  connection: DatabaseSync,
  clock: () => Date = () => new Date()
): DailyPizza | null {
  const instant = clock();
  const validDate = instant.toISOString().slice(0, 10);
  const eligible = connection
    .prepare("SELECT id FROM products WHERE category = 'pizza' ORDER BY id")
    .all() as Array<{ id: number }>;
  if (eligible.length < 2) return null;

  const day = Math.floor(instant.getTime() / 86_400_000);
  const index = ((day % eligible.length) + eligible.length) % eligible.length;
  // The date key arbitrates concurrent writers; an existing pick is never replaced.
  connection.prepare(
    'INSERT OR IGNORE INTO daily_pizza_selections (valid_date, product_id) VALUES (?, ?)'
  ).run(validDate, eligible[index].id);

  const product = connection.prepare(`
    SELECT p.* FROM products p
    JOIN daily_pizza_selections s ON s.product_id = p.id
    WHERE s.valid_date = ? AND p.category = 'pizza'
  `).get(validDate) as Product | undefined;
  if (!product) return null;

  return {
    product,
    original_price_cents: product.price_cents,
    discounted_price_cents: discountedUnitPrice(product.price_cents),
    valid_date: validDate,
  };
}
