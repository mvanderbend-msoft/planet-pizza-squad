import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';

export const ordersRouter = Router();

const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(200),
    address: z.string().min(1).max(500),
  }),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive().max(99),
      })
    )
    .min(1),
});

type ProductRow = { id: number; name: string; price_cents: number; stock: number };

ordersRouter.post('/', (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid order', details: parsed.error.flatten() });
  }
  const { customer, items } = parsed.data;

  const getProduct = db.prepare('SELECT id, name, price_cents, stock FROM products WHERE id = ?');
  const insertOrder = db.prepare(
    'INSERT INTO orders (customer_name, customer_email, shipping_address, total_cents) VALUES (?, ?, ?, ?)'
  );
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents, name_snapshot) VALUES (?, ?, ?, ?, ?)'
  );

  try {
    let createdId = 0;
    db.exec('BEGIN');
    try {
      let total = 0;
      const resolved: Array<{ p: ProductRow; qty: number }> = [];
      for (const it of items) {
        const p = getProduct.get(it.productId) as ProductRow | undefined;
        if (!p) throw Object.assign(new Error(`Product ${it.productId} not found`), { status: 400 });
        if (p.stock < it.quantity) {
          throw Object.assign(new Error(`Insufficient stock for ${p.name}`), { status: 409 });
        }
        total += p.price_cents * it.quantity;
        resolved.push({ p, qty: it.quantity });
      }

      const info = insertOrder.run(customer.name, customer.email, customer.address, total);
      createdId = Number(info.lastInsertRowid);
      for (const { p, qty } of resolved) {
        insertItem.run(createdId, p.id, qty, p.price_cents, p.name);
      }
      db.exec('COMMIT');
    } catch (innerErr) {
      db.exec('ROLLBACK');
      throw innerErr;
    }

    const order = loadOrder(createdId);
    res.status(201).json(order);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    res.status(e.status ?? 500).json({ error: e.message ?? 'Order failed' });
  }
});

ordersRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  const order = loadOrder(id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

function loadOrder(id: number) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  return { ...order, items };
}
