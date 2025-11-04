# Flour Mill ERP System

## Overview
A production planning and management system for flour mills. This web application helps manage production orders and create detailed production plans with blend configuration and destination distribution.

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

3. **plan_source_blend** - Stores blend percentages from pre-cleaning bins
   - id, plan_id, source_bin_id, blend_percentage, blend_quantity

4. **plan_destination_distribution** - Stores distribution to 24HR bins
   - id, plan_id, destination_bin_id, distribution_quantity

5. **bins** - Stores bin information (pre-initialized with 6 bins)
   - Pre-Clean Bins 1-3, 24HR Bins 1-3

## Features

### Stage 1: Create Order
- Create production orders with order number, product type, and quantity
- Orders start with status "CREATED"
- Supported products: Wheat Flour, Maida, Suji, Atta

### Stage 2: Create Production Plan
- Define blend configuration from 3 pre-cleaning bins (percentages must sum to 100%)
- Define distribution to 3 24HR bins (quantities must sum to order total)
- Automatic validation of percentages and quantities
- Updates order status to "PLANNED" upon successful plan creation

## API Endpoints

- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create a new order
- `GET /api/orders/:id` - Get specific order
- `GET /api/bins` - Get all bins
- `POST /api/plans` - Create production plan
- `GET /api/plans/:order_id` - Get plans for an order

## File Structure
```
/
├── server.js           # Express server and API endpoints
├── database.js         # Database initialization and schema
├── package.json        # Project dependencies
├── public/
│   ├── index.html     # Main UI interface
│   ├── style.css      # Styling
│   └── app.js         # Frontend logic
└── flour_mill.db      # SQLite database file
```

## Recent Changes (November 4, 2025)
- Initial project setup
- Created database schema with all required tables
- Implemented Stage 1 (Create Order) functionality
- Implemented Stage 2 (Create Plan) with validation
- Added real-time validation for blend percentages and distribution quantities
- Configured workflow for production deployment

## Running the Application
- The application runs automatically via the configured workflow
- Access via the web preview on port 5000
- No manual configuration required
