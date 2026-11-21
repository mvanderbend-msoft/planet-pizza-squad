import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';

export const productsRouter = Router();

const querySchema = z.object({
  category: z.enum(['pizza', 'merch']).optional(),
});

productsRouter.get('/', (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }
  const { category } = parsed.data;
  const rows = category
    ? db.prepare('SELECT * FROM products WHERE category = ? ORDER BY id').all(category)
    : db.prepare('SELECT * FROM products ORDER BY id').all();
  res.json(rows);
});

productsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json(row);
});
