# Flour Mill ERP System

## Overview
A production planning and management system for flour mills. This web application helps manage production orders and create detailed production plans with blend configuration and destination distribution. The system includes master configuration for products and bins to provide flexibility in production management.

## Project Architecture

### Technology Stack
- **Backend**: Node.js with Express.js
- **Database**: SQLite (better-sqlite3)
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Server Port**: 5000 (frontend accessible via web preview)

### Database Schema

#### Tables:
1. **orders** - Stores production orders
   - id, order_number, product_type, quantity, production_stage, created_at

2. **production_plans** - Stores production plan configurations
   - id, order_id, plan_name, plan_status, created_at

3. **plan_source_blend** - Stores blend percentages from source bins
   - id, plan_id, source_bin_id, blend_percentage, blend_quantity

4. **plan_destination_distribution** - Stores distribution to destination bins
   - id, plan_id, destination_bin_id, distribution_quantity

5. **bins** - Stores bin information
   - id, bin_name, bin_type, capacity, current_quantity, identity_number
   - Pre-initialized with 6 bins (3 PRE_CLEAN, 3 24HR)

6. **products** - Stores product master data
   - id, product_name, initial_name, created_at
   - Pre-initialized with 4 products (Wheat Flour, Maida, Suji, Atta)

## Features

### Products Master Configuration
- Add new products with product name and initial name (e.g., "WF" for Wheat Flour)
- View all configured products
- Product initials are used for quick reference in order creation
- Products dynamically populate the Create Order form

### Bins Master Configuration
- Add new bins with:
  - Bin name
  - Bin type (PRE_CLEAN, 24HR, STORAGE, OTHER)
  - Capacity in tons
  - Current quantity
  - Identity number (e.g., PC-01, 24HR-01)
- View all configured bins
- Bins dynamically populate the Create Plan form based on their type

### Stage 1: Create Order
- Create production orders with order number, product type, and quantity
- Product types are loaded dynamically from Products Master
- Orders start with status "CREATED"
- Products show their initial names for easy reference

### Stage 2: Create Production Plan
- Define blend configuration from available PRE_CLEAN bins (percentages must sum to 100%)
- Define distribution to available 24HR bins (quantities must sum to order total)
- Bins are loaded dynamically based on their type
- Automatic validation of percentages and quantities
- Updates order status to "PLANNED" upon successful plan creation
- Supports any number of source and destination bins

## API Endpoints

### Orders
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create a new order
- `GET /api/orders/:id` - Get specific order

### Bins
- `GET /api/bins` - Get all bins
- `POST /api/bins` - Add a new bin
- `PUT /api/bins/:id` - Update a bin

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Add a new product

### Plans
- `POST /api/plans` - Create production plan
- `GET /api/plans/:order_id` - Get plans for an order

## File Structure
```
/
├── server.js           # Express server and API endpoints
├── database.js         # Database initialization and schema
├── package.json        # Project dependencies
├── public/
│   ├── index.html     # Main UI interface with 5 tabs
│   ├── style.css      # Styling with master configuration styles
│   └── app.js         # Frontend logic with dynamic data loading
└── flour_mill.db      # SQLite database file
```

## Recent Changes (November 4, 2025)
- Added Products Master configuration for managing product catalog
- Added Bins Master configuration for managing bin inventory
- Updated database schema with products table and identity_number field for bins
- Made Create Order form load products dynamically from database
- Made Create Plan form load bins dynamically based on bin type (PRE_CLEAN/24HR)
- Enhanced UI with master configuration tabs
- Improved flexibility by removing hardcoded product and bin options

## Running the Application
- The application runs automatically via the configured workflow
- Access via the web preview on port 5000
- No manual configuration required
- Pre-initialized with sample products and bins for easy start
