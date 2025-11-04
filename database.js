const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('flour_mill.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    product_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    production_stage TEXT DEFAULT 'CREATED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS production_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    plan_name TEXT NOT NULL,
    plan_status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS plan_source_blend (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    source_bin_id INTEGER NOT NULL,
    blend_percentage REAL NOT NULL,
    blend_quantity REAL NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES production_plans(id)
  );

  CREATE TABLE IF NOT EXISTS plan_destination_distribution (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    destination_bin_id INTEGER NOT NULL,
    distribution_quantity REAL NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES production_plans(id)
  );

  CREATE TABLE IF NOT EXISTS bins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bin_name TEXT NOT NULL,
    bin_type TEXT NOT NULL,
    capacity REAL NOT NULL,
    current_quantity REAL DEFAULT 0
  );
`);

const initBins = db.prepare(`
  INSERT OR IGNORE INTO bins (id, bin_name, bin_type, capacity)
  VALUES (?, ?, ?, ?)
`);

const binCheck = db.prepare('SELECT COUNT(*) as count FROM bins').get();
if (binCheck.count === 0) {
  initBins.run(1, 'Pre-Clean Bin 1', 'PRE_CLEAN', 500);
  initBins.run(2, 'Pre-Clean Bin 2', 'PRE_CLEAN', 500);
  initBins.run(3, 'Pre-Clean Bin 3', 'PRE_CLEAN', 500);
  initBins.run(4, '24HR Bin 1', '24HR', 300);
  initBins.run(5, '24HR Bin 2', '24HR', 300);
  initBins.run(6, '24HR Bin 3', '24HR', 300);
}

console.log('Database initialized successfully');

module.exports = db;
