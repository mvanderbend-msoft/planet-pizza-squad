const path = require('node:path');
const express = require('express');

process.env.DB_PATH = ':memory:';
const { db, migrate } = require('../dist/db');
const { productsRouter } = require('../dist/routes/products');
const { createDailyPizzaRouter } = require('../dist/routes/daily-pizza');
const { createOrdersRouter } = require('../dist/routes/orders');
migrate(db);
db.exec(`
  INSERT INTO products (id, sku, name, description, price_cents, category, image_url, stock)
  VALUES (1, 'smoke-pizza-1', 'Smoke Pizza One', 'Isolated fixture', 1299, 'pizza', '/images/placeholder.svg', 99),
         (2, 'smoke-pizza-2', 'Smoke Pizza Two', 'Isolated fixture', 1001, 'pizza', '/images/placeholder.svg', 99),
         (3, 'smoke-merch', 'Smoke Shirt', 'Isolated fixture', 2000, 'merch', '/images/placeholder.svg', 99);
  INSERT INTO daily_pizza_selections (valid_date, product_id)
  VALUES ('2026-12-31', 1), ('2027-01-01', 2);
`);
let instant = '2026-12-31T12:00:00Z';
let failPromotion = false;
let rejectNextOrder = false;
const app = express();
app.use(express.json());
app.post('/__smoke', (req, res) => {
  if (req.body.reset) db.exec('DELETE FROM order_items; DELETE FROM orders');
  instant = req.body.instant ?? instant;
  failPromotion = req.body.failPromotion ?? false;
  rejectNextOrder = req.body.rejectNextOrder ?? false;
  res.json({ instant });
});
app.get('/__smoke', (_req, res) => res.json({
  orders: db.prepare('SELECT * FROM orders').all(),
  items: db.prepare('SELECT * FROM order_items').all(),
}));
app.use('/api/products', productsRouter);
app.use('/api/pizza-of-the-day', (_req, res, next) =>
  failPromotion ? res.status(503).json({ error: 'Smoke storage failure' }) : next(),
createDailyPizzaRouter(db, () => new Date(instant)));
app.use('/api/orders', (req, res, next) => {
  if (req.method === 'POST' && rejectNextOrder) {
    rejectNextOrder = false;
    return res.status(409).json({ code: 'PROMOTION_DATE_CHANGED', error: 'Promotion date changed' });
  }
  next();
}, createOrdersRouter(db, () => new Date(instant)));
app.use(express.static(path.resolve(__dirname, '../../frontend/dist')));
app.get('*', (_req, res) => res.sendFile(path.resolve(__dirname, '../../frontend/dist/index.html')));
const server = app.listen(4177, '127.0.0.1', () =>
  console.log('Isolated UI smoke: http://127.0.0.1:4177 (in-memory DB, fixed UTC clock)'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => {
  db.close();
  process.exit(0);
}));
