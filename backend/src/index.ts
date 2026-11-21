import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { migrate } from './db';
import { seedIfEmpty } from './db/seed';
import { productsRouter } from './routes/products';
import { ordersRouter } from './routes/orders';

migrate();
seedIfEmpty();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
