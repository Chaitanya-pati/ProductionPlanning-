# Flour Mill ERP System

## Overview
This project is a web-based Production Planning and Management System designed for flour mills. Its primary purpose is to streamline the management of production orders, from initial creation through grinding to final packaging and storage. The system enables detailed production planning, including blend configuration from source bins and distribution to destination bins. Key capabilities include master configuration for products and bins, multi-stage transfer processes (PRE_CLEAN to 24HR, and 24HR to 12HR), comprehensive grinding module with hourly production reporting, and a complete packaging stage with product-specific logic (MAIDA products use temporary shallows before final storage, while other products go directly to finished goods godowns). The system aims to enhance efficiency, provide real-time tracking of production stages, and offer granular control over milling operations, ultimately contributing to better resource utilization and quality control in flour production.

## User Preferences
I want iterative development.
Ask me before making major changes.
I prefer detailed explanations.
I want to be communicated with simple language.
I prefer functional programming.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### Technology Stack
- **Backend**: Node.js with Express.js
- **Database**: SQLite (better-sqlite3)
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Server Port**: 5000

### UI/UX Decisions
- Modern card-based UI design with gradient backgrounds and hover effects for enhanced user experience, particularly in transfer stages.
- Dynamic loading of product and bin configurations into forms for flexibility and ease of use.
- Clear status indicators and interactive controls (e.g., individual START/STOP buttons for transfers, sequential report numbering for grinding).

### Feature Specifications
- **Products Master Configuration**: Manage product types with names and initials.
- **Bins Master Configuration**: Manage various bin types (PRE_CLEAN, 24HR, 12HR, STORAGE, OTHER) with capacity, current quantity, and identity numbers.
- **Order Management**: Create production orders with product type and quantity, tracking status from CREATED to PACKAGING_COMPLETED.
- **Production Planning**: Define source blend percentages from PRE_CLEAN bins and distribution quantities to 24HR bins, with automatic validation.
- **Multi-Stage Transfer Processes**:
    - **PRE→24 (Blended)**: Individual START/STOP controls for each destination 24HR bin, real-time status tracking, and automatic quantity updates.
    - **24→12 (Sequential)**: Sequential filling of selected 12HR bins to capacity, with remaining quantity in the source bin.
- **Grinding Module**: Continuous grinding process with:
    - Auto-detection of orders from filled 12HR bins.
    - Hourly production reporting: submission of quantities for main products and bran, with automatic percentage calculations and validation (e.g., ~25% bran).
    - Production summary: Aggregated totals and average percentages for quality control.
    - Start/Stop grinding functionality with duration tracking.
- **Packaging Module**: Product-specific packaging and storage management with:
    - Auto-detection of orders that have completed grinding.
    - **MAIDA Products**: Two-step process - package to temporary shallows, then transfer to final godowns.
    - **Other Products**: Direct packaging to finished goods godowns.
    - Bag size selection (25kg, 30kg, 50kg) with automatic weight calculations.
    - Real-time inventory tracking for both shallows and godowns.
- **Finished Goods Godown Master**: Manage final storage locations with capacity tracking.
- **MAIDA Shallows Master**: Manage temporary MAIDA storage locations with capacity tracking.
- **API Endpoints**: Comprehensive set of RESTful APIs for managing orders, bins, products, plans, transfers, grinding processes, packaging, godowns, and shallows.

### System Design Choices
- **Modular Database Schema**: A well-structured SQLite database with 17 tables including orders, production plans, bins, products, transfer jobs, grinding jobs, hourly reports, finished goods godowns, MAIDA shallows, packaging records, and storage transfers. This supports clear data separation and relationships across all stages from production planning through packaging and storage.
- **Dynamic Data Handling**: Frontend dynamically populates forms and displays information based on backend data (e.g., product types, bin availability), ensuring configurability and reducing hardcoding.
- **Status-Driven Workflow**: Order status progresses systematically through various stages (CREATED, PLANNED, TRANSFER_PRE_TO_24_IN_PROGRESS, TRANSFER_PRE_TO_24_COMPLETED, TRANSFER_24_TO_12_COMPLETED, GRINDING_IN_PROGRESS, GRINDING_COMPLETED, PACKAGING_COMPLETED), providing clear visibility into the production lifecycle.
- **Automated Calculations & Validations**: The system performs automatic calculations (e.g., blend contributions, percentage calculations in hourly reports) and validations (e.g., sum of percentages/quantities, bran percentage checks) to ensure data integrity and operational accuracy.

## External Dependencies
- **SQLite**: Used as the primary database for persistence, managed via `better-sqlite3`.