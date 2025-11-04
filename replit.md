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
   - Pre-initialized with 10 bins (3 PRE_CLEAN, 3 24HR, 4 12HR)

6. **products** - Stores product master data
   - id, product_name, initial_name, created_at
   - Pre-initialized with 4 products (Wheat Flour, Maida, Suji, Atta)

7. **transfer_jobs** - Stores transfer job records
   - id, order_id, plan_id, transfer_type, status, total_quantity, created_at, completed_at
   
8. **transfer_blend_details** - Stores blended transfer contribution details
   - id, transfer_job_id, destination_bin_id, source_bin_id, source_contribution_percentage, source_contribution_tons

9. **transfer_sequence_details** - Stores sequential transfer details
   - id, transfer_job_id, source_bin_id, sequence_order, destination_bin_id, destination_bin_sequence, quantity_transferred

10. **destination_bin_transfers** - Tracks individual destination bin transfer states for PRE→24
   - id, order_id, plan_id, destination_bin_id, status, target_quantity, transferred_quantity, started_at, stopped_at, completed_at

## Features

### Products Master Configuration
- Add new products with product name and initial name (e.g., "WF" for Wheat Flour)
- View all configured products
- Product initials are used for quick reference in order creation
- Products dynamically populate the Create Order form

### Bins Master Configuration
- Add new bins with:
  - Bin name
  - Bin type (PRE_CLEAN, 24HR, 12HR, STORAGE, OTHER)
  - Capacity in tons
  - Current quantity
  - Identity number (e.g., PC-01, 24HR-01, 12HR-301)
- View all configured bins
- Bins dynamically populate forms based on their type

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

### Stage 3-4: Transfer PRE→24 (BLENDED with Individual Controls)
- Select a production plan to view all destination 24HR bins
- Individual START/STOP buttons for each destination bin
- Real-time transfer status tracking (NOT STARTED, IN_PROGRESS, STOPPED, COMPLETED)
- Blended transfer calculation: Contribution = Blend Percentage × Destination Quantity
- Automatic bin quantity updates when transfer starts:
  - Deducts from source PRE_CLEAN bins based on contributions
  - Adds combined amounts to destination 24HR bins
- Transfer state tracking in destination_bin_transfers table
- Order status progression:
  - PLANNED → TRANSFER_PRE_TO_24_IN_PROGRESS (when first bin starts)
  - TRANSFER_PRE_TO_24_IN_PROGRESS → TRANSFER_PRE_TO_24_COMPLETED (when all bins complete)
- Plans remain visible in dropdown even when transfer is in progress

### Stage 5-6: Transfer 24→12 (SEQUENTIAL)
- Execute sequential transfer from one 24HR bin to multiple 12HR bins
- Fills each 12HR bin to capacity (25 tons) sequentially in selected order
- User can select which 12HR bins to use via checkboxes
- Remaining quantity stays in source 24HR bin for later transfer
- Updates bin quantities automatically
- Records transfer details in transfer_jobs and transfer_sequence_details tables
- Updates order status to "TRANSFER_24_TO_12_COMPLETED"

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

### Transfers
- `POST /api/transfers/blended/start` - Start blended transfer for a specific destination bin
- `POST /api/transfers/blended/stop` - Stop blended transfer for a specific destination bin
- `GET /api/transfers/blended/status/:planId` - Get status of all destination bin transfers
- `POST /api/transfers/sequential` - Execute sequential transfer (24→12)
- `GET /api/transfers/:orderId` - Get transfer history for an order

## File Structure
```
/
├── server.js           # Express server and API endpoints
├── database.js         # Database initialization and schema
├── package.json        # Project dependencies
├── public/
│   ├── index.html     # Main UI interface with 7 tabs
│   ├── style.css      # Styling with master configuration styles
│   └── app.js         # Frontend logic with dynamic data loading
└── flour_mill.db      # SQLite database file
```

## Recent Changes (November 4, 2025)
- **LATEST**: Enhanced Transfer PRE→24 with Individual START/STOP Controls
  - Removed order selection from Transfer PRE→24 tab, now shows plan selection directly
  - Added individual START/STOP buttons for each destination 24HR bin
  - Created destination_bin_transfers table to track individual bin transfer states
  - Implemented backend endpoints: /api/transfers/blended/start and /api/transfers/blended/stop
  - Added real-time transfer status display showing NOT STARTED, IN_PROGRESS, STOPPED, COMPLETED
  - Fixed critical bug: Plans now remain visible during transfer by including TRANSFER_PRE_TO_24_IN_PROGRESS status in filter
  - Order status progression: PLANNED → TRANSFER_PRE_TO_24_IN_PROGRESS → TRANSFER_PRE_TO_24_COMPLETED
  
- Implemented STAGE 3-4 (Transfer PRE→24 BLENDED) and STAGE 5-6 (Transfer 24→12 SEQUENTIAL)
  - Added 4 database tables: transfer_jobs, transfer_blend_details, transfer_sequence_details, destination_bin_transfers
  - Added 4 pre-initialized 12HR bins (301-304) with 25-ton capacity each
  - Built backend API endpoints for both transfer types with bin quantity updates
  - Created frontend UI tabs for executing transfers
  - Added transfer history tracking
  - Implemented order status progression through transfer stages

- Added Products Master configuration for managing product catalog
- Added Bins Master configuration for managing bin inventory
- Updated database schema with products table and identity_number field for bins
- Made Create Order form load products dynamically from database
- Made Create Plan form load bins dynamically based on bin type (PRE_CLEAN/24HR/12HR)
- Enhanced UI with master configuration tabs
- Improved flexibility by removing hardcoded product and bin options

## Running the Application
- The application runs automatically via the configured workflow
- Access via the web preview on port 5000
- No manual configuration required
- Pre-initialized with sample products and bins for easy start

## Production Workflow
1. **Create Order** - Define order number, product type, and quantity (Status: CREATED)
2. **Create Plan** - Configure source blend (PRE_CLEAN bins) and destination distribution (24HR bins) (Status: PLANNED)
3. **Transfer PRE→24** - Select plan, then individually START/STOP each destination 24HR bin
   - Status: PLANNED → TRANSFER_PRE_TO_24_IN_PROGRESS → TRANSFER_PRE_TO_24_COMPLETED
4. **Transfer 24→12** - Execute sequential transfer from 24HR to 12HR bins (Status: TRANSFER_24_TO_12_COMPLETED)
