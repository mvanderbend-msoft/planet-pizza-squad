import { DatabaseSync } from 'node:sqlite';

export const TRACKING_STATUSES = [
  'received', 'preparing', 'baking', 'out_for_delivery', 'delivered',
] as const;
export type TrackingStatus = typeof TRACKING_STATUSES[number];
export type OrderTracking = {
  order_id: number;
  status: TrackingStatus;
  step_timestamps: Partial<Record<TrackingStatus, string>>;
  estimated_delivery_at: string;
};

const STEP_INTERVAL_MS = 2 * 60 * 1000;

export function scheduledTrackingSteps(
  placement: Date,
  instant: Date
): Partial<Record<TrackingStatus, string>> {
  const reached: Partial<Record<TrackingStatus, string>> = {};
  TRACKING_STATUSES.forEach((status, index) => {
    const scheduled = placement.getTime() + index * STEP_INTERVAL_MS;
    if (index === 0 || scheduled <= instant.getTime()) {
      reached[status] = new Date(scheduled).toISOString();
    }
  });
  return reached;
}

function placementDate(timestamp: string): Date {
  // SQLite's legacy datetime('now') strings have no zone, but represent UTC.
  const utc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)
    ? timestamp.replace(' ', 'T') + 'Z'
    : timestamp;
  const placement = new Date(utc);
  if (!Number.isFinite(placement.getTime())) throw new Error('Invalid order placement time');
  return placement;
}

export function resolveOrderStatus(
  connection: DatabaseSync,
  orderId: number,
  instant: Date
): OrderTracking | null {
  connection.exec('BEGIN IMMEDIATE');
  try {
    const order = connection.prepare('SELECT created_at FROM orders WHERE id = ?')
      .get(orderId) as { created_at: string } | undefined;
    if (!order) {
      connection.exec('COMMIT');
      return null;
    }
    const placement = placementDate(order.created_at);
    const insert = connection.prepare(`
      INSERT INTO order_tracking_steps (order_id, status, reached_at) VALUES (?, ?, ?)
      ON CONFLICT (order_id, status) DO NOTHING
    `);
    const scheduled = scheduledTrackingSteps(placement, instant);
    for (const status of TRACKING_STATUSES) {
      const timestamp = scheduled[status];
      if (timestamp !== undefined) insert.run(orderId, status, timestamp);
    }
    const rows = connection.prepare(
      'SELECT status, reached_at FROM order_tracking_steps WHERE order_id = ?'
    ).all(orderId) as Array<{ status: TrackingStatus; reached_at: string }>;
    const timestamps: Partial<Record<TrackingStatus, string>> = {};
    for (const row of rows) timestamps[row.status] = placementDate(row.reached_at).toISOString();
    const status = [...TRACKING_STATUSES].reverse().find(step => timestamps[step] !== undefined)!;
    const result: OrderTracking = {
      order_id: orderId,
      status,
      step_timestamps: timestamps,
      estimated_delivery_at: new Date(placement.getTime() + 4 * STEP_INTERVAL_MS).toISOString(),
    };
    connection.exec('COMMIT');
    return result;
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
}
