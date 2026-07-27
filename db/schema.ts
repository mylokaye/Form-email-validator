import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const feedSources = sqliteTable('feed_sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  homepageUrl: text('homepage_url').notNull(),
  feedUrl: text('feed_url').notNull(),
  isActive: integer('is_active').notNull().default(1),
  lastCheckedAt: integer('last_checked_at'),
  lastError: text('last_error'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('feed_sources_feed_url_unique').on(table.feedUrl),
  index('feed_sources_last_checked_at_idx').on(table.lastCheckedAt),
]);

export const feedItems = sqliteTable('feed_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => feedSources.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  summary: text('summary'),
  publishedAt: integer('published_at').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('feed_items_source_external_unique').on(table.sourceId, table.externalId),
  index('feed_items_published_at_idx').on(table.publishedAt),
]);
