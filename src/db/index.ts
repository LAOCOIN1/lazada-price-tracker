// SQLite  → raw node:sqlite (DatabaseSync, built-in Node 22+, no npm install)
// Postgres → drizzle-orm/node-postgres
// MySQL   → drizzle-orm/mysql2

import { DatabaseSync } from 'node:sqlite';

import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { drizzle as drizzleMysql, MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import { eq, desc } from 'drizzle-orm';
import * as schema from './schema.js';
import { DBProduct, DBPriceHistory, DBSettings } from './schema.js';

const DATABASE_TYPE = process.env.DATABASE_TYPE || 'sqlite';
const DATABASE_URL  = process.env.DATABASE_URL  || 'lazada_tracker.db';

let dbSqliteRaw: DatabaseSync | null = null;
let dbPg:   any = null;
let dbMysql: any = null;

let rawPgClient:    any = null;
let rawMysqlClient: any = null;

// ─── Row mappers (snake_case DB → camelCase TS) ───────────────────────────────
function rowToProduct(r: any): DBProduct {
  return {
    id:           r.id,
    url:          r.url,
    title:        r.title,
    imageUrl:     r.image_url,
    initialPrice: r.initial_price,
    currentPrice: r.current_price,
    targetPrice:  r.target_price ?? null,
    lastChecked:  r.last_checked,
    status:       r.status,
    createdAt:    r.created_at,
  };
}
function rowToHistory(r: any): DBPriceHistory {
  return { id: r.id, productId: r.product_id, price: r.price, timestamp: r.timestamp };
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initDb(): Promise<void> {
  console.log(`[DB] Initializing database: ${DATABASE_TYPE}`);

  if (DATABASE_TYPE === 'postgres' || DATABASE_TYPE === 'postgresql') {
    const { Pool } = pg;
    const client = new Pool({ connectionString: DATABASE_URL });
    rawPgClient = client;

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY, url TEXT NOT NULL, title TEXT NOT NULL,
        image_url TEXT NOT NULL, initial_price DOUBLE PRECISION NOT NULL,
        current_price DOUBLE PRECISION NOT NULL, target_price DOUBLE PRECISION,
        last_checked TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL,
        price DOUBLE PRECISION NOT NULL, timestamp TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    dbPg = drizzlePg(client);
    console.log('[DB] PostgreSQL ready.');

  } else if (DATABASE_TYPE === 'mysql') {
    const connection = await mysql.createConnection(DATABASE_URL);
    rawMysqlClient = connection;

    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY, url VARCHAR(2048) NOT NULL,
        title VARCHAR(1024) NOT NULL, image_url VARCHAR(2048) NOT NULL,
        initial_price DOUBLE NOT NULL, current_price DOUBLE NOT NULL,
        target_price DOUBLE, last_checked VARCHAR(64) NOT NULL,
        status VARCHAR(64) NOT NULL, created_at VARCHAR(64) NOT NULL
      );
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL,
        price DOUBLE NOT NULL, timestamp VARCHAR(64) NOT NULL
      );
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(255) PRIMARY KEY, \`value\` TEXT NOT NULL
      );
    `);
    dbMysql = drizzleMysql(connection);
    console.log('[DB] MySQL ready.');

  } else {
    // ── SQLite via node:sqlite (built-in Node 22+, zero native deps) ──────────
    const client = new DatabaseSync(DATABASE_URL);
    dbSqliteRaw = client;

    client.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL, title TEXT NOT NULL, image_url TEXT NOT NULL,
        initial_price REAL NOT NULL, current_price REAL NOT NULL,
        target_price REAL, last_checked TEXT NOT NULL,
        status TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL, price REAL NOT NULL, timestamp TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    console.log(`[DB] SQLite (node:sqlite built-in) ready. File: ${DATABASE_URL}`);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[DB] Closing connections...');
    if (rawPgClient)    { try { await rawPgClient.end();    } catch (_) {} }
    if (rawMysqlClient) { try { await rawMysqlClient.end(); } catch (_) {} }
    if (dbSqliteRaw)    { try { dbSqliteRaw.close();        } catch (_) {} }
    process.exit(0);
  };
  process.once('SIGINT',  shutdown);
  process.once('SIGTERM', shutdown);
}

// ─── Type helper ─────────────────────────────────────────────────────────────
function getType() {
  if (DATABASE_TYPE === 'postgres' || DATABASE_TYPE === 'postgresql') return 'postgres';
  if (DATABASE_TYPE === 'mysql') return 'mysql';
  return 'sqlite';
}

// ─── Repository ───────────────────────────────────────────────────────────────
export async function getProducts(): Promise<DBProduct[]> {
  const type = getType();
  if (type === 'postgres') return (await dbPg.select().from(schema.pgProducts)) as DBProduct[];
  if (type === 'mysql')    return (await dbMysql.select().from(schema.mysqlProducts)) as DBProduct[];
  if (!dbSqliteRaw) throw new Error('[DB] SQLite not initialized');
  return (dbSqliteRaw.prepare('SELECT * FROM products').all() as any[]).map(rowToProduct);
}

export async function addProduct(product: {
  url: string; title: string; imageUrl: string;
  initialPrice: number; currentPrice: number; targetPrice?: number | null;
}): Promise<DBProduct> {
  const type = getType();
  const ts   = new Date().toISOString();
  const data = {
    url: product.url, title: product.title, imageUrl: product.imageUrl,
    initialPrice: product.initialPrice, currentPrice: product.initialPrice,
    targetPrice: product.targetPrice ?? null,
    lastChecked: ts, status: 'active', createdAt: ts,
  };

  if (type === 'postgres') {
    const [r] = await dbPg.insert(schema.pgProducts).values(data).returning();
    await addPriceHistory(r.id, product.initialPrice, ts);
    return r;
  }
  if (type === 'mysql') {
    const [result] = await dbMysql.insert(schema.mysqlProducts).values(data);
    const id = result.insertId;
    await addPriceHistory(id, product.initialPrice, ts);
    const [r] = await dbMysql.select().from(schema.mysqlProducts).where(eq(schema.mysqlProducts.id, id));
    return r;
  }
  // SQLite
  if (!dbSqliteRaw) throw new Error('[DB] SQLite not initialized');
  const stmt = dbSqliteRaw.prepare(`
    INSERT INTO products (url, title, image_url, initial_price, current_price, target_price, last_checked, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    data.url, data.title, data.imageUrl,
    data.initialPrice, data.currentPrice, data.targetPrice,
    data.lastChecked, data.status, data.createdAt
  ) as any;
  const newId = Number(info.lastInsertRowid);
  await addPriceHistory(newId, product.initialPrice, ts);
  const row = dbSqliteRaw.prepare('SELECT * FROM products WHERE id = ?').get(newId);
  return rowToProduct(row);
}

export async function deleteProduct(id: number): Promise<void> {
  const type = getType();
  if (type === 'postgres') {
    await dbPg.delete(schema.pgPriceHistory).where(eq(schema.pgPriceHistory.productId, id));
    await dbPg.delete(schema.pgProducts).where(eq(schema.pgProducts.id, id));
    return;
  }
  if (type === 'mysql') {
    await dbMysql.delete(schema.mysqlPriceHistory).where(eq(schema.mysqlPriceHistory.productId, id));
    await dbMysql.delete(schema.mysqlProducts).where(eq(schema.mysqlProducts.id, id));
    return;
  }
  if (!dbSqliteRaw) throw new Error('[DB] SQLite not initialized');
  dbSqliteRaw.prepare('DELETE FROM price_history WHERE product_id = ?').run(id);
  dbSqliteRaw.prepare('DELETE FROM products WHERE id = ?').run(id);
}

export async function addPriceHistory(productId: number, price: number, timestamp: string): Promise<void> {
  const type = getType();
  const data = { productId, price, timestamp };
  if (type === 'postgres') { await dbPg.insert(schema.pgPriceHistory).values(data); return; }
  if (type === 'mysql')    { await dbMysql.insert(schema.mysqlPriceHistory).values(data); return; }
  if (!dbSqliteRaw) throw new Error('[DB] SQLite not initialized');
  dbSqliteRaw.prepare('INSERT INTO price_history (product_id, price, timestamp) VALUES (?, ?, ?)').run(productId, price, timestamp);
}

export async function getPriceHistory(productId: number): Promise<DBPriceHistory[]> {
  const type = getType();
  if (type === 'postgres') return await dbPg.select().from(schema.pgPriceHistory).where(eq(schema.pgPriceHistory.productId, productId));
  if (type === 'mysql')    return await dbMysql.select().from(schema.mysqlPriceHistory).where(eq(schema.mysqlPriceHistory.productId, productId));
  if (!dbSqliteRaw) throw new Error('[DB] SQLite not initialized');
  return (dbSqliteRaw.prepare('SELECT * FROM price_history WHERE product_id = ?').all(productId) as any[]).map(rowToHistory);
}

export async function updateProductPrice(
  id: number, newPrice: number, status: string, lastChecked: string
): Promise<{ priceDropped: boolean; dropAmount: number; currentPrice: number; prevPrice: number }> {
  const type = getType();

  let prevPrice: number;
  if (type === 'postgres') {
    const [r] = await dbPg.select().from(schema.pgProducts).where(eq(schema.pgProducts.id, id));
    if (!r) throw new Error(`Product ${id} not found`);
    prevPrice = r.currentPrice;
    await dbPg.update(schema.pgProducts).set({ currentPrice: newPrice, status, lastChecked }).where(eq(schema.pgProducts.id, id));
  } else if (type === 'mysql') {
    const [r] = await dbMysql.select().from(schema.mysqlProducts).where(eq(schema.mysqlProducts.id, id));
    if (!r) throw new Error(`Product ${id} not found`);
    prevPrice = r.currentPrice;
    await dbMysql.update(schema.mysqlProducts).set({ currentPrice: newPrice, status, lastChecked }).where(eq(schema.mysqlProducts.id, id));
  } else {
    if (!dbSqliteRaw) throw new Error('[DB] SQLite not initialized');
    const r = dbSqliteRaw.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!r) throw new Error(`Product ${id} not found`);
    prevPrice = r.current_price;
    dbSqliteRaw.prepare('UPDATE products SET current_price = ?, status = ?, last_checked = ? WHERE id = ?').run(newPrice, status, lastChecked, id);
  }

  const priceDropped = newPrice < prevPrice;
  const dropAmount   = priceDropped ? prevPrice - newPrice : 0;
  if (newPrice !== prevPrice) await addPriceHistory(id, newPrice, lastChecked);
  return { priceDropped, dropAmount, currentPrice: newPrice, prevPrice };
}

export async function updateProductTargetPrice(id: number, targetPrice: number | null): Promise<void> {
  const type = getType();
  if (type === 'postgres') { await dbPg.update(schema.pgProducts).set({ targetPrice }).where(eq(schema.pgProducts.id, id)); return; }
  if (type === 'mysql')    { await dbMysql.update(schema.mysqlProducts).set({ targetPrice }).where(eq(schema.mysqlProducts.id, id)); return; }
  if (!dbSqliteRaw) throw new Error('[DB] SQLite not initialized');
  dbSqliteRaw.prepare('UPDATE products SET target_price = ? WHERE id = ?').run(targetPrice, id);
}

export async function getTelegramSettings(): Promise<{ token?: string; chatId?: string }> {
  const type = getType();
  let rows: DBSettings[] = [];
  if (type === 'postgres') rows = await dbPg.select().from(schema.pgSettings);
  else if (type === 'mysql') rows = await dbMysql.select().from(schema.mysqlSettings);
  else {
    if (!dbSqliteRaw) throw new Error('[DB] SQLite not initialized');
    rows = dbSqliteRaw.prepare("SELECT * FROM settings WHERE key IN ('telegram_token','telegram_chat_id')").all() as DBSettings[];
  }
  return {
    token:  rows.find(s => s.key === 'telegram_token')?.value,
    chatId: rows.find(s => s.key === 'telegram_chat_id')?.value,
  };
}

export async function saveTelegramSettings(token: string, chatId: string): Promise<void> {
  const type = getType();
  if (type === 'postgres') {
    await dbPg.insert(schema.pgSettings).values({ key: 'telegram_token', value: token }).onConflictDoUpdate({ target: schema.pgSettings.key, set: { value: token } });
    await dbPg.insert(schema.pgSettings).values({ key: 'telegram_chat_id', value: chatId }).onConflictDoUpdate({ target: schema.pgSettings.key, set: { value: chatId } });
    return;
  }
  if (type === 'mysql') {
    await dbMysql.delete(schema.mysqlSettings).where(eq(schema.mysqlSettings.key, 'telegram_token'));
    await dbMysql.insert(schema.mysqlSettings).values({ key: 'telegram_token', value: token });
    await dbMysql.delete(schema.mysqlSettings).where(eq(schema.mysqlSettings.key, 'telegram_chat_id'));
    await dbMysql.insert(schema.mysqlSettings).values({ key: 'telegram_chat_id', value: chatId });
    return;
  }
  if (!dbSqliteRaw) throw new Error('[DB] SQLite not initialized');
  dbSqliteRaw.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run('telegram_token', token);
  dbSqliteRaw.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run('telegram_chat_id', chatId);
}
