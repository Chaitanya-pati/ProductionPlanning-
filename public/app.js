const API_URL = window.location.origin;

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
    } else if (tabName === 'create-plan') {
        loadOrdersForPlan();
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
            
            document.querySelectorAll('#dist_1, #dist_2, #dist_3').forEach(input => {
                input.setAttribute('data-total', order.quantity);
            });
        }
    } catch (error) {
        console.error('Error loading order details:', error);
    }
}

function updateBlendTotal() {
    const blend1 = parseFloat(document.getElementById('blend_1').value) || 0;
    const blend2 = parseFloat(document.getElementById('blend_2').value) || 0;
    const blend3 = parseFloat(document.getElementById('blend_3').value) || 0;
    const total = blend1 + blend2 + blend3;
    
    const displayEl = document.getElementById('blend-total');
    displayEl.textContent = `Total: ${total.toFixed(2)}%`;
    
    if (Math.abs(total - 100) < 0.01) {
        displayEl.className = 'total-display valid';
    } else {
        displayEl.className = 'total-display invalid';
    }
}

function updateDistTotal() {
    const dist1 = parseFloat(document.getElementById('dist_1').value) || 0;
    const dist2 = parseFloat(document.getElementById('dist_2').value) || 0;
    const dist3 = parseFloat(document.getElementById('dist_3').value) || 0;
    const total = dist1 + dist2 + dist3;
    
    const orderTotal = parseFloat(document.getElementById('dist_1').getAttribute('data-total')) || 0;
    
    const displayEl = document.getElementById('dist-total');
    displayEl.textContent = `Total: ${total.toFixed(2)} tons (Required: ${orderTotal} tons)`;
    
    if (Math.abs(total - orderTotal) < 0.01 && orderTotal > 0) {
        displayEl.className = 'total-display valid';
    } else {
        displayEl.className = 'total-display invalid';
    }
}

document.querySelectorAll('#blend_1, #blend_2, #blend_3').forEach(input => {
    input.addEventListener('input', updateBlendTotal);
});

document.querySelectorAll('#dist_1, #dist_2, #dist_3').forEach(input => {
    input.addEventListener('input', updateDistTotal);
});

document.getElementById('plan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const orderId = document.getElementById('plan_order_id').value;
    if (!orderId) {
        alert('Please select an order');
        return;
    }
    
    const planData = {
        order_id: parseInt(orderId),
        plan_name: document.getElementById('plan_name').value,
        source_blend: [
            { bin_id: 1, percentage: parseFloat(document.getElementById('blend_1').value) },
            { bin_id: 2, percentage: parseFloat(document.getElementById('blend_2').value) },
            { bin_id: 3, percentage: parseFloat(document.getElementById('blend_3').value) }
        ],
        destination_distribution: [
            { bin_id: 4, quantity: parseFloat(document.getElementById('dist_1').value) },
            { bin_id: 5, quantity: parseFloat(document.getElementById('dist_2').value) },
            { bin_id: 6, quantity: parseFloat(document.getElementById('dist_3').value) }
        ]
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

loadOrders();
