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
    const { order_number, product_type, quantity } = req.body;
    
    if (!order_number || !product_type || !quantity) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Flour Mill ERP running on http://0.0.0.0:${PORT}`);
});
