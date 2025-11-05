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

    // Get product initial
    const product = db.prepare('SELECT initial_name FROM products WHERE product_name = ?').get(product_type);
    if (!product) {
      return res.status(400).json({ success: false, error: 'Product not found' });
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
    const { order_id, plan_name, source_blend, destination_distribution } = req.body;
    
    if (!order_id || !plan_name || !source_blend || !destination_distribution) {
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
      INSERT INTO production_plans (order_id, plan_name, plan_status)
      VALUES (?, ?, 'ACTIVE')
    `);
    const planResult = insertPlan.run(order_id, plan_name);
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
      data: { plan_id: planId, order_id, plan_name, status: 'PLANNED' }
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

app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY product_name').all();
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const { product_name, initial_name } = req.body;
    
    if (!product_name || !initial_name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO products (product_name, initial_name)
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
        SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      updateStmt.run(existingTransfer.id);
    } else {
      const insertStmt = db.prepare(`
        INSERT INTO destination_bin_transfers 
        (order_id, plan_id, destination_bin_id, status, target_quantity, started_at)
        VALUES (?, ?, ?, 'IN_PROGRESS', ?, CURRENT_TIMESTAMP)
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

    // Update transfer record
    const updateTransfer = db.prepare(`
      UPDATE destination_bin_transfers 
      SET status = 'COMPLETED', transferred_quantity = ?, completed_at = CURRENT_TIMESTAMP 
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

app.post('/api/transfers/sequential', (req, res) => {
  try {
    const { order_id, source_bin_id, destination_sequence } = req.body;
    
    if (!order_id || !source_bin_id || !destination_sequence || !Array.isArray(destination_sequence)) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const sourceBin = db.prepare('SELECT * FROM bins WHERE id = ?').get(source_bin_id);
    if (!sourceBin) {
      return res.status(404).json({ success: false, error: 'Source bin not found' });
    }

    let remainingQuantity = sourceBin.current_quantity;
    let totalTransferred = 0;

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
        remaining_in_source: remainingQuantity
      }
    });
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Flour Mill ERP running on http://0.0.0.0:${PORT}`);
  console.log(`Server is listening and ready to accept connections`);
});
