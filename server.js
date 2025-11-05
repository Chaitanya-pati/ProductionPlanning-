const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/api/orders', (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const { product_type, quantity } = req.body;
    
    if (!product_type || !quantity) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Get finished good initial
    const product = db.prepare('SELECT initial_name FROM finished_goods WHERE product_name = ?').get(product_type);
    if (!product) {
      return res.status(400).json({ success: false, error: 'Finished good not found' });
    }

    // Generate order number: {INITIAL}-{YEAR}-{SEQUENCE}
    const currentYear = new Date().getFullYear();
    const prefix = `${product.initial_name}-${currentYear}-`;
    
    // Get the last order number with this prefix
    const lastOrder = db.prepare(`
      SELECT order_number FROM orders 
      WHERE order_number LIKE ? 
      ORDER BY id DESC LIMIT 1
    `).get(`${prefix}%`);
    
    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.order_number.split('-').pop());
      sequence = lastSequence + 1;
    }
    
    const order_number = `${prefix}${sequence.toString().padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO orders (order_number, product_type, quantity, production_stage)
      VALUES (?, ?, ?, 'CREATED')
    `);
    
    const result = stmt.run(order_number, product_type, quantity);
    
    res.json({ 
      success: true, 
      data: { id: result.lastInsertRowid, order_number, product_type, quantity, production_stage: 'CREATED' }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/orders/:id', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/bins', (req, res) => {
  try {
    const bins = db.prepare('SELECT * FROM bins').all();
    res.json({ success: true, data: bins });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/plans', (req, res) => {
  try {
    const { order_id, description, source_blend, destination_distribution } = req.body;
    
    if (!order_id || !source_blend || !destination_distribution) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const totalPercentage = source_blend.reduce((sum, item) => sum + parseFloat(item.percentage), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return res.status(400).json({ success: false, error: 'Source blend percentages must sum to 100%' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const totalDistribution = destination_distribution.reduce((sum, item) => sum + parseFloat(item.quantity), 0);
    if (Math.abs(totalDistribution - order.quantity) > 0.01) {
      return res.status(400).json({ 
        success: false, 
        error: `Destination quantities must sum to order total (${order.quantity} tons)` 
      });
    }

    const insertPlan = db.prepare(`
      INSERT INTO production_plans (order_id, description, plan_status)
      VALUES (?, ?, 'ACTIVE')
    `);
    const planResult = insertPlan.run(order_id, description || null);
    const planId = planResult.lastInsertRowid;

    const insertSourceBlend = db.prepare(`
      INSERT INTO plan_source_blend (plan_id, source_bin_id, blend_percentage, blend_quantity)
      VALUES (?, ?, ?, ?)
    `);
    
    source_blend.forEach(item => {
      const blendQuantity = (parseFloat(item.percentage) / 100) * order.quantity;
      insertSourceBlend.run(planId, item.bin_id, item.percentage, blendQuantity);
    });

    const insertDestination = db.prepare(`
      INSERT INTO plan_destination_distribution (plan_id, destination_bin_id, distribution_quantity)
      VALUES (?, ?, ?)
    `);
    
    destination_distribution.forEach(item => {
      insertDestination.run(planId, item.bin_id, item.quantity);
    });

    const updateOrder = db.prepare(`
      UPDATE orders SET production_stage = 'PLANNED' WHERE id = ?
    `);
    updateOrder.run(order_id);

    res.json({ 
      success: true, 
      data: { plan_id: planId, order_id, description, status: 'PLANNED' }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/plans/:order_id', (req, res) => {
  try {
    const plans = db.prepare(`
      SELECT 
        pp.*,
        json_group_array(
          json_object(
            'bin_id', psb.source_bin_id,
            'bin_name', b1.bin_name,
            'percentage', psb.blend_percentage,
            'quantity', psb.blend_quantity
          )
        ) as source_blend
      FROM production_plans pp
      LEFT JOIN plan_source_blend psb ON pp.id = psb.plan_id
      LEFT JOIN bins b1 ON psb.source_bin_id = b1.id
      WHERE pp.order_id = ?
      GROUP BY pp.id
    `).all(req.params.order_id);

    for (let plan of plans) {
      const destinations = db.prepare(`
        SELECT 
          pdd.destination_bin_id as bin_id,
          b.bin_name,
          pdd.distribution_quantity as quantity
        FROM plan_destination_distribution pdd
        JOIN bins b ON pdd.destination_bin_id = b.id
        WHERE pdd.plan_id = ?
      `).all(plan.id);
      
      plan.destination_distribution = destinations;
      plan.source_blend = JSON.parse(plan.source_blend);
    }

    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// FINISHED GOODS APIs
app.get('/api/finished-goods', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM finished_goods ORDER BY product_name').all();
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/finished-goods', (req, res) => {
  try {
    const { product_name, initial_name } = req.body;
    
    if (!product_name || !initial_name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO finished_goods (product_name, initial_name)
      VALUES (?, ?)
    `);
    
    const result = stmt.run(product_name, initial_name);
    
    res.json({ 
      success: true, 
      data: { id: result.lastInsertRowid, product_name, initial_name }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/finished-goods/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM finished_goods WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Finished good not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/finished-goods/:id', (req, res) => {
  try {
    const { product_name, initial_name } = req.body;
    
    if (!product_name || !initial_name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      UPDATE finished_goods 
      SET product_name = ?, initial_name = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(product_name, initial_name, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Finished good not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/finished-goods/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM finished_goods WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Finished good not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// RAW PRODUCTS APIs
app.get('/api/raw-products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM raw_products ORDER BY product_name').all();
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/raw-products', (req, res) => {
  try {
    const { product_name } = req.body;
    
    if (!product_name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO raw_products (product_name)
      VALUES (?)
    `);
    
    const result = stmt.run(product_name);
    
    res.json({ 
      success: true, 
      data: { id: result.lastInsertRowid, product_name }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/raw-products/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM raw_products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Raw product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/raw-products/:id', (req, res) => {
  try {
    const { product_name } = req.body;
    
    if (!product_name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      UPDATE raw_products 
      SET product_name = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(product_name, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Raw product not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/raw-products/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM raw_products WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Raw product not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Legacy endpoint for backward compatibility (maps to finished goods)
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM finished_goods ORDER BY product_name').all();
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/bins', (req, res) => {
  try {
    const { bin_name, bin_type, capacity, current_quantity, identity_number } = req.body;
    
    if (!bin_name || !bin_type || !capacity || !identity_number) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO bins (bin_name, bin_type, capacity, current_quantity, identity_number)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(bin_name, bin_type, capacity, current_quantity || 0, identity_number);
    
    res.json({ 
      success: true, 
      data: { id: result.lastInsertRowid, bin_name, bin_type, capacity, current_quantity: current_quantity || 0, identity_number }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/bins/:id', (req, res) => {
  try {
    const bin = db.prepare('SELECT * FROM bins WHERE id = ?').get(req.params.id);
    if (!bin) {
      return res.status(404).json({ success: false, error: 'Bin not found' });
    }
    res.json({ success: true, data: bin });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/bins/:id', (req, res) => {
  try {
    const { bin_name, bin_type, capacity, current_quantity, identity_number } = req.body;
    
    if (!bin_name || !bin_type || !capacity || !identity_number) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      UPDATE bins 
      SET bin_name = ?, bin_type = ?, capacity = ?, current_quantity = ?, identity_number = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(bin_name, bin_type, capacity, current_quantity || 0, identity_number, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Bin not found' });
    }
    
    res.json({ 
      success: true, 
      data: { id: req.params.id, bin_name, bin_type, capacity, current_quantity: current_quantity || 0, identity_number }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/bins/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM bins WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Bin not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/transfers/blended/start', (req, res) => {
  try {
    const { order_id, plan_id, destination_bin_id } = req.body;
    
    if (!order_id || !plan_id || !destination_bin_id) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const plan = db.prepare('SELECT * FROM production_plans WHERE id = ?').get(plan_id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const destDistribution = db.prepare(
      'SELECT * FROM plan_destination_distribution WHERE plan_id = ? AND destination_bin_id = ?'
    ).get(plan_id, destination_bin_id);
    
    if (!destDistribution) {
      return res.status(404).json({ success: false, error: 'Destination bin not found in plan' });
    }

    const existingTransfer = db.prepare(
      'SELECT * FROM destination_bin_transfers WHERE plan_id = ? AND destination_bin_id = ?'
    ).get(plan_id, destination_bin_id);

    if (existingTransfer && existingTransfer.status === 'IN_PROGRESS') {
      return res.status(400).json({ success: false, error: 'Transfer already in progress for this bin' });
    }

    if (existingTransfer && existingTransfer.status === 'COMPLETED') {
      return res.status(400).json({ success: false, error: 'Transfer already completed for this bin' });
    }

    if (existingTransfer) {
      const updateStmt = db.prepare(`
        UPDATE destination_bin_transfers 
        SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP, transfer_in_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateStmt.run(existingTransfer.id);
    } else {
      const insertStmt = db.prepare(`
        INSERT INTO destination_bin_transfers 
        (order_id, plan_id, destination_bin_id, status, target_quantity, started_at, transfer_in_at)
        VALUES (?, ?, ?, 'IN_PROGRESS', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      insertStmt.run(order_id, plan_id, destination_bin_id, destDistribution.distribution_quantity);
    }

    const allTransfers = db.prepare(
      'SELECT * FROM destination_bin_transfers WHERE plan_id = ?'
    ).all(plan_id);
    
    const hasInProgress = allTransfers.some(t => t.status === 'IN_PROGRESS');
    
    if (hasInProgress) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
      if (order && order.production_stage === 'PLANNED') {
        const updateOrderStatus = db.prepare(`
          UPDATE orders SET production_stage = 'TRANSFER_PRE_TO_24_IN_PROGRESS' WHERE id = ?
        `);
        updateOrderStatus.run(order_id);
      }
    }

    res.json({ 
      success: true, 
      data: { 
        status: 'IN_PROGRESS',
        destination_bin_id
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/transfers/blended/stop', (req, res) => {
  try {
    const { order_id, plan_id, destination_bin_id } = req.body;
    
    if (!order_id || !plan_id || !destination_bin_id) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const transfer = db.prepare(
      'SELECT * FROM destination_bin_transfers WHERE plan_id = ? AND destination_bin_id = ?'
    ).get(plan_id, destination_bin_id);

    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer not found' });
    }

    if (transfer.status !== 'IN_PROGRESS') {
      return res.status(400).json({ success: false, error: 'Transfer is not in progress' });
    }

    // Get source blend configuration
    const sourceBlends = db.prepare('SELECT * FROM plan_source_blend WHERE plan_id = ?').all(plan_id);
    const targetQuantity = transfer.target_quantity;

    const updateSourceBin = db.prepare('UPDATE bins SET current_quantity = current_quantity - ? WHERE id = ?');
    const updateDestBin = db.prepare('UPDATE bins SET current_quantity = current_quantity + ? WHERE id = ?');

    // BLENDED TRANSFER: Deduct from each source bin based on blend percentage
    // Example: For 24HR Bin1 (50t) with blend 30% Bin1 + 40% Bin2 + 30% Bin3:
    // - Deduct 30% × 50t = 15t from Pre-Clean Bin1
    // - Deduct 40% × 50t = 20t from Pre-Clean Bin2
    // - Deduct 30% × 50t = 15t from Pre-Clean Bin3
    // - Add combined 50t to 24HR Bin1
    sourceBlends.forEach(source => {
      const contribution = (source.blend_percentage / 100) * targetQuantity;
      updateSourceBin.run(contribution, source.source_bin_id);
    });
    
    // Add the full target quantity to destination bin (this is the combined blend)
    updateDestBin.run(targetQuantity, destination_bin_id);

    // Update transfer record with transfer_out_at timestamp
    const updateTransfer = db.prepare(`
      UPDATE destination_bin_transfers 
      SET status = 'COMPLETED', transferred_quantity = ?, completed_at = CURRENT_TIMESTAMP, transfer_out_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    updateTransfer.run(targetQuantity, transfer.id);

    // Check if all destination bins have completed their transfers
    const allTransfers = db.prepare(
      'SELECT * FROM destination_bin_transfers WHERE plan_id = ?'
    ).all(plan_id);
    
    const allCompleted = allTransfers.every(t => t.status === 'COMPLETED');
    
    if (allCompleted) {
      const updateOrderStatus = db.prepare(`
        UPDATE orders SET production_stage = 'TRANSFER_PRE_TO_24_COMPLETED' WHERE id = ?
      `);
      updateOrderStatus.run(order_id);
    }

    res.json({ 
      success: true, 
      data: { 
        status: 'COMPLETED',
        transferred_quantity: targetQuantity,
        all_transfers_completed: allCompleted
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/transfers/blended', (req, res) => {
  try {
    const { order_id, plan_id } = req.body;
    
    if (!order_id || !plan_id) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const plan = db.prepare('SELECT * FROM production_plans WHERE id = ?').get(plan_id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const sourceBlends = db.prepare('SELECT * FROM plan_source_blend WHERE plan_id = ?').all(plan_id);
    const destinationDistributions = db.prepare('SELECT * FROM plan_destination_distribution WHERE plan_id = ?').all(plan_id);

    const totalQuantity = destinationDistributions.reduce((sum, d) => sum + d.distribution_quantity, 0);

    const insertTransferJob = db.prepare(`
      INSERT INTO transfer_jobs (order_id, plan_id, transfer_type, status, total_quantity)
      VALUES (?, ?, 'BLENDED', 'IN_PROGRESS', ?)
    `);
    const transferJobResult = insertTransferJob.run(order_id, plan_id, totalQuantity);
    const transferJobId = transferJobResult.lastInsertRowid;

    const insertBlendDetail = db.prepare(`
      INSERT INTO transfer_blend_details 
      (transfer_job_id, destination_bin_id, source_bin_id, source_contribution_percentage, source_contribution_tons)
      VALUES (?, ?, ?, ?, ?)
    `);

    const updateSourceBin = db.prepare('UPDATE bins SET current_quantity = current_quantity - ? WHERE id = ?');
    const updateDestBin = db.prepare('UPDATE bins SET current_quantity = current_quantity + ? WHERE id = ?');

    destinationDistributions.forEach(dest => {
      sourceBlends.forEach(source => {
        const contribution = (source.blend_percentage / 100) * dest.distribution_quantity;
        
        insertBlendDetail.run(
          transferJobId,
          dest.destination_bin_id,
          source.source_bin_id,
          source.blend_percentage,
          contribution
        );

        updateSourceBin.run(contribution, source.source_bin_id);
      });
      
      updateDestBin.run(dest.distribution_quantity, dest.destination_bin_id);
    });

    const completeTransfer = db.prepare(`
      UPDATE transfer_jobs 
      SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    completeTransfer.run(transferJobId);

    const updateOrderStatus = db.prepare(`
      UPDATE orders SET production_stage = 'TRANSFER_PRE_TO_24_COMPLETED' WHERE id = ?
    `);
    updateOrderStatus.run(order_id);

    res.json({ 
      success: true, 
      data: { 
        transfer_job_id: transferJobId, 
        status: 'COMPLETED',
        total_quantity: totalQuantity
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// TIMELINE API
app.get('/api/timeline/:orderId', (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    // Get order
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    // Get plan
    const plans = db.prepare(`
      SELECT 
        pp.*,
        json_group_array(
          json_object(
            'bin_id', psb.source_bin_id,
            'bin_name', b1.bin_name,
            'percentage', psb.blend_percentage,
            'quantity', psb.blend_quantity
          )
        ) as source_blend
      FROM production_plans pp
      LEFT JOIN plan_source_blend psb ON pp.id = psb.plan_id
      LEFT JOIN bins b1 ON psb.source_bin_id = b1.id
      WHERE pp.order_id = ?
      GROUP BY pp.id
    `).all(orderId);
    
    let plan = null;
    if (plans.length > 0) {
      plan = plans[0];
      const destinations = db.prepare(`
        SELECT 
          pdd.destination_bin_id as bin_id,
          b.bin_name,
          pdd.distribution_quantity as quantity
        FROM plan_destination_distribution pdd
        JOIN bins b ON pdd.destination_bin_id = b.id
        WHERE pdd.plan_id = ?
      `).all(plan.id);
      
      plan.destination_distribution = destinations;
      plan.source_blend = JSON.parse(plan.source_blend);
    }
    
    // Get blended transfers
    let blended_transfers = null;
    if (plan) {
      const transfers = db.prepare(`
        SELECT 
          dbt.*,
          b.bin_name
        FROM destination_bin_transfers dbt
        JOIN bins b ON dbt.destination_bin_id = b.id
        WHERE dbt.plan_id = ?
        ORDER BY dbt.started_at
      `).all(plan.id);
      
      if (transfers.length > 0) {
        blended_transfers = transfers;
      }
    }
    
    // Get sequential transfer
    const sequentialTransfers = db.prepare(`
      SELECT * FROM transfer_jobs 
      WHERE order_id = ? AND transfer_type = 'SEQUENTIAL'
      ORDER BY created_at DESC
    `).all(orderId);
    
    let sequential_transfer = null;
    if (sequentialTransfers.length > 0) {
      sequential_transfer = sequentialTransfers[0];
      sequential_transfer.details = db.prepare(`
        SELECT 
          tsd.*,
          sb.bin_name as source_bin_name,
          db.bin_name as destination_bin_name
        FROM transfer_sequence_details tsd
        JOIN bins sb ON tsd.source_bin_id = sb.id
        JOIN bins db ON tsd.destination_bin_id = db.id
        WHERE tsd.transfer_job_id = ?
        ORDER BY tsd.sequence_order
      `).all(sequential_transfer.id);
    }
    
    // Get grinding
    const grindingJobs = db.prepare(`
      SELECT * FROM grinding_jobs WHERE order_id = ? ORDER BY created_at DESC
    `).all(orderId);
    
    let grinding = null;
    if (grindingJobs.length > 0) {
      grinding = grindingJobs[0];
      
      // Get hourly reports
      grinding.reports = db.prepare(`
        SELECT * FROM hourly_reports 
        WHERE grinding_job_id = ? AND status = 'SUBMITTED'
        ORDER BY report_number
      `).all(grinding.id);
      
      // Calculate summary
      if (grinding.reports.length > 0) {
        grinding.summary = {
          total_maida: grinding.reports.reduce((sum, r) => sum + r.maida_tons, 0),
          total_suji: grinding.reports.reduce((sum, r) => sum + r.suji_tons, 0),
          total_chakki: grinding.reports.reduce((sum, r) => sum + r.chakki_ata_tons, 0),
          total_tandoori: grinding.reports.reduce((sum, r) => sum + r.tandoori_tons, 0),
          total_bran: grinding.reports.reduce((sum, r) => sum + r.bran_tons, 0),
          grand_total: grinding.reports.reduce((sum, r) => sum + r.grand_total_tons, 0),
          avg_maida_percent: grinding.reports.reduce((sum, r) => sum + r.maida_percent, 0) / grinding.reports.length,
          avg_suji_percent: grinding.reports.reduce((sum, r) => sum + r.suji_percent, 0) / grinding.reports.length,
          avg_chakki_percent: grinding.reports.reduce((sum, r) => sum + r.chakki_ata_percent, 0) / grinding.reports.length,
          avg_tandoori_percent: grinding.reports.reduce((sum, r) => sum + r.tandoori_percent, 0) / grinding.reports.length,
          avg_bran_percent: grinding.reports.reduce((sum, r) => sum + r.bran_percent, 0) / grinding.reports.length
        };
      }
    }
    
    res.json({
      success: true,
      data: {
        order,
        plan,
        blended_transfers,
        sequential_transfer,
        grinding
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start sequential transfer (24→12 or similar) with timer
app.post('/api/transfers/sequential/start', (req, res) => {
  try {
    const { order_id, source_bin_id, transfer_quantity } = req.body;
    
    if (!order_id || !source_bin_id) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const sourceBin = db.prepare('SELECT * FROM bins WHERE id = ?').get(source_bin_id);
    if (!sourceBin) {
      return res.status(404).json({ success: false, error: 'Source bin not found' });
    }
    
    if (sourceBin.bin_type === '24HR') {
      const updateSourceBinTransfer = db.prepare(`
        UPDATE destination_bin_transfers 
        SET transfer_out_at = CURRENT_TIMESTAMP 
        WHERE destination_bin_id = ? AND transfer_out_at IS NULL
      `);
      updateSourceBinTransfer.run(source_bin_id);
    }

    // Create sequential transfer job with started_at timer
    const insertJob = db.prepare(`
      INSERT INTO sequential_transfer_jobs (order_id, source_bin_id, transfer_quantity, status, started_at)
      VALUES (?, ?, ?, 'IN_PROGRESS', CURRENT_TIMESTAMP)
    `);
    const result = insertJob.run(order_id, source_bin_id, transfer_quantity || sourceBin.current_quantity);
    
    res.json({ 
      success: true, 
      data: { 
        job_id: result.lastInsertRowid,
        status: 'IN_PROGRESS',
        started_at: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop sequential transfer with moisture tracking
app.post('/api/transfers/sequential/stop', (req, res) => {
  try {
    const { job_id, order_id, destination_sequence, outgoing_moisture, water_added } = req.body;
    
    if (!job_id || !order_id || !destination_sequence || !Array.isArray(destination_sequence)) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const job = db.prepare('SELECT * FROM sequential_transfer_jobs WHERE id = ?').get(job_id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Transfer job not found' });
    }

    if (job.status !== 'IN_PROGRESS') {
      return res.status(400).json({ success: false, error: 'Transfer is not in progress' });
    }

    const sourceBin = db.prepare('SELECT * FROM bins WHERE id = ?').get(job.source_bin_id);
    let remainingQuantity = job.transfer_quantity;
    let totalTransferred = 0;
    const distributionDetails = [];

    const insertDestinationBin = db.prepare(`
      INSERT INTO sequential_transfer_bins (sequential_job_id, destination_bin_id, sequence_order, status, quantity_transferred, transfer_in_at)
      VALUES (?, ?, ?, 'COMPLETED', ?, CURRENT_TIMESTAMP)
    `);

    const updateBin = db.prepare('UPDATE bins SET current_quantity = ? WHERE id = ?');

    destination_sequence.forEach((destBinId, index) => {
      const destBin = db.prepare('SELECT * FROM bins WHERE id = ?').get(destBinId);
      if (!destBin) {
        throw new Error(`Destination bin ${destBinId} not found`);
      }

      const availableSpace = destBin.capacity - destBin.current_quantity;
      const transferAmount = Math.min(remainingQuantity, availableSpace);

      if (transferAmount > 0) {
        insertDestinationBin.run(job_id, destBinId, index + 1, transferAmount);
        updateBin.run(destBin.current_quantity + transferAmount, destBinId);
        
        distributionDetails.push({
          bin_name: destBin.bin_name,
          transferred: transferAmount.toFixed(2)
        });
        
        remainingQuantity -= transferAmount;
        totalTransferred += transferAmount;
      }
    });

    // Update source bin quantity
    updateBin.run(sourceBin.current_quantity - totalTransferred, job.source_bin_id);

    // Update job with stopped_at, moisture, and water data
    const updateJob = db.prepare(`
      UPDATE sequential_transfer_jobs 
      SET status = 'COMPLETED', stopped_at = CURRENT_TIMESTAMP, outgoing_moisture = ?, water_added = ?
      WHERE id = ?
    `);
    updateJob.run(outgoing_moisture || null, water_added || null, job_id);

    // Update order status
    const updateOrder = db.prepare(`
      UPDATE orders SET production_stage = 'TRANSFER_24_TO_12_COMPLETED' WHERE id = ?
    `);
    updateOrder.run(order_id);

    res.json({ 
      success: true, 
      data: { 
        job_id,
        status: 'COMPLETED',
        total_transferred: totalTransferred,
        distribution_details: distributionDetails,
        outgoing_moisture,
        water_added
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Legacy sequential transfer endpoint (kept for backward compatibility)
app.post('/api/transfers/sequential', (req, res) => {
  try {
    const { order_id, source_bin_id, destination_sequence, transfer_quantity } = req.body;
    
    if (!order_id || !source_bin_id || !destination_sequence || !Array.isArray(destination_sequence)) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const sourceBin = db.prepare('SELECT * FROM bins WHERE id = ?').get(source_bin_id);
    if (!sourceBin) {
      return res.status(404).json({ success: false, error: 'Source bin not found' });
    }

    // Use custom quantity if provided, otherwise use full quantity from source bin
    let remainingQuantity = transfer_quantity ? parseFloat(transfer_quantity) : sourceBin.current_quantity;
    
    // Validate custom quantity
    if (transfer_quantity && remainingQuantity > sourceBin.current_quantity) {
      return res.status(400).json({ 
        success: false, 
        error: 'Transfer quantity (' + remainingQuantity + ' tons) exceeds available quantity (' + sourceBin.current_quantity + ' tons)'
      });
    }
    
    let totalTransferred = 0;
    const distributionDetails = [];

    const insertTransferJob = db.prepare(`
      INSERT INTO transfer_jobs (order_id, transfer_type, status, total_quantity)
      VALUES (?, 'SEQUENTIAL', 'IN_PROGRESS', 0)
    `);
    const transferJobResult = insertTransferJob.run(order_id);
    const transferJobId = transferJobResult.lastInsertRowid;

    const insertSequenceDetail = db.prepare(`
      INSERT INTO transfer_sequence_details 
      (transfer_job_id, source_bin_id, sequence_order, destination_bin_id, destination_bin_sequence, quantity_transferred)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateBin = db.prepare('UPDATE bins SET current_quantity = ? WHERE id = ?');

    destination_sequence.forEach((destBinId, index) => {
      const destBin = db.prepare('SELECT * FROM bins WHERE id = ?').get(destBinId);
      if (!destBin) {
        throw new Error(`Destination bin ${destBinId} not found`);
      }

      const availableSpace = destBin.capacity - destBin.current_quantity;
      const transferAmount = Math.min(remainingQuantity, availableSpace);

      if (transferAmount > 0) {
        insertSequenceDetail.run(
          transferJobId,
          source_bin_id,
          index + 1,
          destBinId,
          destBinId,
          transferAmount
        );

        updateBin.run(destBin.current_quantity + transferAmount, destBinId);
        
        distributionDetails.push({
          bin_name: destBin.bin_name,
          transferred: transferAmount.toFixed(2)
        });
        
        remainingQuantity -= transferAmount;
        totalTransferred += transferAmount;
      }
    });

    updateBin.run(sourceBin.current_quantity - totalTransferred, source_bin_id);

    const updateTransferJob = db.prepare(`
      UPDATE transfer_jobs 
      SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, total_quantity = ?
      WHERE id = ?
    `);
    updateTransferJob.run(totalTransferred, transferJobId);

    const updateOrderStatus = db.prepare(`
      UPDATE orders SET production_stage = 'TRANSFER_24_TO_12_COMPLETED' WHERE id = ?
    `);
    updateOrderStatus.run(order_id);

    res.json({ 
      success: true, 
      data: { 
        transfer_job_id: transferJobId, 
        status: 'COMPLETED',
        total_quantity: totalTransferred,
        remaining_in_source: remainingQuantity,
        distribution_details: distributionDetails
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sequential transfer jobs with timing and moisture data
app.get('/api/transfers/sequential/:orderId', (req, res) => {
  try {
    const jobs = db.prepare(`
      SELECT 
        stj.*,
        b.bin_name as source_bin_name,
        CASE 
          WHEN stj.started_at IS NOT NULL AND stj.stopped_at IS NOT NULL 
          THEN (julianday(stj.stopped_at) - julianday(stj.started_at)) * 24 * 60
          ELSE NULL
        END as duration_minutes
      FROM sequential_transfer_jobs stj
      JOIN bins b ON stj.source_bin_id = b.id
      WHERE stj.order_id = ?
      ORDER BY stj.started_at DESC
    `).all(req.params.orderId);

    for (let job of jobs) {
      job.destination_bins = db.prepare(`
        SELECT 
          stb.*,
          b.bin_name as destination_bin_name
        FROM sequential_transfer_bins stb
        JOIN bins b ON stb.destination_bin_id = b.id
        WHERE stb.sequential_job_id = ?
        ORDER BY stb.sequence_order
      `).all(job.id);
    }

    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get bin duration information for a specific bin
app.get('/api/bins/:binId/duration/:orderId', (req, res) => {
  try {
    const { binId, orderId } = req.params;
    
    // Check if it's a 24HR bin (from destination_bin_transfers)
    const transfer24hr = db.prepare(`
      SELECT 
        transfer_in_at,
        transfer_out_at,
        CASE 
          WHEN transfer_in_at IS NOT NULL AND transfer_out_at IS NOT NULL 
          THEN (julianday(transfer_out_at) - julianday(transfer_in_at)) * 24
          ELSE NULL
        END as duration_hours
      FROM destination_bin_transfers
      WHERE destination_bin_id = ? AND order_id = ?
      AND transfer_in_at IS NOT NULL
    `).get(binId, orderId);
    
    if (transfer24hr) {
      return res.json({ success: true, data: { ...transfer24hr, bin_type: '24HR' } });
    }
    
    // Check if it's a 12HR bin (from grinding_source_bins)
    const transfer12hr = db.prepare(`
      SELECT 
        gsb.transfer_in_at,
        gsb.transfer_out_at,
        gsb.outgoing_moisture,
        gsb.water_added,
        CASE 
          WHEN gsb.transfer_in_at IS NOT NULL AND gsb.transfer_out_at IS NOT NULL 
          THEN (julianday(gsb.transfer_out_at) - julianday(gsb.transfer_in_at)) * 24
          ELSE NULL
        END as duration_hours
      FROM grinding_source_bins gsb
      JOIN grinding_jobs gj ON gsb.grinding_job_id = gj.id
      WHERE gsb.bin_id = ? AND gj.order_id = ?
      AND gsb.transfer_in_at IS NOT NULL
    `).get(binId, orderId);
    
    if (transfer12hr) {
      return res.json({ success: true, data: { ...transfer12hr, bin_type: '12HR' } });
    }
    
    res.json({ success: false, error: 'No duration data found for this bin' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/transfers/:orderId', (req, res) => {
  try {
    const transfers = db.prepare(`
      SELECT * FROM transfer_jobs WHERE order_id = ? ORDER BY created_at DESC
    `).all(req.params.orderId);

    for (let transfer of transfers) {
      if (transfer.transfer_type === 'BLENDED') {
        transfer.details = db.prepare(`
          SELECT 
            tbd.*,
            sb.bin_name as source_bin_name,
            db.bin_name as destination_bin_name
          FROM transfer_blend_details tbd
          JOIN bins sb ON tbd.source_bin_id = sb.id
          JOIN bins db ON tbd.destination_bin_id = db.id
          WHERE tbd.transfer_job_id = ?
        `).all(transfer.id);
      } else if (transfer.transfer_type === 'SEQUENTIAL') {
        transfer.details = db.prepare(`
          SELECT 
            tsd.*,
            sb.bin_name as source_bin_name,
            db.bin_name as destination_bin_name
          FROM transfer_sequence_details tsd
          JOIN bins sb ON tsd.source_bin_id = sb.id
          JOIN bins db ON tsd.destination_bin_id = db.id
          WHERE tsd.transfer_job_id = ?
          ORDER BY tsd.sequence_order
        `).all(transfer.id);
      }
    }

    res.json({ success: true, data: transfers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GRINDING APIs

app.post('/api/grinding/start', (req, res) => {
  try {
    const { order_id, bin_ids, bin_moisture_data } = req.body;
    
    if (!order_id || !bin_ids || !Array.isArray(bin_ids)) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const insertJob = db.prepare(`
      INSERT INTO grinding_jobs (order_id, grinding_status, grinding_start_time)
      VALUES (?, 'STARTED', CURRENT_TIMESTAMP)
    `);
    const jobResult = insertJob.run(order_id);
    const grindingJobId = jobResult.lastInsertRowid;
    
    const updateSequentialBinsTransferOut = db.prepare(`
      UPDATE sequential_transfer_bins 
      SET transfer_out_at = CURRENT_TIMESTAMP 
      WHERE destination_bin_id = ? AND transfer_out_at IS NULL
    `);
    
    const getSeqTransferInTime = db.prepare(`
      SELECT transfer_in_at FROM sequential_transfer_bins 
      WHERE destination_bin_id = ? 
      ORDER BY id DESC LIMIT 1
    `);
    
    const insertBin = db.prepare(`
      INSERT INTO grinding_source_bins (grinding_job_id, bin_id, bin_sequence_order, status, outgoing_moisture, water_added, transfer_in_at, transfer_out_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    bin_ids.forEach((binId, index) => {
      const status = index === 0 ? 'IN_USE' : 'PENDING';
      const moistureData = bin_moisture_data && bin_moisture_data[binId];
      const outgoingMoisture = moistureData ? moistureData.outgoing_moisture : null;
      const waterAdded = moistureData ? moistureData.water_added : null;
      
      updateSequentialBinsTransferOut.run(binId);
      
      const seqTransferData = getSeqTransferInTime.get(binId);
      const transferInAt = seqTransferData ? seqTransferData.transfer_in_at : null;
      
      insertBin.run(grindingJobId, binId, index + 1, status, outgoingMoisture, waterAdded, transferInAt);
    });
    
    const updateOrder = db.prepare(`
      UPDATE orders SET production_stage = 'GRINDING_IN_PROGRESS' WHERE id = ?
    `);
    updateOrder.run(order_id);
    
    res.json({ 
      success: true, 
      data: { 
        grinding_job_id: grindingJobId,
        status: 'STARTED'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/grinding/stop', (req, res) => {
  try {
    const { grinding_job_id } = req.body;
    
    if (!grinding_job_id) {
      return res.status(400).json({ success: false, error: 'Missing grinding_job_id' });
    }
    
    const job = db.prepare('SELECT * FROM grinding_jobs WHERE id = ?').get(grinding_job_id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Grinding job not found' });
    }
    
    const startTime = new Date(job.grinding_start_time);
    const endTime = new Date();
    const durationHours = (endTime - startTime) / (1000 * 60 * 60);
    
    const updateJob = db.prepare(`
      UPDATE grinding_jobs 
      SET grinding_status = 'STOPPED', 
          grinding_end_time = CURRENT_TIMESTAMP,
          grinding_duration_hours = ?
      WHERE id = ?
    `);
    updateJob.run(durationHours, grinding_job_id);
    
    const updateOrder = db.prepare(`
      UPDATE orders SET production_stage = 'GRINDING_COMPLETED' WHERE id = ?
    `);
    updateOrder.run(job.order_id);
    
    res.json({ 
      success: true, 
      data: { 
        status: 'STOPPED',
        duration_hours: durationHours
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/grinding/report', (req, res) => {
  try {
    const { 
      grinding_job_id, report_number, start_time, end_time,
      maida_tons, suji_tons, chakki_ata_tons, tandoori_tons,
      bran_tons, grand_total_tons
    } = req.body;
    
    if (!grinding_job_id || !report_number || !start_time || !end_time) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const job = db.prepare('SELECT * FROM grinding_jobs WHERE id = ?').get(grinding_job_id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Grinding job not found' });
    }
    
    if (job.grinding_status !== 'STARTED') {
      return res.status(400).json({ success: false, error: 'Cannot submit reports when grinding is not started' });
    }
    
    const maidaPercent = grand_total_tons > 0 ? (maida_tons / grand_total_tons) * 100 : 0;
    const sujiPercent = grand_total_tons > 0 ? (suji_tons / grand_total_tons) * 100 : 0;
    const chakkiPercent = grand_total_tons > 0 ? (chakki_ata_tons / grand_total_tons) * 100 : 0;
    const tandooriPercent = grand_total_tons > 0 ? (tandoori_tons / grand_total_tons) * 100 : 0;
    const branPercent = grand_total_tons > 0 ? (bran_tons / grand_total_tons) * 100 : 0;
    const mainTotal = maida_tons + suji_tons + chakki_ata_tons + tandoori_tons;
    const mainPercent = grand_total_tons > 0 ? (mainTotal / grand_total_tons) * 100 : 0;
    
    const insertReport = db.prepare(`
      INSERT INTO hourly_reports (
        grinding_job_id, report_number, start_time, end_time, status,
        maida_tons, suji_tons, chakki_ata_tons, tandoori_tons,
        main_total_tons, bran_tons, grand_total_tons,
        maida_percent, suji_percent, chakki_ata_percent, tandoori_percent,
        main_total_percent, bran_percent, submitted_at
      ) VALUES (?, ?, ?, ?, 'SUBMITTED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    insertReport.run(
      grinding_job_id, report_number, start_time, end_time,
      maida_tons, suji_tons, chakki_ata_tons, tandoori_tons,
      mainTotal, bran_tons, grand_total_tons,
      maidaPercent, sujiPercent, chakkiPercent, tandooriPercent,
      mainPercent, branPercent
    );
    
    res.json({ success: true, data: { report_number, status: 'SUBMITTED' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/grinding/summary/:grindingJobId', (req, res) => {
  try {
    const { grindingJobId } = req.params;
    
    const reports = db.prepare(`
      SELECT * FROM hourly_reports 
      WHERE grinding_job_id = ? AND status = 'SUBMITTED'
      ORDER BY report_number
    `).all(grindingJobId);
    
    if (reports.length === 0) {
      return res.json({ success: true, data: { reports: [], summary: null } });
    }
    
    const summary = {
      total_maida: reports.reduce((sum, r) => sum + r.maida_tons, 0),
      total_suji: reports.reduce((sum, r) => sum + r.suji_tons, 0),
      total_chakki: reports.reduce((sum, r) => sum + r.chakki_ata_tons, 0),
      total_tandoori: reports.reduce((sum, r) => sum + r.tandoori_tons, 0),
      total_bran: reports.reduce((sum, r) => sum + r.bran_tons, 0),
      total_main: reports.reduce((sum, r) => sum + r.main_total_tons, 0),
      grand_total: reports.reduce((sum, r) => sum + r.grand_total_tons, 0),
      avg_maida_percent: reports.reduce((sum, r) => sum + r.maida_percent, 0) / reports.length,
      avg_suji_percent: reports.reduce((sum, r) => sum + r.suji_percent, 0) / reports.length,
      avg_chakki_percent: reports.reduce((sum, r) => sum + r.chakki_ata_percent, 0) / reports.length,
      avg_tandoori_percent: reports.reduce((sum, r) => sum + r.tandoori_percent, 0) / reports.length,
      avg_bran_percent: reports.reduce((sum, r) => sum + r.bran_percent, 0) / reports.length,
      avg_main_percent: reports.reduce((sum, r) => sum + r.main_total_percent, 0) / reports.length
    };
    
    res.json({ success: true, data: { reports, summary } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// FINISHED GOODS GODOWN MANAGEMENT
app.get('/api/godowns', (req, res) => {
  try {
    const godowns = db.prepare('SELECT * FROM finished_goods_godowns ORDER BY id').all();
    res.json({ success: true, data: godowns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/godowns', (req, res) => {
  try {
    const { godown_name, godown_code, capacity, location } = req.body;
    
    if (!godown_name || !godown_code || !capacity) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO finished_goods_godowns (godown_name, godown_code, capacity, location)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(godown_name, godown_code, capacity, location || '');
    
    res.json({ 
      success: true, 
      data: { id: result.lastInsertRowid, godown_name, godown_code, capacity, location }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/godowns/:id', (req, res) => {
  try {
    const godown = db.prepare('SELECT * FROM finished_goods_godowns WHERE id = ?').get(req.params.id);
    if (!godown) {
      return res.status(404).json({ success: false, error: 'Godown not found' });
    }
    res.json({ success: true, data: godown });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/godowns/:id', (req, res) => {
  try {
    const { godown_name, godown_code, capacity, location } = req.body;
    
    if (!godown_name || !godown_code || !capacity) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      UPDATE finished_goods_godowns 
      SET godown_name = ?, godown_code = ?, capacity = ?, location = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(godown_name, godown_code, capacity, location || '', req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Godown not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/godowns/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM finished_goods_godowns WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Godown not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// MAIDA SHALLOWS MANAGEMENT
app.get('/api/shallows', (req, res) => {
  try {
    const shallows = db.prepare('SELECT * FROM maida_shallows ORDER BY id').all();
    res.json({ success: true, data: shallows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/shallows', (req, res) => {
  try {
    const { shallow_name, shallow_code, capacity } = req.body;
    
    if (!shallow_name || !shallow_code || !capacity) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO maida_shallows (shallow_name, shallow_code, capacity)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(shallow_name, shallow_code, capacity);
    
    res.json({ 
      success: true, 
      data: { id: result.lastInsertRowid, shallow_name, shallow_code, capacity }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/shallows/:id', (req, res) => {
  try {
    const shallow = db.prepare('SELECT * FROM maida_shallows WHERE id = ?').get(req.params.id);
    if (!shallow) {
      return res.status(404).json({ success: false, error: 'Shallow not found' });
    }
    res.json({ success: true, data: shallow });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/shallows/:id', (req, res) => {
  try {
    const { shallow_name, shallow_code, capacity } = req.body;
    
    if (!shallow_name || !shallow_code || !capacity) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      UPDATE maida_shallows 
      SET shallow_name = ?, shallow_code = ?, capacity = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(shallow_name, shallow_code, capacity, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Shallow not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/shallows/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM maida_shallows WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Shallow not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PACKAGING OPERATIONS
app.post('/api/packaging', (req, res) => {
  try {
    const { 
      order_id, 
      grinding_job_id, 
      product_type, 
      shallow_id, 
      bag_size_kg, 
      number_of_bags, 
      godown_id 
    } = req.body;
    
    if (!order_id || !grinding_job_id || !product_type) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const total_kg_packed = bag_size_kg && number_of_bags ? (bag_size_kg * number_of_bags) / 1000 : req.body.total_kg_packed;

    // If product is MAIDA and using shallow storage (no bags)
    if (product_type.toUpperCase() === 'MAIDA' && shallow_id && (!bag_size_kg || bag_size_kg === 0)) {
      // Storing in shallow only - no godown

      const shallow = db.prepare('SELECT * FROM maida_shallows WHERE id = ?').get(shallow_id);
      if (!shallow) {
        return res.status(404).json({ success: false, error: 'Shallow not found' });
      }

      const availableSpace = shallow.capacity - shallow.current_quantity;
      if (availableSpace < total_kg_packed) {
        return res.status(400).json({ 
          success: false, 
          error: `Insufficient space in shallow. Available: ${availableSpace} tons, Required: ${total_kg_packed} tons`
        });
      }

      // Add to shallow (no deduction, we're adding MAIDA from grinding)
      db.prepare('UPDATE maida_shallows SET current_quantity = current_quantity + ? WHERE id = ?')
        .run(total_kg_packed, shallow_id);
      
      // Record storage transfer from grinding to shallow
      db.prepare(`
        INSERT INTO storage_transfers (source_type, source_id, destination_type, destination_id, product_type, quantity)
        VALUES ('GRINDING', ?, 'SHALLOW', ?, ?, ?)
      `).run(grinding_job_id, shallow_id, product_type, total_kg_packed);
    } else if (product_type.toUpperCase() === 'MAIDA' && shallow_id && bag_size_kg > 0) {
      // MAIDA from shallow to bags to godown
      const shallow = db.prepare('SELECT * FROM maida_shallows WHERE id = ?').get(shallow_id);
      if (!shallow) {
        return res.status(404).json({ success: false, error: 'Shallow not found' });
      }

      if (shallow.current_quantity < total_kg_packed) {
        return res.status(400).json({ 
          success: false, 
          error: `Insufficient quantity in shallow. Available: ${shallow.current_quantity} tons, Required: ${total_kg_packed} tons`
        });
      }

      // Deduct from shallow
      db.prepare('UPDATE maida_shallows SET current_quantity = current_quantity - ? WHERE id = ?')
        .run(total_kg_packed, shallow_id);
      
      // Add to godown
      db.prepare('UPDATE finished_goods_godowns SET current_quantity = current_quantity + ? WHERE id = ?')
        .run(total_kg_packed, godown_id);
      
      // Record storage transfer
      db.prepare(`
        INSERT INTO storage_transfers (source_type, source_id, destination_type, destination_id, product_type, quantity)
        VALUES ('SHALLOW', ?, 'GODOWN', ?, ?, ?)
      `).run(shallow_id, godown_id, product_type, total_kg_packed);
    } else {
      // For other products or MAIDA direct to bags: grinding to godown
      if (!godown_id) {
        return res.status(400).json({ success: false, error: 'Godown selection required' });
      }
      
      // Add to godown
      db.prepare('UPDATE finished_goods_godowns SET current_quantity = current_quantity + ? WHERE id = ?')
        .run(total_kg_packed, godown_id);
      
      // Record storage transfer from grinding
      db.prepare(`
        INSERT INTO storage_transfers (source_type, source_id, destination_type, destination_id, product_type, quantity)
        VALUES ('GRINDING', ?, 'GODOWN', ?, ?, ?)
      `).run(grinding_job_id, godown_id, product_type, total_kg_packed);
    }

    // Create packaging record
    const packagingStmt = db.prepare(`
      INSERT INTO packaging_records 
      (grinding_job_id, order_id, product_type, shallow_id, bag_size_kg, number_of_bags, total_kg_packed, godown_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = packagingStmt.run(
      grinding_job_id, 
      order_id, 
      product_type, 
      shallow_id || null, 
      bag_size_kg || 0, 
      number_of_bags || 0, 
      total_kg_packed, 
      godown_id || null
    );

    // Update order status
    db.prepare("UPDATE orders SET production_stage = 'PACKAGING_COMPLETED' WHERE id = ?")
      .run(order_id);

    res.json({ 
      success: true, 
      data: { 
        packaging_id: result.lastInsertRowid, 
        total_kg_packed,
        status: 'PACKED'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/packaging/:orderId', (req, res) => {
  try {
    const records = db.prepare(`
      SELECT 
        pr.*,
        ms.shallow_name,
        fg.godown_name
      FROM packaging_records pr
      LEFT JOIN maida_shallows ms ON pr.shallow_id = ms.id
      JOIN finished_goods_godowns fg ON pr.godown_id = fg.id
      WHERE pr.order_id = ?
      ORDER BY pr.packed_at DESC
    `).all(req.params.orderId);
    
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get grinding summary for packaging
app.get('/api/grinding/:grindingJobId/summary', (req, res) => {
  try {
    const { grindingJobId } = req.params;
    
    const grindingJob = db.prepare('SELECT * FROM grinding_jobs WHERE id = ?').get(grindingJobId);
    if (!grindingJob) {
      return res.status(404).json({ success: false, error: 'Grinding job not found' });
    }
    
    const reports = db.prepare(`
      SELECT * FROM hourly_reports 
      WHERE grinding_job_id = ? AND status = 'SUBMITTED'
      ORDER BY report_number
    `).all(grindingJobId);
    
    if (reports.length === 0) {
      return res.json({ success: false, error: 'No grinding reports found' });
    }
    
    const summary = {
      maida: reports.reduce((sum, r) => sum + r.maida_tons, 0),
      suji: reports.reduce((sum, r) => sum + r.suji_tons, 0),
      chakki: reports.reduce((sum, r) => sum + r.chakki_ata_tons, 0),
      tandoori: reports.reduce((sum, r) => sum + r.tandoori_tons, 0),
      bran: reports.reduce((sum, r) => sum + r.bran_tons, 0),
      total: reports.reduce((sum, r) => sum + r.grand_total_tons, 0)
    };
    
    res.json({ success: true, data: { grinding_job: grindingJob, summary } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update shallow quantity (for manual transfers of MAIDA from grinding to shallow)
app.post('/api/shallows/:id/add', (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid quantity' });
    }

    const shallow = db.prepare('SELECT * FROM maida_shallows WHERE id = ?').get(req.params.id);
    if (!shallow) {
      return res.status(404).json({ success: false, error: 'Shallow not found' });
    }

    if (shallow.current_quantity + quantity > shallow.capacity) {
      return res.status(400).json({ 
        success: false, 
        error: `Exceeds capacity. Available space: ${shallow.capacity - shallow.current_quantity} tons`
      });
    }

    db.prepare('UPDATE maida_shallows SET current_quantity = current_quantity + ? WHERE id = ?')
      .run(quantity, req.params.id);
    
    res.json({ 
      success: true, 
      data: { new_quantity: shallow.current_quantity + quantity }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Flour Mill ERP running on http://0.0.0.0:${PORT}`);
  console.log(`Server is listening and ready to accept connections`);
});
