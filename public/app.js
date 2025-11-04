const API_URL = window.location.origin;

let sourceBins = [];
let destinationBins = [];
let allBins = [];

function showTab(tabName, clickedElement) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    if (clickedElement) {
        clickedElement.classList.add('active');
    }
    
    if (tabName === 'orders') {
        loadOrders();
    } else if (tabName === 'create-order') {
        loadProductsForOrder();
    } else if (tabName === 'create-plan') {
        loadOrdersForPlan();
        loadBinsForPlan();
    } else if (tabName === 'products-master') {
        loadProducts();
    } else if (tabName === 'bins-master') {
        loadBins();
    }
}

async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/api/orders`);
        const result = await response.json();
        
        const ordersList = document.getElementById('orders-list');
        
        if (result.success && result.data.length > 0) {
            ordersList.innerHTML = result.data.map(order => `
                <div class="order-card">
                    <h3>${order.order_number}</h3>
                    <p><strong>Product:</strong> ${order.product_type}</p>
                    <p><strong>Quantity:</strong> ${order.quantity} tons</p>
                    <p><strong>Created:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
                    <span class="status-badge status-${order.production_stage.toLowerCase()}">${order.production_stage}</span>
                    ${order.production_stage === 'CREATED' ? `
                        <button class="btn-small" onclick="createPlanForOrder(${order.id})">Create Plan</button>
                    ` : ''}
                </div>
            `).join('');
        } else {
            ordersList.innerHTML = '<p style="text-align: center; color: #666;">No orders yet. Create your first order!</p>';
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

async function loadProductsForOrder() {
    try {
        const response = await fetch(`${API_URL}/api/products`);
        const result = await response.json();
        
        const select = document.getElementById('product_type');
        
        if (result.success && result.data.length > 0) {
            select.innerHTML = '<option value="">Select Product</option>' + 
                result.data.map(product => 
                    `<option value="${product.product_name}">${product.product_name} (${product.initial_name})</option>`
                ).join('');
        } else {
            select.innerHTML = '<option value="">No products found. Add products in Products Master</option>';
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function createPlanForOrder(orderId) {
    showTab('create-plan', document.querySelector('[onclick*="create-plan"]'));
    document.getElementById('plan_order_id').value = orderId;
    updateOrderDetails();
}

document.getElementById('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const orderData = {
        order_number: document.getElementById('order_number').value,
        product_type: document.getElementById('product_type').value,
        quantity: parseFloat(document.getElementById('quantity').value)
    };
    
    try {
        const response = await fetch(`${API_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        
        const result = await response.json();
        const messageEl = document.getElementById('order-message');
        
        if (result.success) {
            messageEl.className = 'message success';
            messageEl.textContent = `Order ${orderData.order_number} created successfully! Status: CREATED`;
            document.getElementById('order-form').reset();
            setTimeout(() => {
                showTab('orders', document.querySelector('[onclick*="orders"]'));
            }, 2000);
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = `Error: ${result.error}`;
        }
    } catch (error) {
        const messageEl = document.getElementById('order-message');
        messageEl.className = 'message error';
        messageEl.textContent = `Error: ${error.message}`;
    }
});

async function loadOrdersForPlan() {
    try {
        const response = await fetch(`${API_URL}/api/orders`);
        const result = await response.json();
        
        const select = document.getElementById('plan_order_id');
        
        if (result.success && result.data.length > 0) {
            const createdOrders = result.data.filter(o => o.production_stage === 'CREATED');
            
            if (createdOrders.length > 0) {
                select.innerHTML = '<option value="">Select an order</option>' + 
                    createdOrders.map(order => 
                        `<option value="${order.id}">${order.order_number} - ${order.product_type} (${order.quantity} tons)</option>`
                    ).join('');
            } else {
                select.innerHTML = '<option value="">No orders available for planning</option>';
            }
        } else {
            select.innerHTML = '<option value="">No orders found</option>';
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

async function loadBinsForPlan() {
    try {
        const response = await fetch(`${API_URL}/api/bins`);
        const result = await response.json();
        
        if (result.success) {
            allBins = result.data;
            sourceBins = allBins.filter(bin => bin.bin_type === 'PRE_CLEAN');
            destinationBins = allBins.filter(bin => bin.bin_type === '24HR');
            
            renderSourceBins();
            renderDestinationBins();
        }
    } catch (error) {
        console.error('Error loading bins:', error);
    }
}

let sourceRowCounter = 0;

function renderSourceBins() {
    const container = document.getElementById('source-bins-container');
    container.innerHTML = '';
    updateBlendTotal();
}

function addSourceBinRow() {
    if (sourceBins.length === 0) {
        alert('No PRE_CLEAN bins found. Please add bins in Bins Master.');
        return;
    }
    
    const container = document.getElementById('source-bins-container');
    const rowId = `source-row-${sourceRowCounter++}`;
    const orderTotal = parseFloat(document.getElementById('order-details').getAttribute('data-total')) || 0;
    
    const availableBins = sourceBins.filter(bin => {
        const existingSelects = container.querySelectorAll('.source-bin-select');
        const selectedIds = Array.from(existingSelects).map(s => s.value).filter(v => v);
        return !selectedIds.includes(bin.id.toString());
    });
    
    if (availableBins.length === 0) {
        alert('All PRE_CLEAN bins have been added.');
        return;
    }
    
    const row = document.createElement('div');
    row.className = 'dynamic-bin-item';
    row.id = rowId;
    row.innerHTML = `
        <select class="source-bin-select" data-row-id="${rowId}" required>
            <option value="">Select Bin</option>
            ${sourceBins.map(bin => `<option value="${bin.id}">${bin.bin_name} (${bin.identity_number})</option>`).join('')}
        </select>
        <input type="number" class="source-percentage-input" data-row-id="${rowId}" step="0.01" placeholder="%" required>
        <span>%</span>
        <input type="number" class="source-quantity-display" data-row-id="${rowId}" step="0.01" placeholder="Tons" readonly>
        <span>tons</span>
        <button type="button" class="remove-bin-btn" onclick="removeSourceBinRow('${rowId}')">Remove</button>
    `;
    
    container.appendChild(row);
    
    const select = row.querySelector('.source-bin-select');
    const percentInput = row.querySelector('.source-percentage-input');
    const quantityDisplay = row.querySelector('.source-quantity-display');
    
    select.addEventListener('change', () => {
        updateBlendTotal();
    });
    
    percentInput.addEventListener('input', () => {
        const percentage = parseFloat(percentInput.value) || 0;
        const quantity = (percentage / 100) * orderTotal;
        quantityDisplay.value = quantity.toFixed(2);
        updateBlendTotal();
    });
}

function removeSourceBinRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        updateBlendTotal();
    }
}

let destRowCounter = 0;

function renderDestinationBins() {
    const container = document.getElementById('destination-bins-container');
    container.innerHTML = '';
    updateDistTotal();
}

function addDestinationBinRow() {
    if (destinationBins.length === 0) {
        alert('No 24HR bins found. Please add bins in Bins Master.');
        return;
    }
    
    const container = document.getElementById('destination-bins-container');
    const rowId = `dest-row-${destRowCounter++}`;
    
    const availableBins = destinationBins.filter(bin => {
        const existingSelects = container.querySelectorAll('.dest-bin-select');
        const selectedIds = Array.from(existingSelects).map(s => s.value).filter(v => v);
        return !selectedIds.includes(bin.id.toString());
    });
    
    if (availableBins.length === 0) {
        alert('All 24HR bins have been added.');
        return;
    }
    
    const row = document.createElement('div');
    row.className = 'dynamic-bin-item';
    row.id = rowId;
    row.innerHTML = `
        <select class="dest-bin-select" data-row-id="${rowId}" required>
            <option value="">Select Bin</option>
            ${destinationBins.map(bin => `<option value="${bin.id}">${bin.bin_name} (${bin.identity_number})</option>`).join('')}
        </select>
        <input type="number" class="dest-quantity-input" data-row-id="${rowId}" step="0.01" placeholder="Tons" required>
        <span>tons</span>
        <button type="button" class="remove-bin-btn" onclick="removeDestinationBinRow('${rowId}')">Remove</button>
    `;
    
    container.appendChild(row);
    
    const quantityInput = row.querySelector('.dest-quantity-input');
    quantityInput.addEventListener('input', updateDistTotal);
}

function removeDestinationBinRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        updateDistTotal();
    }
}

document.getElementById('plan_order_id').addEventListener('change', updateOrderDetails);

async function updateOrderDetails() {
    const orderId = document.getElementById('plan_order_id').value;
    const detailsEl = document.getElementById('order-details');
    
    if (!orderId) {
        detailsEl.classList.remove('show');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/orders/${orderId}`);
        const result = await response.json();
        
        if (result.success) {
            const order = result.data;
            detailsEl.innerHTML = `
                <h4>Order Details</h4>
                <p><strong>Order Number:</strong> ${order.order_number}</p>
                <p><strong>Product:</strong> ${order.product_type}</p>
                <p><strong>Total Quantity:</strong> ${order.quantity} tons</p>
            `;
            detailsEl.classList.add('show');
            detailsEl.setAttribute('data-total', order.quantity);
        }
    } catch (error) {
        console.error('Error loading order details:', error);
    }
}

function updateBlendTotal() {
    const inputs = document.querySelectorAll('.source-percentage-input');
    let total = 0;
    inputs.forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    
    const displayEl = document.getElementById('blend-total');
    displayEl.textContent = `Total: ${total.toFixed(2)}%`;
    
    if (Math.abs(total - 100) < 0.01 && total > 0) {
        displayEl.className = 'total-display valid';
    } else {
        displayEl.className = 'total-display invalid';
    }
}

function updateDistTotal() {
    const inputs = document.querySelectorAll('.dest-quantity-input');
    let total = 0;
    inputs.forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    
    const orderTotal = parseFloat(document.getElementById('order-details').getAttribute('data-total')) || 0;
    
    const displayEl = document.getElementById('dist-total');
    displayEl.textContent = `Total: ${total.toFixed(2)} tons (Required: ${orderTotal} tons)`;
    
    if (Math.abs(total - orderTotal) < 0.01 && orderTotal > 0) {
        displayEl.className = 'total-display valid';
    } else {
        displayEl.className = 'total-display invalid';
    }
}

document.getElementById('plan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const orderId = document.getElementById('plan_order_id').value;
    if (!orderId) {
        alert('Please select an order');
        return;
    }
    
    const sourceRows = document.querySelectorAll('#source-bins-container .dynamic-bin-item');
    const destRows = document.querySelectorAll('#destination-bins-container .dynamic-bin-item');
    
    const source_blend = Array.from(sourceRows).map(row => {
        const binId = row.querySelector('.source-bin-select').value;
        const percentage = row.querySelector('.source-percentage-input').value;
        return {
            bin_id: parseInt(binId),
            percentage: parseFloat(percentage) || 0
        };
    }).filter(item => item.bin_id);
    
    const destination_distribution = Array.from(destRows).map(row => {
        const binId = row.querySelector('.dest-bin-select').value;
        const quantity = row.querySelector('.dest-quantity-input').value;
        return {
            bin_id: parseInt(binId),
            quantity: parseFloat(quantity) || 0
        };
    }).filter(item => item.bin_id);
    
    const planData = {
        order_id: parseInt(orderId),
        plan_name: document.getElementById('plan_name').value,
        source_blend,
        destination_distribution
    };
    
    try {
        const response = await fetch(`${API_URL}/api/plans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(planData)
        });
        
        const result = await response.json();
        const messageEl = document.getElementById('plan-message');
        
        if (result.success) {
            messageEl.className = 'message success';
            messageEl.textContent = `Production plan "${planData.plan_name}" created successfully! Order status updated to PLANNED.`;
            document.getElementById('plan-form').reset();
            document.getElementById('order-details').classList.remove('show');
            setTimeout(() => {
                showTab('orders', document.querySelector('[onclick*="orders"]'));
            }, 2000);
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = `Error: ${result.error}`;
        }
    } catch (error) {
        const messageEl = document.getElementById('plan-message');
        messageEl.className = 'message error';
        messageEl.textContent = `Error: ${error.message}`;
    }
});

async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/api/products`);
        const result = await response.json();
        
        const listEl = document.getElementById('products-list');
        
        if (result.success && result.data.length > 0) {
            listEl.innerHTML = result.data.map(product => `
                <div class="item-card">
                    <div class="item-info">
                        <p><strong>Product:</strong> ${product.product_name}</p>
                        <p><strong>Initial:</strong> ${product.initial_name}</p>
                    </div>
                </div>
            `).join('');
        } else {
            listEl.innerHTML = '<p style="text-align: center; color: #666;">No products yet. Add your first product!</p>';
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const productData = {
        product_name: document.getElementById('product_name').value,
        initial_name: document.getElementById('initial_name').value
    };
    
    try {
        const response = await fetch(`${API_URL}/api/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
        
        const result = await response.json();
        const messageEl = document.getElementById('product-message');
        
        if (result.success) {
            messageEl.className = 'message success';
            messageEl.textContent = `Product "${productData.product_name}" added successfully!`;
            document.getElementById('product-form').reset();
            loadProducts();
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 3000);
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = `Error: ${result.error}`;
        }
    } catch (error) {
        const messageEl = document.getElementById('product-message');
        messageEl.className = 'message error';
        messageEl.textContent = `Error: ${error.message}`;
    }
});

async function loadBins() {
    try {
        const response = await fetch(`${API_URL}/api/bins`);
        const result = await response.json();
        
        const listEl = document.getElementById('bins-list');
        
        if (result.success && result.data.length > 0) {
            listEl.innerHTML = result.data.map(bin => `
                <div class="item-card">
                    <div class="item-info">
                        <p><strong>Bin:</strong> ${bin.bin_name} (${bin.identity_number})</p>
                        <p><strong>Type:</strong> ${bin.bin_type} | <strong>Capacity:</strong> ${bin.capacity} tons | <strong>Current:</strong> ${bin.current_quantity} tons</p>
                    </div>
                </div>
            `).join('');
        } else {
            listEl.innerHTML = '<p style="text-align: center; color: #666;">No bins yet. Add your first bin!</p>';
        }
    } catch (error) {
        console.error('Error loading bins:', error);
    }
}

document.getElementById('bin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const binData = {
        bin_name: document.getElementById('bin_name').value,
        bin_type: document.getElementById('bin_type').value,
        capacity: parseFloat(document.getElementById('bin_capacity').value),
        current_quantity: parseFloat(document.getElementById('bin_current_quantity').value) || 0,
        identity_number: document.getElementById('bin_identity_number').value
    };
    
    try {
        const response = await fetch(`${API_URL}/api/bins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(binData)
        });
        
        const result = await response.json();
        const messageEl = document.getElementById('bin-message');
        
        if (result.success) {
            messageEl.className = 'message success';
            messageEl.textContent = `Bin "${binData.bin_name}" added successfully!`;
            document.getElementById('bin-form').reset();
            loadBins();
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 3000);
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = `Error: ${result.error}`;
        }
    } catch (error) {
        const messageEl = document.getElementById('bin-message');
        messageEl.className = 'message error';
        messageEl.textContent = `Error: ${error.message}`;
    }
});

loadOrders();
