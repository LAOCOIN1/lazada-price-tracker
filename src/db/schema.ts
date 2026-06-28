import { sqliteTable, text as sqliteText, integer as sqliteInteger, real as sqliteReal } from 'drizzle-orm/sqlite-core';
import { pgTable, serial as pgSerial, text as pgText, doublePrecision as pgDouble, integer as pgInteger } from 'drizzle-orm/pg-core';
import { mysqlTable, int as mysqlInt, varchar as mysqlVarchar, double as mysqlDouble } from 'drizzle-orm/mysql-core';

// ==========================================
// 1. SQLite Schema (Default)
// ==========================================
export const sqliteProducts = sqliteTable('products', {
  id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
  url: sqliteText('url').notNull(),
  title: sqliteText('title').notNull(),
  imageUrl: sqliteText('image_url').notNull(),
  initialPrice: sqliteReal('initial_price').notNull(),
  currentPrice: sqliteReal('current_price').notNull(),
  targetPrice: sqliteReal('target_price'),
  lastChecked: sqliteText('last_checked').notNull(),
  status: sqliteText('status').notNull(),
  createdAt: sqliteText('created_at').notNull(),
});

export const sqlitePriceHistory = sqliteTable('price_history', {
  id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
  productId: sqliteInteger('product_id').notNull(),
  price: sqliteReal('price').notNull(),
  timestamp: sqliteText('timestamp').notNull(),
});

export const sqliteSettings = sqliteTable('settings', {
  key: sqliteText('key').primaryKey(),
  value: sqliteText('value').notNull(),
});

// ==========================================
// 2. PostgreSQL Schema
// ==========================================
export const pgProducts = pgTable('products', {
  id: pgSerial('id').primaryKey(),
  url: pgText('url').notNull(),
  title: pgText('title').notNull(),
  imageUrl: pgText('image_url').notNull(),
  initialPrice: pgDouble('initial_price').notNull(),
  currentPrice: pgDouble('current_price').notNull(),
  targetPrice: pgDouble('target_price'),
  lastChecked: pgText('last_checked').notNull(),
  status: pgText('status').notNull(),
  createdAt: pgText('created_at').notNull(),
});

export const pgPriceHistory = pgTable('price_history', {
  id: pgSerial('id').primaryKey(),
  productId: pgInteger('product_id').notNull(),
  price: pgDouble('price').notNull(),
  timestamp: pgText('timestamp').notNull(),
});

export const pgSettings = pgTable('settings', {
  key: pgText('key').primaryKey(),
  value: pgText('value').notNull(),
});

// ==========================================
// 3. MySQL Schema
// ==========================================
export const mysqlProducts = mysqlTable('products', {
  id: mysqlInt('id').primaryKey().autoincrement(),
  url: mysqlVarchar('url', { length: 2048 }).notNull(),
  title: mysqlVarchar('title', { length: 1024 }).notNull(),
  imageUrl: mysqlVarchar('image_url', { length: 2048 }).notNull(),
  initialPrice: mysqlDouble('initial_price').notNull(),
  currentPrice: mysqlDouble('current_price').notNull(),
  targetPrice: mysqlDouble('target_price'),
  lastChecked: mysqlVarchar('last_checked', { length: 64 }).notNull(),
  status: mysqlVarchar('status', { length: 64 }).notNull(),
  createdAt: mysqlVarchar('created_at', { length: 64 }).notNull(),
});

export const mysqlPriceHistory = mysqlTable('price_history', {
  id: mysqlInt('id').primaryKey().autoincrement(),
  productId: mysqlInt('product_id').notNull(),
  price: mysqlDouble('price').notNull(),
  timestamp: mysqlVarchar('timestamp', { length: 64 }).notNull(),
});

export const mysqlSettings = mysqlTable('settings', {
  key: mysqlVarchar('key', { length: 255 }).primaryKey(),
  value: mysqlVarchar('value', { length: 4096 }).notNull(),
});

// Common interfaces
export interface DBProduct {
  id: number;
  url: string;
  title: string;
  imageUrl: string;
  initialPrice: number;
  currentPrice: number;
  targetPrice: number | null;
  lastChecked: string;
  status: string;
  createdAt: string;
}

export interface DBPriceHistory {
  id: number;
  productId: number;
  price: number;
  timestamp: string;
}

export interface DBSettings {
  key: string;
  value: string;
}
