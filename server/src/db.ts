import Database from 'better-sqlite3'
import path from 'node:path'

const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd()
export const DB_PATH = path.join(DATA_DIR, 'data.sqlite')
export const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')

function hasColumn(table: string, column: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return cols.some((c) => c.name === column)
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patient (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      full_name TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      gender TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      notes TEXT NOT NULL,
      photo_data_url TEXT
    );

    CREATE TABLE IF NOT EXISTS exam_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_date TEXT NOT NULL,
      title TEXT NOT NULL,
      deadline TEXT NOT NULL,
      status TEXT NOT NULL,
      done INTEGER NOT NULL,
      done_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_exam_items_date ON exam_items(exam_date);
  `)

  // Backward-compatible migration from older schema
  if (!hasColumn('users', 'role')) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';`)
  }
  if (!hasColumn('exam_items', 'status')) {
    db.exec(`ALTER TABLE exam_items ADD COLUMN status TEXT NOT NULL DEFAULT 'todo';`)
    db.exec(`UPDATE exam_items SET status = CASE WHEN done = 1 THEN 'done' ELSE 'todo' END;`)
  }
  if (!hasColumn('exam_items', 'category')) {
    db.exec(`ALTER TABLE exam_items ADD COLUMN category TEXT NOT NULL DEFAULT '';`)
  }
  if (!hasColumn('exam_items', 'validity_days')) {
    db.exec(`ALTER TABLE exam_items ADD COLUMN validity_days INTEGER NOT NULL DEFAULT 0;`)
  }

  // Cleanup existing duplicates (keep the smallest id for each key).
  db.exec(`
    DELETE FROM exam_items
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM exam_items
      GROUP BY exam_date, title, category
    );
  `)

  // Prevent duplicates of the same checklist item on the same date.
  // (Allows same title on different dates; and same title in different categories.)
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_items_unique
    ON exam_items(exam_date, title, category);
  `)
}

