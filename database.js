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
    description TEXT,
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

  CREATE TABLE IF NOT EXISTS finished_goods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT UNIQUE NOT NULL,
    initial_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS raw_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT UNIQUE NOT NULL,
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

  CREATE TABLE IF NOT EXISTS destination_bin_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    destination_bin_id INTEGER NOT NULL,
    status TEXT DEFAULT 'READY',
    target_quantity REAL NOT NULL,
    transferred_quantity REAL DEFAULT 0,
    started_at DATETIME,
    completed_at DATETIME,
    transfer_in_at DATETIME,
    transfer_out_at DATETIME,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (plan_id) REFERENCES production_plans(id),
    FOREIGN KEY (destination_bin_id) REFERENCES bins(id)
  );

  CREATE TABLE IF NOT EXISTS sequential_transfer_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    source_bin_id INTEGER NOT NULL,
    transfer_quantity REAL NOT NULL,
    status TEXT DEFAULT 'READY',
    started_at DATETIME,
    stopped_at DATETIME,
    outgoing_moisture REAL,
    water_added REAL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (source_bin_id) REFERENCES bins(id)
  );

  CREATE TABLE IF NOT EXISTS sequential_transfer_bins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sequential_job_id INTEGER NOT NULL,
    destination_bin_id INTEGER NOT NULL,
    sequence_order INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING',
    quantity_transferred REAL DEFAULT 0,
    FOREIGN KEY (sequential_job_id) REFERENCES sequential_transfer_jobs(id),
    FOREIGN KEY (destination_bin_id) REFERENCES bins(id)
  );

  CREATE TABLE IF NOT EXISTS grinding_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    grinding_status TEXT DEFAULT 'READY',
    grinding_start_time DATETIME,
    grinding_end_time DATETIME,
    grinding_duration_hours REAL,
    machine_id TEXT DEFAULT 'GRINDING-001',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS grinding_source_bins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grinding_job_id INTEGER NOT NULL,
    bin_id INTEGER NOT NULL,
    bin_sequence_order INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING',
    outgoing_moisture REAL,
    water_added REAL,
    transfer_in_at DATETIME,
    transfer_out_at DATETIME,
    FOREIGN KEY (grinding_job_id) REFERENCES grinding_jobs(id),
    FOREIGN KEY (bin_id) REFERENCES bins(id)
  );

  CREATE TABLE IF NOT EXISTS hourly_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grinding_job_id INTEGER NOT NULL,
    report_number INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    maida_tons REAL DEFAULT 0,
    suji_tons REAL DEFAULT 0,
    chakki_ata_tons REAL DEFAULT 0,
    tandoori_tons REAL DEFAULT 0,
    main_total_tons REAL DEFAULT 0,
    bran_tons REAL DEFAULT 0,
    grand_total_tons REAL DEFAULT 0,
    maida_percent REAL DEFAULT 0,
    suji_percent REAL DEFAULT 0,
    chakki_ata_percent REAL DEFAULT 0,
    tandoori_percent REAL DEFAULT 0,
    main_total_percent REAL DEFAULT 0,
    bran_percent REAL DEFAULT 0,
    submitted_at DATETIME,
    FOREIGN KEY (grinding_job_id) REFERENCES grinding_jobs(id)
  );

  CREATE TABLE IF NOT EXISTS grinding_lab_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grinding_job_id INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    product_type TEXT NOT NULL,
    moisture REAL NOT NULL,
    status TEXT DEFAULT 'SUBMITTED',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grinding_job_id) REFERENCES grinding_jobs(id)
  );

  CREATE TABLE IF NOT EXISTS finished_goods_godowns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    godown_name TEXT UNIQUE NOT NULL,
    godown_code TEXT UNIQUE NOT NULL,
    capacity REAL NOT NULL,
    current_quantity REAL DEFAULT 0,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS maida_shallows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shallow_name TEXT UNIQUE NOT NULL,
    shallow_code TEXT UNIQUE NOT NULL,
    capacity REAL NOT NULL,
    current_quantity REAL DEFAULT 0,
    product_type TEXT DEFAULT 'MAIDA',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS packaging_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grinding_job_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    product_type TEXT NOT NULL,
    shallow_id INTEGER,
    bag_size_kg REAL NOT NULL,
    number_of_bags INTEGER NOT NULL,
    total_kg_packed REAL NOT NULL,
    godown_id INTEGER NOT NULL,
    status TEXT DEFAULT 'PACKED',
    packed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grinding_job_id) REFERENCES grinding_jobs(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (shallow_id) REFERENCES maida_shallows(id),
    FOREIGN KEY (godown_id) REFERENCES finished_goods_godowns(id)
  );

  CREATE TABLE IF NOT EXISTS storage_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_id INTEGER,
    destination_type TEXT NOT NULL,
    destination_id INTEGER NOT NULL,
    product_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    transfer_date DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add identity_number to bins if it doesn't exist
try {
  db.exec(`ALTER TABLE bins ADD COLUMN identity_number TEXT`);
} catch (e) {
  // Column already exists
}

// Migration: Rename products table to finished_goods if it exists
try {
  const productsTableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='products'
  `).get();
  
  if (productsTableExists) {
    // Check if products table has any rows
    const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
    
    if (productCount && productCount.count > 0) {
      // Clear seeded data from finished_goods first (to avoid ID conflicts)
      db.exec(`DELETE FROM finished_goods`);
      
      // Migrate existing products data to finished_goods
      db.exec(`
        INSERT OR REPLACE INTO finished_goods (id, product_name, initial_name, created_at)
        SELECT id, product_name, initial_name, created_at FROM products;
      `);
      
      console.log(`Migrated ${productCount.count} products to finished_goods successfully`);
    }
    
    // Drop the old products table
    db.exec(`DROP TABLE products`);
  }
} catch (e) {
  // Migration already done or table doesn't exist
  console.log('Products migration skipped:', e.message);
}

// Migration: Add new columns to transfer tables if they don't exist
try {
  db.exec(`ALTER TABLE destination_bin_transfers ADD COLUMN transfer_in_at DATETIME`);
  db.exec(`ALTER TABLE destination_bin_transfers ADD COLUMN transfer_out_at DATETIME`);
} catch (e) {
  // Columns already exist
}

try {
  db.exec(`ALTER TABLE sequential_transfer_jobs ADD COLUMN outgoing_moisture REAL`);
  db.exec(`ALTER TABLE sequential_transfer_jobs ADD COLUMN water_added REAL`);
} catch (e) {
  // Columns already exist
}

try {
  db.exec(`ALTER TABLE grinding_source_bins ADD COLUMN outgoing_moisture REAL`);
  db.exec(`ALTER TABLE grinding_source_bins ADD COLUMN water_added REAL`);
  db.exec(`ALTER TABLE grinding_source_bins ADD COLUMN transfer_in_at DATETIME`);
  db.exec(`ALTER TABLE grinding_source_bins ADD COLUMN transfer_out_at DATETIME`);
} catch (e) {
  // Columns already exist
}

try {
  db.exec(`ALTER TABLE sequential_transfer_bins ADD COLUMN transfer_in_at DATETIME`);
  db.exec(`ALTER TABLE sequential_transfer_bins ADD COLUMN transfer_out_at DATETIME`);
} catch (e) {
  // Columns already exist
}

// Migration: Rename plan_name to description in production_plans
try {
  const planNameExists = db.prepare(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='production_plans'
  `).get();
  
  if (planNameExists && planNameExists.sql.includes('plan_name')) {
    // Create new table with description, copy data, drop old table
    db.exec(`
      CREATE TABLE production_plans_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        description TEXT,
        plan_status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      );
      
      INSERT INTO production_plans_new (id, order_id, description, plan_status, created_at)
      SELECT id, order_id, plan_name, plan_status, created_at FROM production_plans;
      
      DROP TABLE production_plans;
      ALTER TABLE production_plans_new RENAME TO production_plans;
    `);
    console.log('Migrated production_plans.plan_name to description successfully');
  }
} catch (e) {
  // Migration already done or table doesn't exist
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

const initFinishedGoods = db.prepare(`
  INSERT OR IGNORE INTO finished_goods (product_name, initial_name)
  VALUES (?, ?)
`);

const finishedGoodsCheck = db.prepare('SELECT COUNT(*) as count FROM finished_goods').get();
if (finishedGoodsCheck.count === 0) {
  initFinishedGoods.run('Wheat Flour', 'WF');
  initFinishedGoods.run('Maida', 'MD');
  initFinishedGoods.run('Suji', 'SJ');
  initFinishedGoods.run('Atta', 'AT');
}

const initRawProducts = db.prepare(`
  INSERT OR IGNORE INTO raw_products (product_name)
  VALUES (?)
`);

const rawProductsCheck = db.prepare('SELECT COUNT(*) as count FROM raw_products').get();
if (rawProductsCheck.count === 0) {
  initRawProducts.run('Maida');
  initRawProducts.run('Suji');
  initRawProducts.run('Chakki Ata');
  initRawProducts.run('Tandoori');
  initRawProducts.run('Bran');
}

const initGodowns = db.prepare(`
  INSERT OR IGNORE INTO finished_goods_godowns (id, godown_name, godown_code, capacity, location)
  VALUES (?, ?, ?, ?, ?)
`);

const godownCheck = db.prepare('SELECT COUNT(*) as count FROM finished_goods_godowns').get();
if (godownCheck.count === 0) {
  initGodowns.run(1, 'FG Godown 1', 'FGG-01', 5000, 'Warehouse A');
  initGodowns.run(2, 'FG Godown 2', 'FGG-02', 5000, 'Warehouse B');
  initGodowns.run(3, 'FG Godown 3', 'FGG-03', 5000, 'Warehouse C');
}

const initShallows = db.prepare(`
  INSERT OR IGNORE INTO maida_shallows (id, shallow_name, shallow_code, capacity)
  VALUES (?, ?, ?, ?)
`);

const shallowCheck = db.prepare('SELECT COUNT(*) as count FROM maida_shallows').get();
if (shallowCheck.count === 0) {
  initShallows.run(1, 'Shallow 1', 'SH-01', 200);
  initShallows.run(2, 'Shallow 2', 'SH-02', 200);
  initShallows.run(3, 'Shallow 3', 'SH-03', 200);
}

console.log('Database initialized successfully');

module.exports = db;
