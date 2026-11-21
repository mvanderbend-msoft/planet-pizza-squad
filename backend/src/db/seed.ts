import { db } from './index';

type SeedProduct = {
  sku: string;
  name: string;
  description: string;
  price_cents: number;
  category: 'pizza' | 'merch';
  image_url: string;
  stock: number;
};

const PRODUCTS: SeedProduct[] = [
  // Pizzas
  { sku: 'PZ-ROSWELL', name: 'Roswell Margherita', description: 'Classic crash-landed margherita with crater-fresh mozzarella and basil from Hangar 18.', price_cents: 1299, category: 'pizza', image_url: '/images/pizza-margherita.svg', stock: 100 },
  { sku: 'PZ-ABDUCT', name: 'Abduction Pepperoni', description: 'Beamed-up pepperoni layered over alien-orbit tomato sauce. Probably abducted from Italy.', price_cents: 1499, category: 'pizza', image_url: '/images/pizza-pepperoni.svg', stock: 100 },
  { sku: 'PZ-LGV', name: 'Little Green Veggie', description: 'Bell peppers, olives, onions, mushrooms — all in a healthy shade of close-encounter green.', price_cents: 1399, category: 'pizza', image_url: '/images/pizza-veggie.svg', stock: 100 },
  { sku: 'PZ-AREA51', name: 'Area 51 Supreme', description: 'Top-secret recipe: pepperoni, sausage, peppers, onions, olives. We could tell you, but...', price_cents: 1699, category: 'pizza', image_url: '/images/pizza-supreme.svg', stock: 100 },
  { sku: 'PZ-MOTHER', name: 'Mothership Meat Lovers', description: 'A heavy payload of pepperoni, sausage, bacon, and ham. Requires anti-gravity to lift.', price_cents: 1799, category: 'pizza', image_url: '/images/pizza-meat.svg', stock: 100 },
  { sku: 'PZ-COSMIC', name: 'Cosmic Hawaiian', description: 'Ham and pineapple from a galaxy where this is universally loved. Fight us.', price_cents: 1499, category: 'pizza', image_url: '/images/pizza-hawaiian.svg', stock: 100 },
  { sku: 'PZ-UFO', name: 'UFO BBQ Chicken', description: 'Smoked chicken, red onion, cilantro, and a tangy BBQ sauce from an undisclosed dimension.', price_cents: 1599, category: 'pizza', image_url: '/images/pizza-bbq.svg', stock: 100 },
  { sku: 'PZ-NEBULA', name: 'Nebula Four Cheese', description: 'Mozzarella, parmesan, gorgonzola, and ricotta swirled like a distant nebula.', price_cents: 1599, category: 'pizza', image_url: '/images/pizza-cheese.svg', stock: 100 },

  // Merch
  { sku: 'MR-TEE-UFO', name: '"I Saw a UFO" Tee', description: 'Black 100% cotton tee with neon green UFO print. Witnesses sold separately.', price_cents: 2499, category: 'merch', image_url: '/images/merch-tee-ufo.svg', stock: 50 },
  { sku: 'MR-TEE-PROBE', name: '"Probed & Approved" Tee', description: 'A conversation starter. Or ender. Depends on the conversation.', price_cents: 2499, category: 'merch', image_url: '/images/merch-tee-probe.svg', stock: 50 },
  { sku: 'MR-MUG', name: 'Alien Abduction Mug', description: 'Color-changing mug: pour hot coffee and watch the cow get beamed up.', price_cents: 1599, category: 'merch', image_url: '/images/merch-mug.svg', stock: 75 },
  { sku: 'MR-PLUSH', name: 'Lil\' Grey Plushie', description: 'Cuddly extraterrestrial companion. Government-approved. Probably.', price_cents: 1999, category: 'merch', image_url: '/images/merch-plush.svg', stock: 40 },
  { sku: 'MR-STICK', name: 'Tinfoil Hat Sticker Pack', description: 'Pack of 10 holographic stickers. Blocks 5G, soothes anxiety, looks rad on a laptop.', price_cents: 799, category: 'merch', image_url: '/images/merch-stickers.svg', stock: 200 },
  { sku: 'MR-CAP', name: 'Area 51 Trucker Cap', description: 'Classic mesh-back trucker with embroidered "Area 51 Pizza Co." patch.', price_cents: 2199, category: 'merch', image_url: '/images/merch-cap.svg', stock: 60 },
];

export function seedIfEmpty(): void {
  const count = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO products (sku, name, description, price_cents, category, image_url, stock)
    VALUES (@sku, @name, @description, @price_cents, @category, @image_url, @stock)
  `);

  db.exec('BEGIN');
  try {
    for (const r of PRODUCTS) insert.run(r as unknown as Record<string, string | number>);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  console.log(`[seed] inserted ${PRODUCTS.length} products`);
}
