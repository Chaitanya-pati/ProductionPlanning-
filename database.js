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
    current_quantity REAL DEFAULT 0,
    identity_number TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT UNIQUE NOT NULL,
    initial_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transfer_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    plan_id INTEGER,
    transfer_type TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    total_quantity REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (plan_id) REFERENCES production_plans(id)
  );

  CREATE TABLE IF NOT EXISTS transfer_blend_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_job_id INTEGER NOT NULL,
    destination_bin_id INTEGER NOT NULL,
    source_bin_id INTEGER NOT NULL,
    source_contribution_percentage REAL NOT NULL,
    source_contribution_tons REAL NOT NULL,
    FOREIGN KEY (transfer_job_id) REFERENCES transfer_jobs(id),
    FOREIGN KEY (destination_bin_id) REFERENCES bins(id),
    FOREIGN KEY (source_bin_id) REFERENCES bins(id)
  );

  CREATE TABLE IF NOT EXISTS transfer_sequence_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_job_id INTEGER NOT NULL,
    source_bin_id INTEGER NOT NULL,
    sequence_order INTEGER NOT NULL,
    destination_bin_id INTEGER NOT NULL,
    destination_bin_sequence INTEGER NOT NULL,
    quantity_transferred REAL NOT NULL,
    FOREIGN KEY (transfer_job_id) REFERENCES transfer_jobs(id),
    FOREIGN KEY (source_bin_id) REFERENCES bins(id),
    FOREIGN KEY (destination_bin_id) REFERENCES bins(id)
  );
`);

try {
  db.exec(`ALTER TABLE bins ADD COLUMN identity_number TEXT`);
} catch (e) {
}

const initBins = db.prepare(`
  INSERT OR IGNORE INTO bins (id, bin_name, bin_type, capacity, identity_number)
  VALUES (?, ?, ?, ?, ?)
`);

const binCheck = db.prepare('SELECT COUNT(*) as count FROM bins').get();
if (binCheck.count === 0) {
  initBins.run(1, 'Pre-Clean Bin 1', 'PRE_CLEAN', 500, 'PC-01');
  initBins.run(2, 'Pre-Clean Bin 2', 'PRE_CLEAN', 500, 'PC-02');
  initBins.run(3, 'Pre-Clean Bin 3', 'PRE_CLEAN', 500, 'PC-03');
  initBins.run(4, '24HR Bin 1', '24HR', 300, '24HR-01');
  initBins.run(5, '24HR Bin 2', '24HR', 300, '24HR-02');
  initBins.run(6, '24HR Bin 3', '24HR', 300, '24HR-03');
  initBins.run(301, '12HR Bin 301', '12HR', 25, '12HR-301');
  initBins.run(302, '12HR Bin 302', '12HR', 25, '12HR-302');
  initBins.run(303, '12HR Bin 303', '12HR', 25, '12HR-303');
  initBins.run(304, '12HR Bin 304', '12HR', 25, '12HR-304');
}

const initProducts = db.prepare(`
  INSERT OR IGNORE INTO products (product_name, initial_name)
  VALUES (?, ?)
`);

const productCheck = db.prepare('SELECT COUNT(*) as count FROM products').get();
if (productCheck.count === 0) {
  initProducts.run('Wheat Flour', 'WF');
  initProducts.run('Maida', 'MD');
  initProducts.run('Suji', 'SJ');
  initProducts.run('Atta', 'AT');
}

console.log('Database initialized successfully');

module.exports = db;
