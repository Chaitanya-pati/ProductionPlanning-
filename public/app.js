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
    } else if (tabName === 'grinding') {
        initGrindingModule();
    } else if (tabName === 'create-order') {
        loadProductsForOrder();
    } else if (tabName === 'create-plan') {
        loadOrdersForPlan();
        loadBinsForPlan();
    } else if (tabName === 'transfer-blended') {
        loadPlansForBlendedTransfer();
    } else if (tabName === 'transfer-sequential') {
        loadOrdersForSequentialTransfer();
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
            messageEl.textContent = `Order ${result.data.order_number} created successfully! Status: CREATED`;
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

async function loadPlansForBlendedTransfer() {
    try {
        const ordersResponse = await fetch(`${API_URL}/api/orders`);
        const ordersResult = await ordersResponse.json();
        
        const select = document.getElementById('blended_plan_id');
        
        if (ordersResult.success && ordersResult.data.length > 0) {
            const availableOrders = ordersResult.data.filter(o => 
                o.production_stage === 'PLANNED' || o.production_stage === 'TRANSFER_PRE_TO_24_IN_PROGRESS'
            );
            
            if (availableOrders.length === 0) {
                select.innerHTML = '<option value="">No planned orders available</option>';
                return;
            }
            
            let allPlans = [];
            for (let order of availableOrders) {
                const plansResponse = await fetch(`${API_URL}/api/plans/${order.id}`);
                const plansResult = await plansResponse.json();
                
                if (plansResult.success && plansResult.data.length > 0) {
                    plansResult.data.forEach(plan => {
                        allPlans.push({
                            ...plan,
                            order_number: order.order_number,
                            order_id: order.id,
                            product_type: order.product_type,
                            total_quantity: order.quantity
                        });
                    });
                }
            }
            
            if (allPlans.length > 0) {
                select.innerHTML = '<option value="">Select a plan</option>' + 
                    allPlans.map(plan => 
                        `<option value="${plan.id}" data-order-id="${plan.order_id}">${plan.plan_name} (Order: ${plan.order_number})</option>`
                    ).join('');
            } else {
                select.innerHTML = '<option value="">No plans found</option>';
            }
        } else {
            select.innerHTML = '<option value="">No orders found</option>';
        }
    } catch (error) {
        console.error('Error loading plans:', error);
    }
}

async function showBlendedPlanInfo(planId) {
    try {
        const selectEl = document.getElementById('blended_plan_id');
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const orderId = selectedOption.getAttribute('data-order-id');
        
        const plansResponse = await fetch(`${API_URL}/api/plans/${orderId}`);
        const plansResult = await plansResponse.json();
        
        const ordersResponse = await fetch(`${API_URL}/api/orders/${orderId}`);
        const ordersResult = await ordersResponse.json();
        
        if (plansResult.success && ordersResult.success) {
            const plan = plansResult.data.find(p => p.id == planId);
            const order = ordersResult.data;
            
            if (plan) {
                const infoEl = document.getElementById('blended-plan-info');
                infoEl.innerHTML = `
                    <h4>Plan: ${plan.plan_name}</h4>
                    <p><strong>Order Number:</strong> ${order.order_number}</p>
                    <p><strong>Product:</strong> ${order.product_type}</p>
                    <p><strong>Total Quantity:</strong> ${order.quantity} tons</p>
                    <div class="plan-section">
                        <h5>Source Blend Configuration:</h5>
                        ${plan.source_blend.map(s => `
                            <p>• ${s.bin_name}: ${s.percentage}% (${s.quantity} tons)</p>
                        `).join('')}
                    </div>
                `;
                infoEl.style.display = 'block';
                
                await renderBlendedDestinations(plan, orderId);
            }
        }
    } catch (error) {
        console.error('Error loading plan details:', error);
    }
}

async function renderBlendedDestinations(plan, orderId) {
    const container = document.getElementById('blended-destinations-container');
    const binsResponse = await fetch(`${API_URL}/api/bins`);
    const binsResult = await binsResponse.json();
    
    if (!binsResult.success) return;
    
    const allBins = binsResult.data;
    
    container.innerHTML = `
        <div class="section">
            <h3>Destination 24HR Bins - Individual Transfer Control</h3>
            <p class="hint">Click START to begin transferring to a bin, then STOP when you want to finish.</p>
            <div id="destinations-list">
                ${plan.destination_distribution.map(dest => {
                    const bin = allBins.find(b => b.id === dest.bin_id);
                    const binName = bin ? bin.bin_name : `Bin ${dest.bin_id}`;
                    const binIdentity = bin ? bin.identity_number : '';
                    
                    return `
                        <div class="destination-transfer-item" data-dest-bin-id="${dest.bin_id}" data-plan-id="${plan.id}" data-order-id="${orderId}" data-target-quantity="${dest.quantity}">
                            <div class="transfer-info">
                                <h4>${binName} (${binIdentity})</h4>
                                <p><strong>Target Quantity:</strong> ${dest.quantity} tons</p>
                                <p><strong>Blend Sources:</strong></p>
                                ${plan.source_blend.map(s => {
                                    const contribution = (s.percentage / 100) * dest.quantity;
                                    return `<p class="blend-detail">• ${s.bin_name}: ${s.percentage}% = ${contribution.toFixed(2)} tons</p>`;
                                }).join('')}
                            </div>
                            <div class="transfer-status">
                                <div class="status-display">
                                    <span class="status-label">Status:</span>
                                    <span class="status-value">Ready</span>
                                </div>
                                <div class="quantity-display">
                                    <span class="quantity-label">Transferred:</span>
                                    <span class="quantity-value">0 tons</span>
                                </div>
                            </div>
                            <div class="transfer-controls">
                                <button class="btn-start" onclick="startBlendedTransfer('${dest.bin_id}', '${plan.id}', '${orderId}')">START</button>
                                <button class="btn-stop" onclick="stopBlendedTransfer('${dest.bin_id}', '${plan.id}', '${orderId}')" style="display: none;">STOP</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

async function showBlendedPlanDetails(planId) {
    try {
        const orderId = document.getElementById('blended_order_id').value;
        const response = await fetch(`${API_URL}/api/plans/${orderId}`);
        const result = await response.json();
        
        if (result.success) {
            const plan = result.data.find(p => p.id == planId);
            if (plan) {
                const detailsEl = document.getElementById('blended-plan-details');
                detailsEl.innerHTML = `
                    <div class="plan-preview">
                        <h4>Plan: ${plan.plan_name}</h4>
                        <div class="plan-section">
                            <h5>Source Blend:</h5>
                            ${plan.source_blend.map(s => `
                                <p>• ${s.bin_name}: ${s.percentage}% (${s.quantity} tons)</p>
                            `).join('')}
                        </div>
                        <div class="plan-section">
                            <h5>Destinations:</h5>
                            ${plan.destination_distribution.map(d => `
                                <p>• ${d.bin_name}: ${d.quantity} tons</p>
                            `).join('')}
                        </div>
                    </div>
                `;
                document.getElementById('execute-blended-transfer').style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading plan details:', error);
    }
}

document.getElementById('blended_plan_id').addEventListener('change', function() {
    const planId = this.value;
    if (planId) {
        showBlendedPlanInfo(planId);
    } else {
        document.getElementById('blended-plan-info').style.display = 'none';
        document.getElementById('blended-destinations-container').innerHTML = '';
    }
});

async function startBlendedTransfer(destBinId, planId, orderId) {
    const item = document.querySelector(`[data-dest-bin-id="${destBinId}"][data-plan-id="${planId}"]`);
    if (!item) return;
    
    const startBtn = item.querySelector('.btn-start');
    const stopBtn = item.querySelector('.btn-stop');
    const statusValue = item.querySelector('.status-value');
    
    startBtn.disabled = true;
    statusValue.textContent = 'Transferring...';
    statusValue.className = 'status-value transferring';
    
    try {
        const response = await fetch(`${API_URL}/api/transfers/blended/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                order_id: parseInt(orderId), 
                plan_id: parseInt(planId),
                destination_bin_id: parseInt(destBinId)
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            statusValue.textContent = 'In Progress';
            
            const messageEl = document.getElementById('blended-message');
            messageEl.className = 'message success';
            messageEl.textContent = `Transfer started for bin ${destBinId}`;
            setTimeout(() => messageEl.style.display = 'none', 3000);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        startBtn.disabled = false;
        statusValue.textContent = 'Error';
        statusValue.className = 'status-value error';
        
        const messageEl = document.getElementById('blended-message');
        messageEl.className = 'message error';
        messageEl.textContent = `Error: ${error.message}`;
    }
}

async function stopBlendedTransfer(destBinId, planId, orderId) {
    const item = document.querySelector(`[data-dest-bin-id="${destBinId}"][data-plan-id="${planId}"]`);
    if (!item) return;
    
    const startBtn = item.querySelector('.btn-start');
    const stopBtn = item.querySelector('.btn-stop');
    const statusValue = item.querySelector('.status-value');
    const quantityValue = item.querySelector('.quantity-value');
    
    if (!confirm('Stop the transfer for this bin?')) {
        return;
    }
    
    stopBtn.disabled = true;
    statusValue.textContent = 'Stopping...';
    
    try {
        const response = await fetch(`${API_URL}/api/transfers/blended/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                order_id: parseInt(orderId), 
                plan_id: parseInt(planId),
                destination_bin_id: parseInt(destBinId)
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            stopBtn.style.display = 'none';
            startBtn.style.display = 'none';
            statusValue.textContent = 'Completed';
            statusValue.className = 'status-value completed';
            quantityValue.textContent = `${result.data.transferred_quantity} tons`;
            
            const messageEl = document.getElementById('blended-message');
            messageEl.className = 'message success';
            messageEl.textContent = `Transfer completed for bin ${destBinId}: ${result.data.transferred_quantity} tons transferred`;
            setTimeout(() => messageEl.style.display = 'none', 3000);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        stopBtn.disabled = false;
        statusValue.textContent = 'Error';
        statusValue.className = 'status-value error';
        
        const messageEl = document.getElementById('blended-message');
        messageEl.className = 'message error';
        messageEl.textContent = `Error: ${error.message}`;
    }
}

async function loadOrdersForSequentialTransfer() {
    try {
        const response = await fetch(`${API_URL}/api/orders`);
        const result = await response.json();
        
        const select = document.getElementById('sequential_order_id');
        
        if (result.success && result.data.length > 0) {
            const transferredOrders = result.data.filter(o => o.production_stage === 'TRANSFER_PRE_TO_24_COMPLETED');
            
            if (transferredOrders.length > 0) {
                select.innerHTML = '<option value="">Select an order</option>' + 
                    transferredOrders.map(order => 
                        `<option value="${order.id}">${order.order_number} - ${order.product_type} (${order.quantity} tons)</option>`
                    ).join('');
            } else {
                select.innerHTML = '<option value="">No orders ready for 24→12 transfer</option>';
            }
        } else {
            select.innerHTML = '<option value="">No orders found</option>';
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

async function load24HRBins() {
    try {
        const response = await fetch(`${API_URL}/api/bins`);
        const result = await response.json();
        
        if (result.success) {
            const bins24HR = result.data.filter(b => b.bin_type === '24HR' && b.current_quantity > 0);
            const select = document.getElementById('sequential_source_bin');
            
            if (bins24HR.length > 0) {
                select.innerHTML = '<option value="">Select a bin</option>' + 
                    bins24HR.map(bin => 
                        `<option value="${bin.id}">${bin.bin_name} (${bin.identity_number}) - ${bin.current_quantity} tons available</option>`
                    ).join('');
            } else {
                select.innerHTML = '<option value="">No 24HR bins with quantity available</option>';
            }
        }
    } catch (error) {
        console.error('Error loading bins:', error);
    }
}

async function load12HRBinsSequence() {
    try {
        const response = await fetch(`${API_URL}/api/bins`);
        const result = await response.json();
        
        if (result.success) {
            const bins12HR = result.data.filter(b => b.bin_type === '12HR');
            const container = document.getElementById('sequential-destinations-container');
            
            if (bins12HR.length > 0) {
                container.innerHTML = `
                    <p class="sequential-description">Select which 12HR bins to use. They will be filled in sequence order.</p>
                    <div class="sequential-bins-list">
                        ${bins12HR.map((bin, index) => {
                            const available = bin.capacity - bin.current_quantity;
                            return `
                                <div class="sequence-bin-card">
                                    <input type="checkbox" class="bin-checkbox" value="${bin.id}" id="bin_${bin.id}">
                                    <label for="bin_${bin.id}" class="bin-checkbox-label">
                                        <div class="bin-name-sequence">
                                            <strong class="bin-name-text">${bin.bin_name}</strong>
                                            <span class="sequence-number">(Sequence: ${index + 1})</span>
                                        </div>
                                        <div class="bin-capacity-details">
                                            Current: ${bin.current_quantity.toFixed(0)}/${bin.capacity.toFixed(0)} tons • Available: ${available.toFixed(0)} tons
                                        </div>
                                    </label>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } else {
                container.innerHTML = '<p>No 12HR bins found. Add them in Bins Master.</p>';
            }
        }
    } catch (error) {
        console.error('Error loading bins:', error);
    }
}

document.getElementById('sequential_order_id').addEventListener('change', async function() {
    const orderId = this.value;
    const detailsEl = document.getElementById('sequential-order-details');
    
    if (!orderId) {
        detailsEl.innerHTML = '';
        document.getElementById('sequential-transfer-config').style.display = 'none';
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
                <p><strong>Status:</strong> <span class="status-badge">${order.production_stage}</span></p>
            `;
            document.getElementById('sequential-transfer-config').style.display = 'block';
            await load24HRBins();
            await load12HRBinsSequence();
        }
    } catch (error) {
        console.error('Error:', error);
    }
});

document.getElementById('sequential_source_bin').addEventListener('change', async function() {
    const binId = this.value;
    const detailsEl = document.getElementById('sequential-source-details');
    
    if (!binId) {
        detailsEl.innerHTML = '';
        document.getElementById('execute-sequential-transfer').style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/bins`);
        const result = await response.json();
        
        if (result.success) {
            const bin = result.data.find(b => b.id == binId);
            if (bin) {
                detailsEl.innerHTML = `
                    <div class="bin-preview">
                        <h4>Source: ${bin.bin_name}</h4>
                        <p><strong>Available Quantity:</strong> ${bin.current_quantity} tons</p>
                        <p><strong>Capacity:</strong> ${bin.capacity} tons</p>
                    </div>
                `;
                detailsEl.setAttribute('data-available', bin.current_quantity);
                document.getElementById('execute-sequential-transfer').style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
});

// Handle transfer quantity type selection
document.querySelectorAll('input[name="transfer_quantity_type"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const customInput = document.getElementById('custom_transfer_quantity');
        const validationEl = document.getElementById('custom-quantity-validation');
        
        if (this.value === 'custom') {
            customInput.disabled = false;
            customInput.focus();
        } else {
            customInput.disabled = true;
            customInput.value = '';
            validationEl.textContent = '';
        }
    });
});

// Validate custom quantity
document.getElementById('custom_transfer_quantity').addEventListener('input', function() {
    const detailsEl = document.getElementById('sequential-source-details');
    const availableQty = parseFloat(detailsEl.getAttribute('data-available')) || 0;
    const customQty = parseFloat(this.value) || 0;
    const validationEl = document.getElementById('custom-quantity-validation');
    
    if (customQty > availableQty) {
        validationEl.textContent = `⚠️ Exceeds available quantity (${availableQty} tons)`;
        validationEl.style.color = '#ef4444';
    } else if (customQty > 0) {
        validationEl.textContent = `✓ Valid quantity`;
        validationEl.style.color = '#10b981';
    } else {
        validationEl.textContent = '';
    }
});

// Updated 24->12 Transfer with checkbox change handling
let selectedSequentialBins = [];

document.addEventListener('change', function(e) {
    if (e.target.classList.contains('bin-checkbox')) {
        updateSequentialPreview();
    }
});

function updateSequentialPreview() {
    const allCheckboxes = Array.from(document.querySelectorAll('.bin-checkbox'));
    selectedSequentialBins = allCheckboxes
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));
    
    const previewEl = document.getElementById('sequential-transfer-preview');
    const startBtn = document.getElementById('start-sequential-transfer');
    
    if (selectedSequentialBins.length > 0) {
        previewEl.style.display = 'block';
        startBtn.style.display = 'inline-block';
    } else {
        previewEl.style.display = 'none';
        startBtn.style.display = 'none';
    }
}

document.getElementById('start-sequential-transfer').addEventListener('click', async function() {
    const orderId = document.getElementById('sequential_order_id').value;
    const sourceBinId = document.getElementById('sequential_source_bin').value;
    
    if (!orderId || !sourceBinId || selectedSequentialBins.length === 0) {
        alert('Please select order, source bin, and at least one destination bin');
        return;
    }
    
    const quantityType = document.querySelector('input[name="transfer_quantity_type"]:checked').value;
    let transferQuantity = null;
    
    if (quantityType === 'custom') {
        const customQty = parseFloat(document.getElementById('custom_transfer_quantity').value);
        if (!customQty || customQty <= 0) {
            alert('Please enter a valid custom quantity');
            return;
        }
        transferQuantity = customQty;
    }
    
    try {
        const requestBody = { 
            order_id: parseInt(orderId), 
            source_bin_id: parseInt(sourceBinId),
            destination_sequence: selectedSequentialBins
        };
        
        if (transferQuantity) {
            requestBody.transfer_quantity = transferQuantity;
        }
        
        const response = await fetch(`${API_URL}/api/transfers/sequential`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        const messageEl = document.getElementById('sequential-message');
        
        if (result.success) {
            messageEl.className = 'message success';
            let detailMsg = `Transfer completed! ${result.data.total_quantity} tons transferred. Remaining in source: ${result.data.remaining_in_source} tons.`;
            if (result.data.distribution_details) {
                detailMsg += '\n\nDistribution:';
                result.data.distribution_details.forEach(d => {
                    detailMsg += `\n• ${d.bin_name}: ${d.transferred} tons`;
                });
            }
            messageEl.textContent = detailMsg;
            messageEl.style.whiteSpace = 'pre-line';
            
            document.getElementById('start-sequential-transfer').style.display = 'none';
            document.getElementById('stop-sequential-transfer').style.display = 'none';
            
            setTimeout(() => {
                showTab('orders', document.querySelector('[onclick*="orders"]'));
            }, 3000);
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = `Error: ${result.error}`;
        }
    } catch (error) {
        const messageEl = document.getElementById('sequential-message');
        messageEl.className = 'message error';
        messageEl.textContent = `Error: ${error.message}`;
    }
});

// GRINDING MODULE

async function initGrindingModule() {
    try {
        const binsResponse = await fetch(`${API_URL}/api/bins`);
        const binsResult = await binsResponse.json();
        
        if (!binsResult.success) return;
        
        const filled12HRBins = binsResult.data.filter(b => b.bin_type === '12HR' && b.current_quantity > 0);
        
        if (filled12HRBins.length === 0) {
            document.getElementById('grinding-order-info').innerHTML = '<p>No 12HR bins with wheat available. Complete 24→12 transfer first.</p>';
            return;
        }
        
        const ordersResponse = await fetch(`${API_URL}/api/orders`);
        const ordersResult = await ordersResponse.json();
        
        if (!ordersResult.success) return;
        
        const completedOrders = ordersResult.data.filter(o => o.production_stage === 'TRANSFER_24_TO_12_COMPLETED');
        
        if (completedOrders.length > 0) {
            const order = completedOrders[0];
            
            document.getElementById('grinding-order-info').innerHTML = `
                <h4>Auto-Linked Order (Read-Only)</h4>
                <p><strong>Order Number:</strong> ${order.order_number}</p>
                <p><strong>Product:</strong> ${order.product_type}</p>
                <p><strong>Total Quantity:</strong> ${order.quantity} tons</p>
                <p><strong>Status:</strong> <span class="status-badge">${order.production_stage}</span></p>
            `;
            document.getElementById('grinding-order-info').style.display = 'block';
            
            document.getElementById('grinding-bin-info').innerHTML = `
                <h4>Source 12HR Bins (Sequential Usage)</h4>
                ${filled12HRBins.map((bin, index) => `
                    <p><strong>Bin ${index + 1}:</strong> ${bin.bin_name} (${bin.identity_number}) - ${bin.current_quantity.toFixed(2)} tons</p>
                `).join('')}
            `;
            
            document.getElementById('grinding-controls').style.display = 'block';
            
            window.currentGrindingOrder = order;
            window.current12HRBins = filled12HRBins;
        }
    } catch (error) {
        console.error('Error initializing grinding:', error);
    }
}

document.getElementById('start-grinding').addEventListener('click', async function() {
    if (!window.currentGrindingOrder) {
        alert('No order detected');
        return;
    }
    
    if (!confirm('Start grinding process? This will enable hourly report entry.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/grinding/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                order_id: window.currentGrindingOrder.id,
                bin_ids: window.current12HRBins.map(b => b.id)
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('start-grinding').style.display = 'none';
            document.getElementById('stop-grinding').style.display = 'inline-block';
            document.getElementById('hourly-reports-section').style.display = 'block';
            
            window.currentGrindingJobId = result.data.grinding_job_id;
            
            const messageEl = document.getElementById('grinding-message');
            messageEl.className = 'message success';
            messageEl.textContent = 'Grinding started! Add hourly reports below.';
            
            loadHourlyReports();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

document.getElementById('stop-grinding').addEventListener('click', async function() {
    if (!confirm('Stop grinding process? No more hourly reports can be added after stopping.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/grinding/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                grinding_job_id: window.currentGrindingJobId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('stop-grinding').style.display = 'none';
            document.getElementById('start-grinding').style.display = 'inline-block';
            
            const messageEl = document.getElementById('grinding-message');
            messageEl.className = 'message success';
            messageEl.textContent = `Grinding stopped. Duration: ${result.data.duration_hours.toFixed(2)} hours.`;
            
            loadProductionSummary();
            
            document.querySelectorAll('.hourly-report-card input').forEach(input => {
                input.disabled = true;
            });
            document.querySelectorAll('.hourly-report-card button').forEach(btn => {
                btn.disabled = true;
            });
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

function loadHourlyReports() {
    const container = document.getElementById('hourly-reports-container');
    container.innerHTML = `
        <button onclick="addHourlyReportRow()" class="add-bin-btn">+ Add Hourly Report</button>
        <div id="reports-list"></div>
    `;
}

function addHourlyReportRow() {
    const reportsList = document.getElementById('reports-list');
    const reportNumber = reportsList.children.length + 1;
    
    const reportCard = document.createElement('div');
    reportCard.className = 'hourly-report-card';
    reportCard.id = `report-${reportNumber}`;
    reportCard.innerHTML = `
        <h4>Hour ${reportNumber}</h4>
        <div class="report-grid">
            <div class="report-input-group">
                <label>Start Time:</label>
                <input type="time" id="start_time_${reportNumber}" required>
            </div>
            <div class="report-input-group">
                <label>End Time:</label>
                <input type="time" id="end_time_${reportNumber}" required>
            </div>
        </div>
        <div class="report-grid">
            <div class="report-input-group">
                <label>Maida (tons):</label>
                <input type="number" step="0.01" id="maida_${reportNumber}" onchange="calculateReport(${reportNumber})">
            </div>
            <div class="report-input-group">
                <label>Suji (tons):</label>
                <input type="number" step="0.01" id="suji_${reportNumber}" onchange="calculateReport(${reportNumber})">
            </div>
            <div class="report-input-group">
                <label>Chakki Ata (tons):</label>
                <input type="number" step="0.01" id="chakki_${reportNumber}" onchange="calculateReport(${reportNumber})">
            </div>
            <div class="report-input-group">
                <label>Tandoori (tons):</label>
                <input type="number" step="0.01" id="tandoori_${reportNumber}" onchange="calculateReport(${reportNumber})">
            </div>
        </div>
        <div class="report-grid">
            <div class="report-input-group">
                <label>Main Total (tons):</label>
                <input type="number" step="0.01" id="main_total_${reportNumber}" readonly>
            </div>
            <div class="report-input-group">
                <label>Bran (tons):</label>
                <input type="number" step="0.01" id="bran_${reportNumber}" readonly>
            </div>
            <div class="report-input-group">
                <label>Grand Total (tons):</label>
                <input type="number" step="0.01" id="grand_total_${reportNumber}" readonly>
            </div>
        </div>
        <div id="validation_${reportNumber}"></div>
        <button onclick="submitHourlyReport(${reportNumber})" class="btn-primary" style="margin-top: 15px;">Submit Report ${reportNumber}</button>
    `;
    reportsList.appendChild(reportCard);
}

function calculateReport(reportNumber) {
    const maida = parseFloat(document.getElementById(`maida_${reportNumber}`).value) || 0;
    const suji = parseFloat(document.getElementById(`suji_${reportNumber}`).value) || 0;
    const chakki = parseFloat(document.getElementById(`chakki_${reportNumber}`).value) || 0;
    const tandoori = parseFloat(document.getElementById(`tandoori_${reportNumber}`).value) || 0;
    
    const mainTotal = maida + suji + chakki + tandoori;
    const grandTotal = mainTotal / 0.75;
    const bran = grandTotal - mainTotal;
    
    document.getElementById(`main_total_${reportNumber}`).value = mainTotal.toFixed(2);
    document.getElementById(`bran_${reportNumber}`).value = bran.toFixed(2);
    document.getElementById(`grand_total_${reportNumber}`).value = grandTotal.toFixed(2);
    
    const branPercent = (bran / grandTotal) * 100;
    const validationEl = document.getElementById(`validation_${reportNumber}`);
    
    if (branPercent >= 23 && branPercent <= 25) {
        validationEl.className = 'validation-success';
        validationEl.textContent = `✓ Bran percentage: ${branPercent.toFixed(2)}% (Ideal range: 23-25%)`;
    } else {
        validationEl.className = 'validation-warning';
        validationEl.textContent = `⚠ Bran percentage: ${branPercent.toFixed(2)}% (Outside ideal range: 23-25%)`;
    }
}

async function submitHourlyReport(reportNumber) {
    const startTime = document.getElementById(`start_time_${reportNumber}`).value;
    const endTime = document.getElementById(`end_time_${reportNumber}`).value;
    const maida = parseFloat(document.getElementById(`maida_${reportNumber}`).value) || 0;
    const suji = parseFloat(document.getElementById(`suji_${reportNumber}`).value) || 0;
    const chakki = parseFloat(document.getElementById(`chakki_${reportNumber}`).value) || 0;
    const tandoori = parseFloat(document.getElementById(`tandoori_${reportNumber}`).value) || 0;
    const mainTotal = parseFloat(document.getElementById(`main_total_${reportNumber}`).value) || 0;
    const bran = parseFloat(document.getElementById(`bran_${reportNumber}`).value) || 0;
    const grandTotal = parseFloat(document.getElementById(`grand_total_${reportNumber}`).value) || 0;
    
    if (!startTime || !endTime) {
        alert('Please enter start and end times');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/grinding/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grinding_job_id: window.currentGrindingJobId,
                report_number: reportNumber,
                start_time: startTime,
                end_time: endTime,
                maida_tons: maida,
                suji_tons: suji,
                chakki_ata_tons: chakki,
                tandoori_tons: tandoori,
                main_total_tons: mainTotal,
                bran_tons: bran,
                grand_total_tons: grandTotal
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const messageEl = document.getElementById('grinding-message');
            messageEl.className = 'message success';
            messageEl.textContent = `Report ${reportNumber} submitted successfully!`;
            
            document.querySelectorAll(`#report-${reportNumber} input`).forEach(input => {
                input.disabled = true;
            });
            document.querySelector(`#report-${reportNumber} button`).disabled = true;
            
            loadProductionSummary();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function loadProductionSummary() {
    if (!window.currentGrindingJobId) return;
    
    try {
        const response = await fetch(`${API_URL}/api/grinding/summary/${window.currentGrindingJobId}`);
        const result = await response.json();
        
        if (result.success && result.data.reports.length > 0) {
            const summary = result.data.summary;
            
            document.getElementById('summary-content').innerHTML = `
                <div class="summary-grid">
                    <div class="summary-card">
                        <h5>Maida</h5>
                        <div class="value">${summary.total_maida.toFixed(2)} tons</div>
                        <div class="sub-value">${summary.avg_maida_percent.toFixed(1)}%</div>
                    </div>
                    <div class="summary-card">
                        <h5>Suji</h5>
                        <div class="value">${summary.total_suji.toFixed(2)} tons</div>
                        <div class="sub-value">${summary.avg_suji_percent.toFixed(1)}%</div>
                    </div>
                    <div class="summary-card">
                        <h5>Chakki Ata</h5>
                        <div class="value">${summary.total_chakki.toFixed(2)} tons</div>
                        <div class="sub-value">${summary.avg_chakki_percent.toFixed(1)}%</div>
                    </div>
                    <div class="summary-card">
                        <h5>Bran</h5>
                        <div class="value">${summary.total_bran.toFixed(2)} tons</div>
                        <div class="sub-value">${summary.avg_bran_percent.toFixed(1)}%</div>
                    </div>
                </div>
                <div class="hourly-breakdown">
                    <h4>Hourly Breakdown</h4>
                    ${result.data.reports.map(r => `
                        <div class="hourly-breakdown-item">
                            <div class="time-range">Hour ${r.report_number} (${r.start_time} - ${r.end_time}) <span class="status-submitted">✓ Submitted</span></div>
                            <div class="products">
                                <span>Maida: ${r.maida_tons}t</span>
                                <span>Suji: ${r.suji_tons}t</span>
                                <span>Chakki: ${r.chakki_ata_tons}t</span>
                                <span>Bran: ${r.bran_tons}t</span>
                                <span>Total: ${r.grand_total_tons}t</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            document.getElementById('production-summary').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

loadOrders();
