import { drizzle as drizzleSqlite, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { drizzle as drizzleMysql, MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import { eq, desc } from 'drizzle-orm';
import * as schema from './schema.js';
import { DBProduct, DBPriceHistory, DBSettings } from './schema.js';

const DATABASE_TYPE = process.env.DATABASE_TYPE || 'sqlite';
const DATABASE_URL = process.env.DATABASE_URL || 'lazada_tracker.db';

let dbSqlite: any = null;
let dbPg: any = null;
let dbMysql: any = null;

let rawSqliteClient: any = null;
let rawPgClient: any = null;
let rawMysqlClient: any = null;

// Initialize Database connection and auto-create tables
export async function initDb(): Promise<void> {
  console.log(`[DB] Initializing database of type: ${DATABASE_TYPE}`);

  if (DATABASE_TYPE === 'postgres' || DATABASE_TYPE === 'postgresql') {
    // Use Pool (not Client) to safely serve concurrent API requests
    const { Pool } = pg;
    const client = new Pool({
      connectionString: DATABASE_URL,
    });
    rawPgClient = client;

    // Create tables via Raw SQL (Idempotent and highly compatible)
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        initial_price DOUBLE PRECISION NOT NULL,
        current_price DOUBLE PRECISION NOT NULL,
        target_price DOUBLE PRECISION,
        last_checked TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    dbPg = drizzlePg(client);
    console.log('[DB] PostgreSQL initialized successfully.');

  } else if (DATABASE_TYPE === 'mysql') {
    const connection = await mysql.createConnection(DATABASE_URL);
    rawMysqlClient = connection;

    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        url VARCHAR(2048) NOT NULL,
        title VARCHAR(1024) NOT NULL,
        image_url VARCHAR(2048) NOT NULL,
        initial_price DOUBLE NOT NULL,
        current_price DOUBLE NOT NULL,
        target_price DOUBLE,
        last_checked VARCHAR(64) NOT NULL,
        status VARCHAR(64) NOT NULL,
        created_at VARCHAR(64) NOT NULL
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        price DOUBLE NOT NULL,
        timestamp VARCHAR(64) NOT NULL
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(255) PRIMARY KEY,
        \`value\` TEXT NOT NULL
      );
    `);

    dbMysql = drizzleMysql(connection);
    console.log('[DB] MySQL initialized successfully.');

  } else {
    // Default: SQLite (suitable for local use and Android Termux)
    const sqliteClient = new Database(DATABASE_URL);
    rawSqliteClient = sqliteClient;

    sqliteClient.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        initial_price REAL NOT NULL,
        current_price REAL NOT NULL,
        target_price REAL,
        last_checked TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        price REAL NOT NULL,
        timestamp TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    dbSqlite = drizzleSqlite(sqliteClient);
    console.log(`[DB] SQLite initialized successfully. Database file: ${DATABASE_URL}`);
  }

  // Graceful shutdown: close all open DB connections before the process exits.
  // Prevents "connection leaked" warnings from Postgres/MySQL servers.
  const shutdown = async () => {
    console.log('[DB] Closing database connections...');
    if (rawPgClient) { try { await rawPgClient.end(); } catch (_) {} }
    if (rawMysqlClient) { try { await rawMysqlClient.end(); } catch (_) {} }
    if (rawSqliteClient) { try { rawSqliteClient.close(); } catch (_) {} }
    console.log('[DB] All connections closed.');
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

// Ensure connection is initialized
function getDbInstance() {
  if (DATABASE_TYPE === 'postgres' || DATABASE_TYPE === 'postgresql') {
    if (!dbPg) throw new Error('[DB] Postgres is not initialized. Call initDb() first.');
    return { db: dbPg, type: 'postgres' };
  } else if (DATABASE_TYPE === 'mysql') {
    if (!dbMysql) throw new Error('[DB] MySQL is not initialized. Call initDb() first.');
    return { db: dbMysql, type: 'mysql' };
  } else {
    if (!dbSqlite) throw new Error('[DB] SQLite is not initialized. Call initDb() first.');
    return { db: dbSqlite, type: 'sqlite' };
  }
}

// Repository Operations

export async function getProducts(): Promise<DBProduct[]> {
  const { db, type } = getDbInstance();
  if (type === 'postgres') {
    return await db.select().from(schema.pgProducts);
  } else if (type === 'mysql') {
    return await db.select().from(schema.mysqlProducts);
  } else {
    return await db.select().from(schema.sqliteProducts);
  }
}

export async function addProduct(product: {
  url: string;
  title: string;
  imageUrl: string;
  initialPrice: number;
  currentPrice: number;
  targetPrice?: number | null;
}): Promise<DBProduct> {
  const { db, type } = getDbInstance();
  const timestamp = new Date().toISOString();
  
  const insertData = {
    url: product.url,
    title: product.title,
    imageUrl: product.imageUrl,
    initialPrice: product.initialPrice,
    currentPrice: product.initialPrice,
    targetPrice: product.targetPrice || null,
    lastChecked: timestamp,
    status: 'active',
    createdAt: timestamp,
  };

  if (type === 'postgres') {
    const result = await db.insert(schema.pgProducts).values(insertData).returning();
    const newProduct = result[0];
    await addPriceHistory(newProduct.id, product.initialPrice, timestamp);
    return newProduct;
  } else if (type === 'mysql') {
    const result = await db.insert(schema.mysqlProducts).values(insertData);
    const insertId = result[0].insertId;
    await addPriceHistory(insertId, product.initialPrice, timestamp);
    const products = await db.select().from(schema.mysqlProducts).where(eq(schema.mysqlProducts.id, insertId));
    return products[0];
  } else {
    const result = await db.insert(schema.sqliteProducts).values(insertData).returning();
    const newProduct = result[0];
    await addPriceHistory(newProduct.id, product.initialPrice, timestamp);
    return newProduct;
  }
}

export async function deleteProduct(id: number): Promise<void> {
  const { db, type } = getDbInstance();
  if (type === 'postgres') {
    await db.delete(schema.pgPriceHistory).where(eq(schema.pgPriceHistory.productId, id));
    await db.delete(schema.pgProducts).where(eq(schema.pgProducts.id, id));
  } else if (type === 'mysql') {
    await db.delete(schema.mysqlPriceHistory).where(eq(schema.mysqlPriceHistory.productId, id));
    await db.delete(schema.mysqlProducts).where(eq(schema.mysqlProducts.id, id));
  } else {
    await db.delete(schema.sqlitePriceHistory).where(eq(schema.sqlitePriceHistory.productId, id));
    await db.delete(schema.sqliteProducts).where(eq(schema.sqliteProducts.id, id));
  }
}

export async function addPriceHistory(productId: number, price: number, timestamp: string): Promise<void> {
  const { db, type } = getDbInstance();
  const data = { productId, price, timestamp };

  if (type === 'postgres') {
    await db.insert(schema.pgPriceHistory).values(data);
  } else if (type === 'mysql') {
    await db.insert(schema.mysqlPriceHistory).values(data);
  } else {
    await db.insert(schema.sqlitePriceHistory).values(data);
  }
}

export async function getPriceHistory(productId: number): Promise<DBPriceHistory[]> {
  const { db, type } = getDbInstance();
  if (type === 'postgres') {
    return await db.select().from(schema.pgPriceHistory).where(eq(schema.pgPriceHistory.productId, productId));
  } else if (type === 'mysql') {
    return await db.select().from(schema.mysqlPriceHistory).where(eq(schema.mysqlPriceHistory.productId, productId));
  } else {
    return await db.select().from(schema.sqlitePriceHistory).where(eq(schema.sqlitePriceHistory.productId, productId));
  }
}

export async function updateProductPrice(
  id: number,
  newPrice: number,
  status: string,
  lastChecked: string
): Promise<{ priceDropped: boolean; dropAmount: number; currentPrice: number; prevPrice: number }> {
  const { db, type } = getDbInstance();
  
  let currentProduct: DBProduct | undefined;
  if (type === 'postgres') {
    const result = await db.select().from(schema.pgProducts).where(eq(schema.pgProducts.id, id));
    currentProduct = result[0];
  } else if (type === 'mysql') {
    const result = await db.select().from(schema.mysqlProducts).where(eq(schema.mysqlProducts.id, id));
    currentProduct = result[0];
  } else {
    const result = await db.select().from(schema.sqliteProducts).where(eq(schema.sqliteProducts.id, id));
    currentProduct = result[0];
  }

  if (!currentProduct) {
    throw new Error(`Product with ID ${id} not found`);
  }

  const prevPrice = currentProduct.currentPrice;
  const priceDropped = newPrice < prevPrice;
  const dropAmount = prevPrice - newPrice;

  const updateData = {
    currentPrice: newPrice,
    status,
    lastChecked,
  };

  if (type === 'postgres') {
    await db.update(schema.pgProducts).set(updateData).where(eq(schema.pgProducts.id, id));
  } else if (type === 'mysql') {
    await db.update(schema.mysqlProducts).set(updateData).where(eq(schema.mysqlProducts.id, id));
  } else {
    await db.update(schema.sqliteProducts).set(updateData).where(eq(schema.sqliteProducts.id, id));
  }

  // Only record history if price actually changed to avoid database bloat
  if (newPrice !== prevPrice) {
    await addPriceHistory(id, newPrice, lastChecked);
  }

  return {
    priceDropped,
    dropAmount: priceDropped ? dropAmount : 0,
    currentPrice: newPrice,
    prevPrice,
  };
}

export async function updateProductTargetPrice(id: number, targetPrice: number | null): Promise<void> {
  const { db, type } = getDbInstance();
  const updateData = { targetPrice };

  if (type === 'postgres') {
    await db.update(schema.pgProducts).set(updateData).where(eq(schema.pgProducts.id, id));
  } else if (type === 'mysql') {
    await db.update(schema.mysqlProducts).set(updateData).where(eq(schema.mysqlProducts.id, id));
  } else {
    await db.update(schema.sqliteProducts).set(updateData).where(eq(schema.sqliteProducts.id, id));
  }
}

// Telegram and Global Settings

export async function getTelegramSettings(): Promise<{ token?: string; chatId?: string }> {
  const { db, type } = getDbInstance();
  let settings: DBSettings[] = [];

  if (type === 'postgres') {
    settings = await db.select().from(schema.pgSettings);
  } else if (type === 'mysql') {
    settings = await db.select().from(schema.mysqlSettings);
  } else {
    settings = await db.select().from(schema.sqliteSettings);
  }

  const token = settings.find(s => s.key === 'telegram_token')?.value;
  const chatId = settings.find(s => s.key === 'telegram_chat_id')?.value;

  return { token, chatId };
}

export async function saveTelegramSettings(token: string, chatId: string): Promise<void> {
  const { db, type } = getDbInstance();

  const tokenData = { key: 'telegram_token', value: token };
  const chatIdData = { key: 'telegram_chat_id', value: chatId };

  if (type === 'postgres') {
    await db.insert(schema.pgSettings).values(tokenData).onConflictDoUpdate({ target: schema.pgSettings.key, set: { value: token } });
    await db.insert(schema.pgSettings).values(chatIdData).onConflictDoUpdate({ target: schema.pgSettings.key, set: { value: chatId } });
  } else if (type === 'mysql') {
    // MySQL uses ON DUPLICATE KEY UPDATE in raw, or standard insert if not exist followed by update, or upsert.
    // Drizzle doesn't have uniform cross-DB upsert syntax, so we can do delete + insert or handle separately.
    await db.delete(schema.mysqlSettings).where(eq(schema.mysqlSettings.key, 'telegram_token'));
    await db.insert(schema.mysqlSettings).values(tokenData);
    await db.delete(schema.mysqlSettings).where(eq(schema.mysqlSettings.key, 'telegram_chat_id'));
    await db.insert(schema.mysqlSettings).values(chatIdData);
  } else {
    await db.insert(schema.sqliteSettings).values(tokenData).onConflictDoUpdate({ target: schema.sqliteSettings.key, set: { value: token } });
    await db.insert(schema.sqliteSettings).values(chatIdData).onConflictDoUpdate({ target: schema.sqliteSettings.key, set: { value: chatId } });
  }
}
