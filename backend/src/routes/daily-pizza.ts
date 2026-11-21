import { Router } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { db } from '../db';
import { resolveDailyPizza } from '../services/daily-pizza';

export function createDailyPizzaRouter(
  connection: DatabaseSync,
  clock: () => Date = () => new Date()
): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const promotion = resolveDailyPizza(connection, clock);
    if (!promotion) {
      return res.status(503).json({ error: 'Daily promotion unavailable' });
    }
    res.json(promotion);
  });
  return router;
}

export const dailyPizzaRouter = createDailyPizzaRouter(db);
