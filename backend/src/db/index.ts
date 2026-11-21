import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'app.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('pizza', 'merch')),
      image_url TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 100
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      total_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid'
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price_cents INTEGER NOT NULL,
      name_snapshot TEXT NOT NULL
    );
  `);
}
