const API_URL = window.location.origin;

let sourceBins = [];
let destinationBins = [];
let allBins = [];

const transferTimers = {};

function startTimer(transferKey, timerElement) {
    const startTime = Date.now();
    transferTimers[transferKey] = {
        startTime: startTime,
        interval: setInterval(() => {
            const elapsed = Date.now() - startTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000)
    };
}

function stopTimer(transferKey) {
    if (transferTimers[transferKey]) {
        clearInterval(transferTimers[transferKey].interval);
        const elapsed = Date.now() - transferTimers[transferKey].startTime;
        delete transferTimers[transferKey];
        return elapsed;
    }
    return 0;
}

function formatDuration(milliseconds) {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

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
    } else if (tabName === 'finished-goods-master') {
        loadFinishedGoods();
    } else if (tabName === 'raw-products-master') {
        loadRawProducts();
    } else if (tabName === 'bins-master') {
        loadBins();
    } else if (tabName === 'timeline') {
        loadOrdersForTimeline();
    } else if (tabName === 'godowns-master') {
        loadGodowns();
    } else if (tabName === 'shallows-master') {
        loadShallows();
    } else if (tabName === 'packaging') {
        initPackaging();
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
        const response = await fetch(`${API_URL}/api/finished-goods`);
        const result = await response.json();

        const select = document.getElementById('product_type');

        if (result.success && result.data.length > 0) {
            select.innerHTML = '<option value="">Select Product</option>' + 
                result.data.map(product => 
                    `<option value="${product.product_name}">${product.product_name} (${product.initial_name})</option>`
                ).join('');
        } else {
            select.innerHTML = '<option value="">No finished goods found. Add products in Finished Goods Master</option>';
        }
    } catch (error) {
        console.error('Error loading finished goods:', error);
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
        description: document.getElementById('plan_description').value,
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
            messageEl.textContent = `Production plan created successfully! Order status updated to PLANNED.`;
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

// Load Finished Goods
async function loadFinishedGoods() {
    try {
        const response = await fetch(`${API_URL}/api/finished-goods`);
        const result = await response.json();

        const listEl = document.getElementById('finished-goods-list');

        if (result.success && result.data.length > 0) {
            listEl.innerHTML = result.data.map(product => `
                <div class="item-card">
                    <div class="item-info">
                        <p><strong>Product:</strong> ${product.product_name}</p>
                        <p><strong>Initial:</strong> ${product.initial_name}</p>
                    </div>
                    <div class="item-actions">
                        <button class="btn-edit" onclick="editFinishedGood(${product.id}, '${product.product_name}', '${product.initial_name}')">Edit</button>
                        <button class="btn-delete" onclick="deleteFinishedGood(${product.id}, '${product.product_name}')">Delete</button>
                    </div>
                </div>
            `).join('');
        } else {
            listEl.innerHTML = '<p style="text-align: center; color: #666;">No finished goods yet. Add your first finished good!</p>';
        }
    } catch (error) {
        console.error('Error loading finished goods:', error);
    }
}

async function editFinishedGood(id, productName, initialName) {
    const newProductName = prompt('Edit Product Name:', productName);
    const newInitialName = prompt('Edit Initial Name:', initialName);
    
    if (!newProductName || !newInitialName) {
        alert('Both fields are required');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/finished-goods/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_name: newProductName, initial_name: newInitialName })
        });

        const result = await response.json();
        if (result.success) {
            alert('Finished good updated successfully!');
            loadFinishedGoods();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteFinishedGood(id, productName) {
    if (!confirm(`Delete "${productName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/finished-goods/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
            alert('Finished good deleted successfully!');
            loadFinishedGoods();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Load Raw Products
async function loadRawProducts() {
    try {
        const response = await fetch(`${API_URL}/api/raw-products`);
        const result = await response.json();

        const listEl = document.getElementById('raw-products-list');

        if (result.success && result.data.length > 0) {
            listEl.innerHTML = result.data.map(product => `
                <div class="item-card">
                    <div class="item-info">
                        <p><strong>Product:</strong> ${product.product_name}</p>
                    </div>
                    <div class="item-actions">
                        <button class="btn-edit" onclick="editRawProduct(${product.id}, '${product.product_name}')">Edit</button>
                        <button class="btn-delete" onclick="deleteRawProduct(${product.id}, '${product.product_name}')">Delete</button>
                    </div>
                </div>
            `).join('');
        } else {
            listEl.innerHTML = '<p style="text-align: center; color: #666;">No raw products yet. Add your first raw product!</p>';
        }
    } catch (error) {
        console.error('Error loading raw products:', error);
    }
}

async function editRawProduct(id, productName) {
    const newProductName = prompt('Edit Product Name:', productName);
    
    if (!newProductName) {
        alert('Product name is required');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/raw-products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_name: newProductName })
        });

        const result = await response.json();
        if (result.success) {
            alert('Raw product updated successfully!');
            loadRawProducts();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteRawProduct(id, productName) {
    if (!confirm(`Delete "${productName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/raw-products/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
            alert('Raw product deleted successfully!');
            loadRawProducts();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Backward compatibility
async function loadProducts() {
    loadFinishedGoods();
}

// Finished Goods Form Handler
if (document.getElementById('finished-good-form')) {
    document.getElementById('finished-good-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const productData = {
            product_name: document.getElementById('finished_good_name').value,
            initial_name: document.getElementById('finished_good_initial').value
        };

        try {
            const response = await fetch(`${API_URL}/api/finished-goods`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });

            const result = await response.json();
            const messageEl = document.getElementById('finished-good-message');

            if (result.success) {
                messageEl.className = 'message success';
                messageEl.textContent = `Finished good "${productData.product_name}" added successfully!`;
                document.getElementById('finished-good-form').reset();
                loadFinishedGoods();
                setTimeout(() => {
                    messageEl.style.display = 'none';
                }, 3000);
            } else {
                messageEl.className = 'message error';
                messageEl.textContent = `Error: ${result.error}`;
            }
        } catch (error) {
            const messageEl = document.getElementById('finished-good-message');
            messageEl.className = 'message error';
            messageEl.textContent = `Error: ${error.message}`;
        }
    });
}

// Raw Products Form Handler
if (document.getElementById('raw-product-form')) {
    document.getElementById('raw-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const productData = {
            product_name: document.getElementById('raw_product_name').value
        };

        try {
            const response = await fetch(`${API_URL}/api/raw-products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });

            const result = await response.json();
            const messageEl = document.getElementById('raw-product-message');

            if (result.success) {
                messageEl.className = 'message success';
                messageEl.textContent = `Raw product "${productData.product_name}" added successfully!`;
                document.getElementById('raw-product-form').reset();
                loadRawProducts();
                setTimeout(() => {
                    messageEl.style.display = 'none';
                }, 3000);
            } else {
                messageEl.className = 'message error';
                messageEl.textContent = `Error: ${result.error}`;
            }
        } catch (error) {
            const messageEl = document.getElementById('raw-product-message');
            messageEl.className = 'message error';
            messageEl.textContent = `Error: ${error.message}`;
        }
    });
}

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
                    <div class="item-actions">
                        <button class="btn-edit" onclick="editBin(${bin.id})">Edit</button>
                        <button class="btn-delete" onclick="deleteBin(${bin.id}, '${bin.bin_name}')">Delete</button>
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

async function editBin(id) {
    try {
        const response = await fetch(`${API_URL}/api/bins/${id}`);
        const result = await response.json();
        
        if (!result.success) {
            alert('Error loading bin data');
            return;
        }
        
        const bin = result.data;
        
        const newBinName = prompt('Edit Bin Name:', bin.bin_name);
        if (!newBinName) return;
        
        const newIdentityNumber = prompt('Edit Identity Number:', bin.identity_number);
        if (!newIdentityNumber) return;
        
        const newCapacity = prompt('Edit Capacity (tons):', bin.capacity);
        if (!newCapacity) return;
        
        const newCurrentQuantity = prompt('Edit Current Quantity (tons):', bin.current_quantity);
        if (newCurrentQuantity === null) return;

        const updateResponse = await fetch(`${API_URL}/api/bins/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bin_name: newBinName,
                bin_type: bin.bin_type,
                capacity: parseFloat(newCapacity),
                current_quantity: parseFloat(newCurrentQuantity),
                identity_number: newIdentityNumber
            })
        });

        const updateResult = await updateResponse.json();
        if (updateResult.success) {
            alert('Bin updated successfully!');
            loadBins();
        } else {
            alert(`Error: ${updateResult.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteBin(id, binName) {
    if (!confirm(`Delete "${binName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/bins/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
            alert('Bin deleted successfully!');
            loadBins();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
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
                        `<option value="${plan.id}" data-order-id="${plan.order_id}">${plan.description || 'Production Plan'} (Order: ${plan.order_number})</option>`
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
                    <h4>Plan: ${plan.description || 'Production Plan'}</h4>
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
                                <div class="timer-display" style="display: none;">
                                    <span class="timer-label">Duration:</span>
                                    <span class="timer-value">00:00:00</span>
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
                        <h4>Plan: ${plan.description || 'Production Plan'}</h4>
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
    const timerDisplay = item.querySelector('.timer-display');
    const timerValue = item.querySelector('.timer-value');

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
            
            timerDisplay.style.display = 'block';
            const transferKey = `blended-${destBinId}-${planId}`;
            startTimer(transferKey, timerValue);

            const messageEl = document.getElementById('blended-message');
            messageEl.className = 'message success';
            messageEl.textContent = `Transfer started for bin ${destBinId}. Fill in optional details and click STOP when complete.`;
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
    const timerValue = item.querySelector('.timer-value');

    if (!confirm('Stop the transfer for this bin?')) {
        return;
    }

    stopBtn.disabled = true;
    statusValue.textContent = 'Stopping...';
    
    const transferKey = `blended-${destBinId}-${planId}`;
    const elapsedMillis = stopTimer(transferKey);

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
            
            timerValue.textContent = formatDuration(elapsedMillis);

            const messageEl = document.getElementById('blended-message');
            messageEl.className = 'message success';
            messageEl.textContent = `Transfer completed for bin ${destBinId}: ${result.data.transferred_quantity} tons transferred in ${formatDuration(elapsedMillis)}`;
            setTimeout(() => messageEl.style.display = 'none', 5000);
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

let currentSequentialJobId = null;

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
            source_bin_id: parseInt(sourceBinId)
        };

        if (transferQuantity) {
            requestBody.transfer_quantity = transferQuantity;
        }

        const response = await fetch(`${API_URL}/api/transfers/sequential/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        const messageEl = document.getElementById('sequential-message');

        if (result.success) {
            currentSequentialJobId = result.data.job_id;
            
            messageEl.className = 'message success';
            messageEl.textContent = 'Transfer started! Fill in the optional details below and click STOP when complete.';

            document.getElementById('start-sequential-transfer').style.display = 'none';
            document.getElementById('stop-sequential-transfer').style.display = 'inline-block';
            document.getElementById('sequential-transfer-status').style.display = 'block';
            document.getElementById('sequential-moisture-inputs').style.display = 'block';
            document.getElementById('transfer-status-text').textContent = 'IN PROGRESS';
            document.getElementById('transfer-status-text').className = 'status-value transferring';
            
            const timerDisplay = document.getElementById('sequential-timer-display');
            const timerValue = document.getElementById('sequential-timer-value');
            timerDisplay.style.display = 'block';
            const transferKey = `sequential-${currentSequentialJobId}`;
            startTimer(transferKey, timerValue);
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

document.getElementById('stop-sequential-transfer').addEventListener('click', async function() {
    if (!currentSequentialJobId) {
        alert('No active transfer job found');
        return;
    }

    const orderId = document.getElementById('sequential_order_id').value;
    
    const transferKey = `sequential-${currentSequentialJobId}`;
    const elapsedMillis = stopTimer(transferKey);

    // Get values from input fields
    const outgoingMoisture = document.getElementById('sequential_outgoing_moisture').value;
    const waterAdded = document.getElementById('sequential_water_added').value;

    try {
        const requestBody = { 
            job_id: currentSequentialJobId,
            order_id: parseInt(orderId), 
            destination_sequence: selectedSequentialBins
        };

        if (outgoingMoisture) {
            requestBody.outgoing_moisture = parseFloat(outgoingMoisture);
        }

        if (waterAdded) {
            requestBody.water_added = parseFloat(waterAdded);
        }

        const response = await fetch(`${API_URL}/api/transfers/sequential/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        const messageEl = document.getElementById('sequential-message');

        if (result.success) {
            messageEl.className = 'message success';
            let detailMsg = `Transfer completed! ${result.data.total_transferred} tons transferred in ${formatDuration(elapsedMillis)}.`;
            if (result.data.distribution_details) {
                detailMsg += '\n\nDistribution:';
                result.data.distribution_details.forEach(d => {
                    detailMsg += `\n• ${d.bin_name}: ${d.transferred} tons`;
                });
            }
            if (result.data.outgoing_moisture) {
                detailMsg += `\n\nOutgoing Moisture: ${result.data.outgoing_moisture}%`;
            }
            if (result.data.water_added) {
                detailMsg += `\nWater Added: ${result.data.water_added} liters`;
            }
            messageEl.textContent = detailMsg;
            messageEl.style.whiteSpace = 'pre-line';
            
            const timerValue = document.getElementById('sequential-timer-value');
            timerValue.textContent = formatDuration(elapsedMillis);

            document.getElementById('stop-sequential-transfer').style.display = 'none';
            document.getElementById('sequential-moisture-inputs').style.display = 'none';
            document.getElementById('transfer-status-text').textContent = 'COMPLETED';
            document.getElementById('transfer-status-text').className = 'status-value completed';

            // Clear input fields
            document.getElementById('sequential_outgoing_moisture').value = '';
            document.getElementById('sequential_water_added').value = '';

            currentSequentialJobId = null;

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

// TIMELINE VIEW

async function loadOrdersForTimeline() {
    try {
        const response = await fetch(`${API_URL}/api/orders`);
        const result = await response.json();

        const select = document.getElementById('timeline_order_id');

        if (result.success && result.data.length > 0) {
            select.innerHTML = '<option value="">Select an order</option>' + 
                result.data.map(order => 
                    `<option value="${order.id}">${order.order_number} - ${order.product_type} (${order.production_stage})</option>`
                ).join('');
        } else {
            select.innerHTML = '<option value="">No orders found</option>';
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const timelineSelect = document.getElementById('timeline_order_id');
    if (timelineSelect) {
        timelineSelect.addEventListener('change', async function() {
            const orderId = this.value;
            if (orderId) {
                await loadTimeline(orderId);
            } else {
                document.getElementById('timeline-container').style.display = 'none';
            }
        });
    }
});

async function loadTimeline(orderId) {
    try {
        const response = await fetch(`${API_URL}/api/timeline/${orderId}`);
        const result = await response.json();

        if (!result.success) {
            alert(`Error: ${result.error}`);
            return;
        }

        const timeline = result.data;
        const container = document.getElementById('timeline-container');
        const infoEl = document.getElementById('timeline-order-info');
        const stagesEl = document.getElementById('timeline-stages');

        // Show order info
        infoEl.innerHTML = `
            <h4>Order: ${timeline.order.order_number}</h4>
            <p><strong>Product:</strong> ${timeline.order.product_type}</p>
            <p><strong>Quantity:</strong> ${timeline.order.quantity} tons</p>
            <p><strong>Current Status:</strong> <span class="status-badge status-${timeline.order.production_stage.toLowerCase()}">${timeline.order.production_stage}</span></p>
            <p><strong>Created:</strong> ${new Date(timeline.order.created_at).toLocaleString()}</p>
        `;

        // Build timeline stages
        let stagesHTML = '';
        let stageNumber = 1;

        // Stage 1: Order Created
        stagesHTML += buildStage(stageNumber++, 'Order Created', 'completed', timeline.order.created_at, null, {
            'Product': timeline.order.product_type,
            'Quantity': `${timeline.order.quantity} tons`,
            'Order Number': timeline.order.order_number
        });

        // Stage 2: Production Plan
        if (timeline.plan) {
            stagesHTML += buildStage(stageNumber++, 'Production Plan Created', 'completed', timeline.plan.created_at, null, {
                'Plan Description': timeline.plan.description || 'Production Plan',
                'Source Bins': `${timeline.plan.source_blend.length} bins blended`,
                'Destination Bins': `${timeline.plan.destination_distribution.length} bins`
            }, buildPlanDetails(timeline.plan));
        } else {
            stagesHTML += buildStage(stageNumber++, 'Production Plan', 'pending', null, null, {
                'Status': 'Awaiting plan creation'
            });
        }

        // Stage 3-4: PRE→24 Transfer
        if (timeline.blended_transfers && timeline.blended_transfers.length > 0) {
            const allCompleted = timeline.blended_transfers.every(t => t.status === 'COMPLETED');
            const anyInProgress = timeline.blended_transfers.some(t => t.status === 'IN_PROGRESS');
            const status = allCompleted ? 'completed' : (anyInProgress ? 'in-progress' : 'pending');

            const completedTransfers = timeline.blended_transfers.filter(t => t.status === 'COMPLETED');
            const totalTransferred = completedTransfers.reduce((sum, t) => sum + t.transferred_quantity, 0);

            stagesHTML += buildStage(stageNumber++, 'Transfer PRE→24 (Blended)', status, 
                timeline.blended_transfers[0].started_at, 
                allCompleted ? timeline.blended_transfers[timeline.blended_transfers.length - 1].completed_at : null, 
                {
                    'Transfer Type': 'Blended (multiple sources)',
                    'Total Transferred': `${totalTransferred.toFixed(2)} tons`,
                    'Completed Bins': `${completedTransfers.length} / ${timeline.blended_transfers.length}`
                }, 
                buildBlendedTransferDetails(timeline.blended_transfers)
            );
        } else if (timeline.plan) {
            stagesHTML += buildStage(stageNumber++, 'Transfer PRE→24 (Blended)', 'pending', null, null, {
                'Status': 'Ready to start transfer'
            });
        }

        // Stage 5-6: 24→12 Transfer
        if (timeline.sequential_transfer) {
            stagesHTML += buildStage(stageNumber++, 'Transfer 24→12 (Sequential)', 'completed', 
                timeline.sequential_transfer.created_at, 
                timeline.sequential_transfer.completed_at, 
                {
                    'Transfer Type': 'Sequential filling',
                    'Total Transferred': `${timeline.sequential_transfer.total_quantity.toFixed(2)} tons`,
                    'Bins Filled': `${timeline.sequential_transfer.details.length} bins`
                }, 
                buildSequentialTransferDetails(timeline.sequential_transfer)
            );
        } else if (timeline.order.production_stage === 'TRANSFER_PRE_TO_24_COMPLETED') {
            stagesHTML += buildStage(stageNumber++, 'Transfer 24→12 (Sequential)', 'pending', null, null, {
                'Status': 'Ready to start transfer'
            });
        }

        // Stage 7-8: Grinding
        if (timeline.grinding) {
            const status = timeline.grinding.grinding_status === 'STARTED' ? 'in-progress' : 'completed';
            stagesHTML += buildStage(stageNumber++, 'Grinding Process', status, 
                timeline.grinding.grinding_start_time, 
                timeline.grinding.grinding_end_time, 
                {
                    'Status': timeline.grinding.grinding_status,
                    'Duration': timeline.grinding.grinding_duration_hours ? `${timeline.grinding.grinding_duration_hours.toFixed(2)} hours` : 'In Progress',
                    'Hourly Reports': `${timeline.grinding.reports.length} submitted`
                }, 
                buildGrindingDetails(timeline.grinding)
            );
        } else if (timeline.order.production_stage === 'TRANSFER_24_TO_12_COMPLETED') {
            stagesHTML += buildStage(stageNumber++, 'Grinding Process', 'pending', null, null, {
                'Status': 'Ready to start grinding'
            });
        }

        stagesEl.innerHTML = stagesHTML;
        container.style.display = 'block';

    } catch (error) {
        console.error('Error loading timeline:', error);
        alert(`Error loading timeline: ${error.message}`);
    }
}

function buildStage(number, title, status, startTime, endTime, details, subDetails = '') {
    const statusClass = status;
    const statusText = status.replace('-', ' ');

    let detailsHTML = '';
    for (const [label, value] of Object.entries(details)) {
        detailsHTML += `
            <div class="timeline-detail">
                <span class="timeline-detail-label">${label}:</span>
                <span class="timeline-detail-value">${value}</span>
            </div>
        `;
    }

    let timeInfo = '';
    if (startTime) {
        timeInfo += `
            <div class="timeline-detail">
                <span class="timeline-detail-label">Started:</span>
                <span class="timeline-detail-value">${new Date(startTime).toLocaleString()}</span>
            </div>
        `;
    }
    if (endTime) {
        timeInfo += `
            <div class="timeline-detail">
                <span class="timeline-detail-label">Completed:</span>
                <span class="timeline-detail-value">${new Date(endTime).toLocaleString()}</span>
            </div>
        `;

        if (startTime) {
            const duration = new Date(endTime) - new Date(startTime);
            const hours = Math.floor(duration / (1000 * 60 * 60));
            const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
            timeInfo += `
                <div class="timeline-duration">
                    ⏱️ Duration: ${hours}h ${minutes}m
                </div>
            `;
        }
    }

    return `
        <div class="timeline-stage ${statusClass}">
            <div class="timeline-stage-header">
                <div class="timeline-stage-title">
                    <span class="timeline-stage-number">${number}</span>
                    ${title}
                </div>
                <span class="timeline-stage-status ${statusClass}">${statusText}</span>
            </div>
            <div class="timeline-stage-content">
                ${detailsHTML}
                ${timeInfo}
                ${subDetails}
            </div>
        </div>
    `;
}

function buildPlanDetails(plan) {
    return `
        <div class="timeline-sub-details">
            <h5>Plan Description: ${plan.description || 'Production Plan'}</h5>
            <h5>Source Blend Configuration:</h5>
            ${plan.source_blend.map(s => `
                <div class="timeline-sub-item">• ${s.bin_name}: ${s.percentage}% (${s.quantity.toFixed(2)} tons)</div>
            `).join('')}

            <h5 style="margin-top: 15px;">Destination Distribution:</h5>
            ${plan.destination_distribution.map(d => `
                <div class="timeline-sub-item">• ${d.bin_name}: ${d.quantity.toFixed(2)} tons</div>
            `).join('')}
        </div>
    `;
}

function buildBlendedTransferDetails(transfers) {
    return `
        <div class="timeline-sub-details">
            <h5>Destination Bins Transfer Status:</h5>
            ${transfers.map(t => `
                <div class="timeline-sub-item">
                    • ${t.bin_name}: ${t.transferred_quantity.toFixed(2)} tons 
                    <span style="color: ${t.status === 'COMPLETED' ? '#10b981' : '#f59e0b'}; font-weight: 600;">
                        (${t.status})
                    </span>
                    ${t.completed_at ? ` - Completed: ${new Date(t.completed_at).toLocaleString()}` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function buildSequentialTransferDetails(transfer) {
    return `
        <div class="timeline-sub-details">
            <h5>Sequential Distribution:</h5>
            ${transfer.details.map((d, idx) => `
                <div class="timeline-sub-item">
                    • Sequence ${idx + 1}: ${d.destination_bin_name} - ${d.quantity_transferred.toFixed(2)} tons
                </div>
            `).join('')}
        </div>
    `;
}

function buildGrindingDetails(grinding) {
    if (grinding.reports.length === 0) {
        return '<div class="timeline-sub-details"><p>No hourly reports submitted yet.</p></div>';
    }

    const summary = grinding.summary;

    return `
        <div class="timeline-sub-details">
            <h5>Production Summary:</h5>
            <div class="timeline-sub-item">• Maida: ${summary.total_maida.toFixed(2)} tons (${summary.avg_maida_percent.toFixed(1)}%)</div>
            <div class="timeline-sub-item">• Suji: ${summary.total_suji.toFixed(2)} tons (${summary.avg_suji_percent.toFixed(1)}%)</div>
            <div class="timeline-sub-item">• Chakki Ata: ${summary.total_chakki.toFixed(2)} tons (${summary.avg_chakki_percent.toFixed(1)}%)</div>
            <div class="timeline-sub-item">• Tandoori: ${summary.total_tandoori.toFixed(2)} tons (${summary.avg_tandoori_percent.toFixed(1)}%)</div>
            <div class="timeline-sub-item">• Bran: ${summary.total_bran.toFixed(2)} tons (${summary.avg_bran_percent.toFixed(1)}%)</div>
            <div class="timeline-sub-item" style="font-weight: 700; margin-top: 10px;">• Grand Total: ${summary.grand_total.toFixed(2)} tons</div>

            <h5 style="margin-top: 15px;">Hourly Reports (${grinding.reports.length} total):</h5>
            ${grinding.reports.map(r => `
                <div class="timeline-sub-item">
                    • Hour ${r.report_number} (${r.start_time} - ${r.end_time}): ${r.grand_total_tons.toFixed(2)} tons
                </div>
            `).join('')}
        </div>
    `;
}

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
                <p class="hint">Enter outgoing moisture and water added for each bin before starting</p>
                ${filled12HRBins.map((bin, index) => `
                    <div class="bin-moisture-card">
                        <div class="bin-header">
                            <strong>Bin ${index + 1}:</strong> ${bin.bin_name} (${bin.identity_number}) - ${bin.current_quantity.toFixed(2)} tons
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Outgoing Moisture (%):</label>
                                <input type="number" id="bin_${bin.id}_moisture" step="0.01" placeholder="e.g., 12.5" class="bin-moisture-input" data-bin-id="${bin.id}">
                            </div>
                            <div class="form-group">
                                <label>Water Added (litres):</label>
                                <input type="number" id="bin_${bin.id}_water" step="0.01" placeholder="e.g., 100" class="bin-water-input" data-bin-id="${bin.id}">
                            </div>
                        </div>
                    </div>
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

    const binMoistureData = {};
    let hasData = false;

    window.current12HRBins.forEach(bin => {
        const moisture = document.getElementById(`bin_${bin.id}_moisture`)?.value;
        const water = document.getElementById(`bin_${bin.id}_water`)?.value;
        
        if (moisture || water) {
            hasData = true;
            binMoistureData[bin.id] = {
                outgoing_moisture: moisture ? parseFloat(moisture) : null,
                water_added: water ? parseFloat(water) : null
            };
        }
    });

    if (!confirm('Start grinding process? This will enable hourly report entry.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/grinding/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                order_id: window.currentGrindingOrder.id,
                bin_ids: window.current12HRBins.map(b => b.id),
                bin_moisture_data: hasData ? binMoistureData : null
            })
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById('start-grinding').style.display = 'none';
            document.getElementById('stop-grinding').style.display = 'inline-block';
            document.getElementById('hourly-reports-section').style.display = 'block';
            document.getElementById('lab-tests-section').style.display = 'block';

            window.currentGrindingJobId = result.data.grinding_job_id;

            const messageEl = document.getElementById('grinding-message');
            messageEl.className = 'message success';
            messageEl.textContent = 'Grinding started! Add hourly reports and lab tests below.';

            loadHourlyReports();
            loadLabTests();
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
            
            document.querySelectorAll('#lab-test-form input, #lab-test-form select, #lab-test-form button').forEach(el => {
                el.disabled = true;
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
                <input type="number" step="0.01" id="maida_${reportNumber}" oninput="calculateReport(${reportNumber})">
            </div>
            <div class="report-input-group">
                <label>Suji (tons):</label>
                <input type="number" step="0.01" id="suji_${reportNumber}" oninput="calculateReport(${reportNumber})">
            </div>
            <div class="report-input-group">
                <label>Chakki Ata (tons):</label>
                <input type="number" step="0.01" id="chakki_${reportNumber}" oninput="calculateReport(${reportNumber})">
            </div>
            <div class="report-input-group">
                <label>Tandoori (tons):</label>
                <input type="number" step="0.01" id="tandoori_${reportNumber}" oninput="calculateReport(${reportNumber})">
            </div>
            <div class="report-input-group">
                <label>Bran (tons):</label>
                <input type="number" step="0.01" id="bran_${reportNumber}" oninput="calculateReport(${reportNumber})">
            </div>
        </div>
        <div class="report-grid">
            <div class="report-input-group">
                <label>Grand Total (tons):</label>
                <input type="number" step="0.01" id="grand_total_${reportNumber}" readonly>
            </div>
        </div>
        <div id="product_summary_${reportNumber}" class="product-summary"></div>
        <button onclick="submitHourlyReport(${reportNumber})" class="btn-primary" style="margin-top: 15px;">Submit Report ${reportNumber}</button>
    `;
    reportsList.appendChild(reportCard);
}

function calculateReport(reportNumber) {
    const maida = parseFloat(document.getElementById(`maida_${reportNumber}`).value) || 0;
    const suji = parseFloat(document.getElementById(`suji_${reportNumber}`).value) || 0;
    const chakki = parseFloat(document.getElementById(`chakki_${reportNumber}`).value) || 0;
    const tandoori = parseFloat(document.getElementById(`tandoori_${reportNumber}`).value) || 0;
    const bran = parseFloat(document.getElementById(`bran_${reportNumber}`).value) || 0;

    const grandTotal = maida + suji + chakki + tandoori + bran;

    document.getElementById(`grand_total_${reportNumber}`).value = grandTotal.toFixed(2);

    const summaryEl = document.getElementById(`product_summary_${reportNumber}`);

    if (grandTotal > 0) {
        const maidaPercent = (maida / grandTotal) * 100;
        const sujiPercent = (suji / grandTotal) * 100;
        const chakkiPercent = (chakki / grandTotal) * 100;
        const tandooriPercent = (tandoori / grandTotal) * 100;
        const branPercent = (bran / grandTotal) * 100;

        summaryEl.innerHTML = `
            <h5>Product Breakdown</h5>
            <div class="product-breakdown-grid">
                <div class="product-item">
                    <span class="product-name">Maida:</span>
                    <span class="product-value">${maida.toFixed(2)} tons (${maidaPercent.toFixed(2)}%)</span>
                </div>
                <div class="product-item">
                    <span class="product-name">Suji:</span>
                    <span class="product-value">${suji.toFixed(2)} tons (${sujiPercent.toFixed(2)}%)</span>
                </div>
                <div class="product-item">
                    <span class="product-name">Chakki Ata:</span>
                    <span class="product-value">${chakki.toFixed(2)} tons (${chakkiPercent.toFixed(2)}%)</span>
                </div>
                <div class="product-item">
                    <span class="product-name">Tandoori:</span>
                    <span class="product-value">${tandoori.toFixed(2)} tons (${tandooriPercent.toFixed(2)}%)</span>
                </div>
                <div class="product-item ${branPercent >= 23 && branPercent <= 25 ? 'valid-bran' : 'warning-bran'}">
                    <span class="product-name">Bran:</span>
                    <span class="product-value">${bran.toFixed(2)} tons (${branPercent.toFixed(2)}%)</span>
                </div>
            </div>
            ${branPercent >= 23 && branPercent <= 25 
                ? `<div class="validation-success">✓ Bran percentage: ${branPercent.toFixed(2)}% (Ideal range: 23-25%)</div>` 
                : `<div class="validation-warning">⚠ Bran percentage: ${branPercent.toFixed(2)}% (Outside ideal range: 23-25%)</div>`
            }
        `;
    } else {
        summaryEl.innerHTML = '';
    }
}

async function submitHourlyReport(reportNumber) {
    const startTime = document.getElementById(`start_time_${reportNumber}`).value;
    const endTime = document.getElementById(`end_time_${reportNumber}`).value;
    const maida = parseFloat(document.getElementById(`maida_${reportNumber}`).value) || 0;
    const suji = parseFloat(document.getElementById(`suji_${reportNumber}`).value) || 0;
    const chakki = parseFloat(document.getElementById(`chakki_${reportNumber}`).value) || 0;
    const tandoori = parseFloat(document.getElementById(`tandoori_${reportNumber}`).value) || 0;
    const bran = parseFloat(document.getElementById(`bran_${reportNumber}`).value) || 0;
    const grandTotal = parseFloat(document.getElementById(`grand_total_${reportNumber}`).value) || 0;

    if (!startTime || !endTime) {
        alert('Please enter start and end times');
        return;
    }

    if (grandTotal === 0) {
        alert('Please enter product quantities');
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
                        <div class="sub-value">${summary.avg_maida_percent.toFixed(2)}%</div>
                    </div>
                    <div class="summary-card">
                        <h5>Suji</h5>
                        <div class="value">${summary.total_suji.toFixed(2)} tons</div>
                        <div class="sub-value">${summary.avg_suji_percent.toFixed(2)}%</div>
                    </div>
                    <div class="summary-card">
                        <h5>Chakki Ata</h5>
                        <div class="value">${summary.total_chakki.toFixed(2)} tons</div>
                        <div class="sub-value">${summary.avg_chakki_percent.toFixed(2)}%</div>
                    </div>
                    <div class="summary-card">
                        <h5>Tandoori</h5>
                        <div class="value">${summary.total_tandoori.toFixed(2)} tons</div>
                        <div class="sub-value">${summary.avg_tandoori_percent.toFixed(2)}%</div>
                    </div>
                    <div class="summary-card">
                        <h5>Bran</h5>
                        <div class="value">${summary.total_bran.toFixed(2)} tons</div>
                        <div class="sub-value">${summary.avg_bran_percent.toFixed(2)}%</div>
                    </div>
                    <div class="summary-card grand-total">
                        <h5>Grand Total</h5>
                        <div class="value">${summary.grand_total.toFixed(2)} tons</div>
                    </div>
                </div>
                <div class="hourly-breakdown">
                    <h4>Hourly Breakdown</h4>
                    ${result.data.reports.map(r => `
                        <div class="hourly-breakdown-item">
                            <div class="time-range">Hour ${r.report_number} (${r.start_time} - ${r.end_time}) <span class="status-submitted">✓ Submitted</span></div>
                            <div class="products">
                                <span>Maida: ${r.maida_tons}t (${r.maida_percent.toFixed(1)}%)</span>
                                <span>Suji: ${r.suji_tons}t (${r.suji_percent.toFixed(1)}%)</span>
                                <span>Chakki: ${r.chakki_ata_tons}t (${r.chakki_ata_percent.toFixed(1)}%)</span>
                                <span>Tandoori: ${r.tandoori_tons}t (${r.tandoori_percent.toFixed(1)}%)</span>
                                <span>Bran: ${r.bran_tons}t (${r.bran_percent.toFixed(1)}%)</span>
                                <span><strong>Total: ${r.grand_total_tons}t</strong></span>
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

async function loadLabTests() {
    if (!window.currentGrindingJobId) return;

    try {
        const response = await fetch(`${API_URL}/api/grinding/lab-tests/${window.currentGrindingJobId}`);
        const result = await response.json();

        const listEl = document.getElementById('lab-tests-list');
        
        if (result.success && result.data.length > 0) {
            listEl.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Time Range</th>
                            <th>Product</th>
                            <th>Moisture (%)</th>
                            <th>Submitted At</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${result.data.map(test => `
                            <tr>
                                <td>${test.start_time} - ${test.end_time}</td>
                                <td>${test.product_type}</td>
                                <td>${test.moisture.toFixed(2)}%</td>
                                <td>${new Date(test.submitted_at).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            listEl.innerHTML = '<p>No lab tests submitted yet.</p>';
        }
    } catch (error) {
        console.error('Error loading lab tests:', error);
    }
}

document.getElementById('lab-test-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!window.currentGrindingJobId) {
        alert('No grinding job active');
        return;
    }
    
    const startTime = document.getElementById('lab_start_time').value;
    const endTime = document.getElementById('lab_end_time').value;
    const productType = document.getElementById('lab_product_type').value;
    const moisture = parseFloat(document.getElementById('lab_moisture').value);
    
    if (!startTime || !endTime || !productType || isNaN(moisture)) {
        alert('Please fill all fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/grinding/lab-test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grinding_job_id: window.currentGrindingJobId,
                start_time: startTime,
                end_time: endTime,
                product_type: productType,
                moisture: moisture
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const messageEl = document.getElementById('lab-test-message');
            messageEl.className = 'message success';
            messageEl.textContent = 'Lab test submitted successfully!';
            
            document.getElementById('lab-test-form').reset();
            
            loadLabTests();
            
            setTimeout(() => {
                messageEl.textContent = '';
            }, 3000);
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

// FINISHED GOODS GODOWN MANAGEMENT
async function loadGodowns() {
    try {
        const response = await fetch(`${API_URL}/api/godowns`);
        const result = await response.json();

        if (result.success) {
            const list = document.getElementById('godowns-list');
            if (result.data.length === 0) {
                list.innerHTML = '<p>No godowns found. Add one above.</p>';
                return;
            }

            list.innerHTML = '<table class="data-table"><thead><tr><th>Godown Name</th><th>Code</th><th>Capacity</th><th>Current Qty</th><th>Available</th><th>Location</th><th>Actions</th></tr></thead><tbody>' +
                result.data.map(g => `
                    <tr>
                        <td>${g.godown_name}</td>
                        <td>${g.godown_code}</td>
                        <td>${g.capacity} tons</td>
                        <td>${g.current_quantity} tons</td>
                        <td>${(g.capacity - g.current_quantity).toFixed(2)} tons</td>
                        <td>${g.location || '-'}</td>
                        <td>
                            <button class="btn-edit" onclick="editGodown(${g.id})">Edit</button>
                            <button class="btn-delete" onclick="deleteGodown(${g.id}, '${g.godown_name}')">Delete</button>
                        </td>
                    </tr>
                `).join('') + '</tbody></table>';
        }
    } catch (error) {
        console.error('Error loading godowns:', error);
    }
}

async function editGodown(id) {
    try {
        const response = await fetch(`${API_URL}/api/godowns/${id}`);
        const result = await response.json();
        
        if (!result.success) {
            alert('Error loading godown data');
            return;
        }
        
        const godown = result.data;
        
        const newGodownName = prompt('Edit Godown Name:', godown.godown_name);
        if (!newGodownName) return;
        
        const newGodownCode = prompt('Edit Godown Code:', godown.godown_code);
        if (!newGodownCode) return;
        
        const newCapacity = prompt('Edit Capacity (tons):', godown.capacity);
        if (!newCapacity) return;
        
        const newLocation = prompt('Edit Location:', godown.location || '');

        const updateResponse = await fetch(`${API_URL}/api/godowns/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                godown_name: newGodownName,
                godown_code: newGodownCode,
                capacity: parseFloat(newCapacity),
                location: newLocation
            })
        });

        const updateResult = await updateResponse.json();
        if (updateResult.success) {
            alert('Godown updated successfully!');
            loadGodowns();
        } else {
            alert(`Error: ${updateResult.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteGodown(id, godownName) {
    if (!confirm(`Delete "${godownName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/godowns/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
            alert('Godown deleted successfully!');
            loadGodowns();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

document.getElementById('godown-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
        godown_name: document.getElementById('godown_name').value,
        godown_code: document.getElementById('godown_code').value,
        capacity: parseFloat(document.getElementById('godown_capacity').value),
        location: document.getElementById('godown_location').value
    };

    try {
        const response = await fetch(`${API_URL}/api/godowns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        const messageEl = document.getElementById('godown-message');

        if (result.success) {
            messageEl.className = 'message success';
            messageEl.textContent = 'Godown added successfully!';
            this.reset();
            loadGodowns();
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = `Error: ${result.error}`;
        }
    } catch (error) {
        const messageEl = document.getElementById('godown-message');
        messageEl.className = 'message error';
        messageEl.textContent = `Error: ${error.message}`;
    }
});

// MAIDA SHALLOWS MANAGEMENT
async function loadShallows() {
    try {
        const response = await fetch(`${API_URL}/api/shallows`);
        const result = await response.json();

        if (result.success) {
            const list = document.getElementById('shallows-list');
            if (result.data.length === 0) {
                list.innerHTML = '<p>No shallows found. Add one above.</p>';
                return;
            }

            list.innerHTML = '<table class="data-table"><thead><tr><th>Shallow Name</th><th>Code</th><th>Capacity</th><th>Current Qty</th><th>Available</th><th>Actions</th></tr></thead><tbody>' +
                result.data.map(s => `
                    <tr>
                        <td>${s.shallow_name}</td>
                        <td>${s.shallow_code}</td>
                        <td>${s.capacity} tons</td>
                        <td>${s.current_quantity} tons</td>
                        <td>${(s.capacity - s.current_quantity).toFixed(2)} tons</td>
                        <td>
                            <button class="btn-edit" onclick="editShallow(${s.id})">Edit</button>
                            <button class="btn-delete" onclick="deleteShallow(${s.id}, '${s.shallow_name}')">Delete</button>
                        </td>
                    </tr>
                `).join('') + '</tbody></table>';

            // Update transfer shallow dropdown
            const transferSelect = document.getElementById('transfer_shallow_id');
            if (transferSelect) {
                transferSelect.innerHTML = '<option value="">Select shallow...</option>' +
                    result.data.map(s => `<option value="${s.id}">${s.shallow_name} (${s.current_quantity}/${s.capacity} tons)</option>`).join('');
            }

            // Update packaging shallow dropdown (for storing TO shallow)
            const packagingSelect = document.getElementById('packaging_shallow_id');
            if (packagingSelect) {
                packagingSelect.innerHTML = '<option value="">Select shallow...</option>' +
                    result.data.map(s => `<option value="${s.id}">${s.shallow_name} (${s.current_quantity} tons available)</option>`).join('');
            }

            // Update packaging shallow source dropdown (for packaging FROM shallow)
            const packagingSourceSelect = document.getElementById('packaging_shallow_source_id');
            if (packagingSourceSelect) {
                packagingSourceSelect.innerHTML = '<option value="">Select shallow...</option>' +
                    result.data.filter(s => s.current_quantity > 0).map(s => `<option value="${s.id}">${s.shallow_name} (${s.current_quantity} tons available)</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Error loading shallows:', error);
    }
}

async function editShallow(id) {
    try {
        const response = await fetch(`${API_URL}/api/shallows/${id}`);
        const result = await response.json();
        
        if (!result.success) {
            alert('Error loading shallow data');
            return;
        }
        
        const shallow = result.data;
        
        const newShallowName = prompt('Edit Shallow Name:', shallow.shallow_name);
        if (!newShallowName) return;
        
        const newShallowCode = prompt('Edit Shallow Code:', shallow.shallow_code);
        if (!newShallowCode) return;
        
        const newCapacity = prompt('Edit Capacity (tons):', shallow.capacity);
        if (!newCapacity) return;

        const updateResponse = await fetch(`${API_URL}/api/shallows/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shallow_name: newShallowName,
                shallow_code: newShallowCode,
                capacity: parseFloat(newCapacity)
            })
        });

        const updateResult = await updateResponse.json();
        if (updateResult.success) {
            alert('Shallow updated successfully!');
            loadShallows();
        } else {
            alert(`Error: ${updateResult.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteShallow(id, shallowName) {
    if (!confirm(`Delete "${shallowName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/shallows/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
            alert('Shallow deleted successfully!');
            loadShallows();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

document.getElementById('shallow-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
        shallow_name: document.getElementById('shallow_name').value,
        shallow_code: document.getElementById('shallow_code').value,
        capacity: parseFloat(document.getElementById('shallow_capacity').value)
    };

    try {
        const response = await fetch(`${API_URL}/api/shallows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        const messageEl = document.getElementById('shallow-message');

        if (result.success) {
            messageEl.className = 'message success';
            messageEl.textContent = 'Shallow added successfully!';
            this.reset();
            loadShallows();
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = `Error: ${result.error}`;
        }
    } catch (error) {
        const messageEl = document.getElementById('shallow-message');
        messageEl.className = 'message error';
        messageEl.textContent = `Error: ${error.message}`;
    }
});

async function transferToShallow() {
    const shallowId = document.getElementById('transfer_shallow_id').value;
    const quantity = parseFloat(document.getElementById('transfer_shallow_quantity').value);
    const messageEl = document.getElementById('shallow-transfer-message');

    if (!shallowId || !quantity || quantity <= 0) {
        messageEl.className = 'message error';
        messageEl.textContent = 'Please select a shallow and enter a valid quantity';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/shallows/${shallowId}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity })
        });

        const result = await response.json();

        if (result.success) {
            messageEl.className = 'message success';
            messageEl.textContent = `Successfully transferred ${quantity} tons to shallow. New quantity: ${result.data.new_quantity} tons`;
            document.getElementById('transfer_shallow_quantity').value = '';
            loadShallows();
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = `Error: ${result.error}`;
        }
    } catch (error) {
        messageEl.className = 'message error';
        messageEl.textContent = `Error: ${error.message}`;
    }
}

// PACKAGING MODULE
async function initPackaging() {
    try {
        // Load orders for packaging
        const ordersResponse = await fetch(`${API_URL}/api/orders`);
        const ordersResult = await ordersResponse.json();

        const packagingSelect = document.getElementById('packaging_order_id');
        if (ordersResult.success && ordersResult.data.length > 0) {
            const completedOrders = ordersResult.data.filter(o => 
                o.production_stage === 'GRINDING_COMPLETED' || 
                o.production_stage === 'PACKAGING_COMPLETED'
            );

            if (completedOrders.length > 0) {
                packagingSelect.innerHTML = '<option value="">Select order...</option>' +
                    completedOrders.map(order => 
                        `<option value="${order.id}" data-product="${order.product_type}">${order.order_number} - ${order.product_type}</option>`
                    ).join('');
            } else {
                packagingSelect.innerHTML = '<option value="">No completed orders available</option>';
            }
        }

        // Load godowns
        const godownsResponse = await fetch(`${API_URL}/api/godowns`);
        const godownsResult = await godownsResponse.json();

        const godownSelect = document.getElementById('packaging_godown_id');
        if (godownsResult.success && godownsResult.data.length > 0) {
            godownSelect.innerHTML = '<option value="">Select godown...</option>' +
                godownsResult.data.map(g => 
                    `<option value="${g.id}">${g.godown_name} (${(g.capacity - g.current_quantity).toFixed(2)} tons available)</option>`
                ).join('');
        }

        // Load shallows
        await loadShallows();
    } catch (error) {
        console.error('Error initializing packaging:', error);
    }
}

// TIMELINE VIEW

async function loadOrdersForTimeline() {
    try {
        const response = await fetch(`${API_URL}/api/orders`);
        const result = await response.json();

        const select = document.getElementById('timeline_order_id');

        if (result.success && result.data.length > 0) {
            select.innerHTML = '<option value="">Select an order</option>' + 
                result.data.map(order => 
                    `<option value="${order.id}">${order.order_number} - ${order.product_type} (${order.production_stage})</option>`
                ).join('');
        } else {
            select.innerHTML = '<option value="">No orders found</option>';
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function togglePackagingSource() {
    const source = document.querySelector('input[name="packaging_source"]:checked');
    const orderSection = document.getElementById('packaging-from-order-section');
    const shallowSection = document.getElementById('packaging-from-shallow-section');

    if (!source) return;

    if (source.value === 'order') {
        orderSection.style.display = 'block';
        shallowSection.style.display = 'none';
        document.getElementById('packaging-details').style.display = 'none';
    } else {
        orderSection.style.display = 'none';
        shallowSection.style.display = 'block';
        document.getElementById('packaging-details').style.display = 'none';
    }
}

document.getElementById('packaging_order_id')?.addEventListener('change', async function() {
    const orderId = this.value;
    const detailsDiv = document.getElementById('packaging-details');

    if (!orderId) {
        detailsDiv.style.display = 'none';
        return;
    }

    try {
        // Get order details
        const orderResponse = await fetch(`${API_URL}/api/orders/${orderId}`);
        const orderResult = await orderResponse.json();

        if (!orderResult.success) {
            alert('Error loading order');
            return;
        }

        const order = orderResult.data;

        // Get grinding job for this order
        const grindingResponse = await fetch(`${API_URL}/api/timeline/${orderId}`);
        const grindingResult = await grindingResponse.json();

        if (!grindingResult.success || !grindingResult.data.grinding) {
            alert('No grinding data found for this order');
            return;
        }

        const grinding = grindingResult.data.grinding;

        document.getElementById('packaging-order-info').innerHTML = `
            <h4>Order Information</h4>
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Product:</strong> ${order.product_type}</p>
            <p><strong>Total Quantity:</strong> ${order.quantity} tons</p>
            <p><strong>Status:</strong> <span class="status-badge">${order.production_stage}</span></p>
        `;

        if (grinding.summary) {
            document.getElementById('grinding-output-summary').innerHTML = `
                <div class="summary-grid">
                    <div class="summary-card">
                        <h5>MAIDA</h5>
                        <div class="value">${grinding.summary.total_maida.toFixed(2)} tons</div>
                    </div>
                    <div class="summary-card">
                        <h5>SUJI</h5>
                        <div class="value">${grinding.summary.total_suji.toFixed(2)} tons</div>
                    </div>
                    <div class="summary-card">
                        <h5>CHAKKI ATA</h5>
                        <div class="value">${grinding.summary.total_chakki.toFixed(2)} tons</div>
                    </div>
                    <div class="summary-card">
                        <h5>TANDOORI</h5>
                        <div class="value">${grinding.summary.total_tandoori.toFixed(2)} tons</div>
                    </div>
                    <div class="summary-card">
                        <h5>BRAN</h5>
                        <div class="value">${grinding.summary.total_bran.toFixed(2)} tons</div>
                    </div>
                    <div class="summary-card grand-total">
                        <h5>TOTAL</h5>
                        <div class="value">${grinding.summary.grand_total.toFixed(2)} tons</div>
                    </div>
                </div>
            `;
        }

        // Load existing packaging records
        const packagingResponse = await fetch(`${API_URL}/api/packaging/${orderId}`);
        const packagingResult = await packagingResponse.json();

        if (packagingResult.success && packagingResult.data.length > 0) {
            document.getElementById('packaging-records').innerHTML = 
                '<table class="data-table"><thead><tr><th>Product</th><th>Shallow</th><th>Bag Size</th><th>Bags</th><th>Total Weight</th><th>Godown</th><th>Status</th></tr></thead><tbody>' +
                packagingResult.data.map(r => `
                    <tr>
                        <td>${r.product_type}</td>
                        <td>${r.shallow_name || '-'}</td>
                        <td>${r.bag_size_kg} kg</td>
                        <td>${r.number_of_bags}</td>
                        <td>${r.total_kg_packed} tons</td>
                        <td>${r.godown_name}</td>
                        <td><span class="status-badge">${r.status}</span></td>
                    </tr>
                `).join('') + '</tbody></table>';
        } else {
            document.getElementById('packaging-records').innerHTML = '<p>No packaging records yet for this order.</p>';
        }

        // Store grinding job ID for packaging submission
        document.getElementById('packaging-details').dataset.grindingJobId = grinding.id;

        detailsDiv.style.display = 'block';
    } catch (error) {
        console.error('Error loading packaging details:', error);
        alert('Error loading order details');
    }
});

function toggleShallowSelection() {
    const packagingSource = document.querySelector('input[name="packaging_source"]:checked');
    if (!packagingSource) return;

    const productType = packagingSource.value === 'order' 
        ? document.getElementById('packaging_product_type').value 
        : 'MAIDA'; // From shallow is always MAIDA

    const maidaOptions = document.getElementById('maida-storage-options');
    const bagSection = document.getElementById('bag-packaging-section');
    const shallowSelectionDiv = document.getElementById('shallow-selection');

    if (packagingSource.value === 'order') {
        if (productType === 'MAIDA') {
            maidaOptions.style.display = 'block';
            bagSection.style.display = 'none';
            if (shallowSelectionDiv) {
                shallowSelectionDiv.style.display = 'none';
            }
            document.querySelectorAll('input[name="maida_storage_method"]').forEach(radio => radio.checked = false);
        } else if (productType) {
            maidaOptions.style.display = 'none';
            bagSection.style.display = 'block';
        } else {
            maidaOptions.style.display = 'none';
            bagSection.style.display = 'none';
        }
    } else {
        // From shallow - always bags
        maidaOptions.style.display = 'none';
        bagSection.style.display = 'block';
    }
}

function toggleMaidaStorageMethod() {
    const selectedMethod = document.querySelector('input[name="maida_storage_method"]:checked');
    const shallowDiv = document.getElementById('shallow-selection');
    const bagSection = document.getElementById('bag-packaging-section');

    if (!selectedMethod) return;

    if (selectedMethod.value === 'shallow') {
        shallowDiv.style.display = 'block';
        bagSection.style.display = 'none';
        // Clear bag fields
        document.getElementById('packaging_bag_size').value = '';
        document.getElementById('packaging_num_bags').value = '';
        document.getElementById('packaging_total_weight').value = '';
    } else {
        shallowDiv.style.display = 'none';
        bagSection.style.display = 'block';
        // Clear shallow fields
        document.getElementById('packaging_shallow_id').value = '';
        if (document.getElementById('shallow_quantity')) {
            document.getElementById('shallow_quantity').value = '';
        }
    }
}

function calculateTotalWeight() {
    const bagSize = parseFloat(document.getElementById('packaging_bag_size').value);
    const numBags = parseInt(document.getElementById('packaging_num_bags').value);

    if (bagSize && numBags) {
        const totalKg = bagSize * numBags;
        const totalTons = totalKg / 1000;
        document.getElementById('packaging_total_weight').value = `${totalTons.toFixed(2)} tons (${totalKg} kg)`;
    } else {
        document.getElementById('packaging_total_weight').value = '';
    }
}

async function submitPackaging() {
    const packagingSource = document.querySelector('input[name="packaging_source"]:checked');
    const messageEl = document.getElementById('packaging-message');

    if (!packagingSource) {
        messageEl.className = 'message error';
        messageEl.textContent = 'Please select a packaging source (Order or Shallow)';
        return;
    }

    let orderId, grindingJobId, productType;

    if (packagingSource.value === 'order') {
        orderId = document.getElementById('packaging_order_id').value;
        grindingJobId = document.getElementById('packaging-details').dataset.grindingJobId;
        productType = document.getElementById('packaging_product_type').value;

        if (!orderId || !productType) {
            messageEl.className = 'message error';
            messageEl.textContent = 'Please select an order and product type';
            return;
        }
    } else {
        // Packaging from shallow - MAIDA only
        productType = 'MAIDA';
        orderId = null;
        grindingJobId = null;
    }

    let packagingData = {
        order_id: orderId ? parseInt(orderId) : null,
        grinding_job_id: grindingJobId ? parseInt(grindingJobId) : null,
        product_type: productType,
        packaging_source: packagingSource.value
    };

    // Check if MAIDA from order and which storage method
    if (productType === 'MAIDA' && packagingSource.value === 'order') {
        const storageMethod = document.querySelector('input[name="maida_storage_method"]:checked');

        if (!storageMethod) {
            messageEl.className = 'message error';
            messageEl.textContent = 'Please select a storage method for MAIDA';
            return;
        }

        if (storageMethod.value === 'shallow') {
            // Storing in shallow (loose, no bags)
            const shallowId = document.getElementById('packaging_shallow_id').value;
            const shallowQty = parseFloat(document.getElementById('shallow_quantity').value);

            if (!shallowId || !shallowQty || shallowQty <= 0) {
                messageEl.className = 'message error';
                messageEl.textContent = 'Please select a shallow and enter quantity';
                return;
            }

            packagingData.shallow_id = parseInt(shallowId);
            packagingData.bag_size_kg = 0; // No bags
            packagingData.number_of_bags = 0; // No bags
            packagingData.total_kg_packed = shallowQty;
            packagingData.godown_id = null; // Not going to godown
        } else {
            // Packaging in bags
            const bagSize = parseFloat(document.getElementById('packaging_bag_size').value);
            const numBags = parseInt(document.getElementById('packaging_num_bags').value);
            const godownId = document.getElementById('packaging_godown_id').value;

            if (!bagSize || !numBags || !godownId) {
                messageEl.className = 'message error';
                messageEl.textContent = 'Please fill bag size, number of bags, and godown';
                return;
            }

            packagingData.shallow_id = null; // Not using shallow
            packagingData.bag_size_kg = bagSize;
            packagingData.number_of_bags = numBags;
            packagingData.total_kg_packed = (bagSize * numBags) / 1000; // Convert kg to tons
            packagingData.godown_id = parseInt(godownId);
        }
    } else if (packagingSource.value === 'shallow') {
        // Packaging from shallow - MAIDA from shallow to bags to godown
        const shallowId = document.getElementById('packaging_shallow_source_id').value;
        const bagSize = parseFloat(document.getElementById('packaging_bag_size').value);
        const numBags = parseInt(document.getElementById('packaging_num_bags').value);
        const godownId = document.getElementById('packaging_godown_id').value;

        if (!shallowId || !bagSize || !numBags || !godownId) {
            messageEl.className = 'message error';
            messageEl.textContent = 'Please select shallow, bag size, number of bags, and godown';
            return;
        }

        packagingData.shallow_id = parseInt(shallowId);
        packagingData.bag_size_kg = bagSize;
        packagingData.number_of_bags = numBags;
        packagingData.total_kg_packed = (bagSize * numBags) / 1000; // Convert kg to tons
        packagingData.godown_id = parseInt(godownId);
    } else {
        // Other products from order - always use bags
        const bagSize = parseFloat(document.getElementById('packaging_bag_size').value);
        const numBags = parseInt(document.getElementById('packaging_num_bags').value);
        const godownId = document.getElementById('packaging_godown_id').value;

        if (!bagSize || !numBags || !godownId) {
            messageEl.className = 'message error';
            messageEl.textContent = 'Please fill bag size, number of bags, and godown';
            return;
        }

        packagingData.shallow_id = null;
        packagingData.bag_size_kg = bagSize;
        packagingData.number_of_bags = numBags;
        packagingData.total_kg_packed = (bagSize * numBags) / 1000; // Convert kg to tons
        packagingData.godown_id = parseInt(godownId);
    }

    try {
        const response = await fetch(`${API_URL}/api/packaging`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(packagingData)
        });

        const result = await response.json();

        if (result.success) {
            messageEl.className = 'message success';
            const source = packagingSource.value === 'order' ? 'grinding output' : 'shallow';
            const destination = packagingData.shallow_id && packagingData.number_of_bags === 0 ? 'shallow' : 'godown';
            const details = packagingData.number_of_bags > 0 
                ? `in ${packagingData.number_of_bags} bags` 
                : 'loose';
            messageEl.textContent = `Successfully packaged ${result.data.total_kg_packed} tons of ${productType} from ${source} ${details} to ${destination}!`;

            // Reset form
            if (document.getElementById('packaging_product_type')) {
                document.getElementById('packaging_product_type').value = '';
            }
            if (document.getElementById('packaging_shallow_id')) {
                document.getElementById('packaging_shallow_id').value = '';
            }
            if (document.getElementById('packaging_shallow_source_id')) {
                document.getElementById('packaging_shallow_source_id').value = '';
            }
            document.getElementById('packaging_bag_size').value = '';
            document.getElementById('packaging_num_bags').value = '';
            document.getElementById('packaging_total_weight').value = '';
            if (document.getElementById('shallow_quantity')) {
                document.getElementById('shallow_quantity').value = '';
            }
            if (document.getElementById('maida-storage-options')) {
                document.getElementById('maida-storage-options').style.display = 'none';
            }
            if (document.getElementById('bag-packaging-section')) {
                document.getElementById('bag-packaging-section').style.display = 'none';
            }
            document.querySelectorAll('input[name="maida_storage_method"]').forEach(radio => radio.checked = false);

            // Reload packaging records if from order
            if (packagingSource.value === 'order') {
                setTimeout(() => {
                    document.getElementById('packaging_order_id').dispatchEvent(new Event('change'));
                }, 500);
            }

            loadShallows();
            loadGodowns();
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = `Error: ${result.error}`;
        }
    } catch (error) {
        messageEl.className = 'message error';
        messageEl.textContent = `Error: ${error.message}`;
    }
}

loadOrders();