# DistroOps — Mini ERP + CRM Operations Portal

> **Full Stack Developer Assignment Solution**  
> Build Time: 48-Hour Case Study  
> Architecture: Node.js + Express + TypeScript (Backend) · React + Vite + TypeScript + CSS System (Frontend) · PostgreSQL / In-Memory (Database)

---

## 🌟 Overview & Key Business Value

**DistroOps** is a dedicated Mini ERP and CRM Operations Portal designed for wholesale and distribution enterprises. The system coordinates sales leads, customer GST records, inventory alerts, and sales challans with atomic stock deductions.

### Core Modules Implemented:
1. **Authentication & Role-Based Access Control (RBAC):** JWT authentication supporting 4 distinct user roles (`Admin`, `Sales`, `Warehouse`, `Accounts`).
2. **Customer CRM Module:** Manage leads/clients with customer classification (`Retail`, `Wholesale`, `Distributor`), status (`Lead`, `Active`, `Inactive`), GST numbers, notes, and CRM follow-up timelines.
3. **Product & Inventory Module:** Catalog management with SKU tracking, minimum stock alert level warnings (`currentStock <= minStockAlert`), location racks, and historical stock movement logs (`IN` / `OUT`).
4. **Sales Challan & Order Fulfillment:** Dynamic multi-item order builder, automatic challan number generation (`CH-1001`), **Product Data Snapshots** (freezing product name, SKU, and price at sales time), **Atomic Stock Deduction** on order confirmation, and **Stock Restoration** upon order cancellation.
5. **Printable Invoice & PDF Export:** Client-side printable invoice view formatted with GST calculations (Subtotal + 18% GST = Grand Total).

---

## 🔐 Test Login Credentials

| Role | Work Email | Password | Allowed Access Scope |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@distroops.com` | `admin123` | **Full system access** across all modules |
| **Sales** | `sales@distroops.com` | `sales123` | Customer CRM, Follow-ups, Create/Edit Draft Challans |
| **Warehouse** | `warehouse@distroops.com` | `warehouse123` | Product catalog, Manual Stock Movements (IN/OUT), Min Stock Alerts |
| **Accounts** | `accounts@distroops.com` | `accounts123` | View Orders, Confirm Challans, Issue Printable Invoices |

*(Note: The login screen features a **"Quick Role Demo Login"** button panel for 1-click evaluation.)*

---

## 🏗️ System Architecture & Data Schema

```
[ Frontend: React + Vite + TS ] --(REST APIs with JWT)--> [ Backend: Express + TS Engine ]
                                                                     |
                                                                [ Data Store ]
                                                           (PostgreSQL / Prisma)
```

### Database Schema (Prisma)
- **User:** `id`, `name`, `email`, `passwordHash`, `role` (`ADMIN`, `SALES`, `WAREHOUSE`, `ACCOUNTS`).
- **Customer:** `id`, `name`, `mobile`, `email`, `businessName`, `gstNumber`, `customerType`, `address`, `status`, `followUpDate`, `notes`.
- **FollowUp:** `id`, `customerId`, `note`, `followUpDate`, `createdById`, `createdAt`.
- **Product:** `id`, `name`, `sku`, `category`, `unitPrice`, `currentStock`, `minStockAlert`, `location`.
- **StockMovement:** `id`, `productId`, `quantityChanged`, `movementType` (`IN`/`OUT`), `reason`, `createdById`, `timestamp`.
- **Challan:** `id`, `challanNumber`, `customerId`, `totalQuantity`, `subtotal`, `status` (`DRAFT`, `CONFIRMED`, `CANCELLED`), `createdById`.
- **ChallanItem:** `id`, `challanId`, `productId`, `productNameSnapshot`, `skuSnapshot`, `unitPriceSnapshot`, `quantity`.

---

## 🚀 How to Run the Project Locally

### Prerequisites
- Node.js (v18.0+)
- npm (v9.0+)

### 1. Run the Backend API Server
```bash
cd backend
npm install
npm run dev
```
*The backend server will start on `http://localhost:4000`.*

### 2. Run the Frontend Web App
```bash
cd frontend
npm install
npm run dev
```
*The React application will launch at `http://localhost:5173`.*

---

## 📡 REST API Reference

All requests require `Authorization: Bearer <token>` (except `/api/auth/login`).

| Module | Method | Endpoint | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/login` | Public | Authenticate user & return JWT token |
| **Auth** | `GET` | `/api/auth/me` | All | Get currently authenticated profile |
| **Customers**| `GET` | `/api/customers` | All | Query customers (`?search=&status=&type=`) |
| **Customers**| `POST` | `/api/customers` | Admin, Sales | Create customer record |
| **Customers**| `POST` | `/api/customers/:id/followups` | Admin, Sales | Add CRM follow-up note & next date |
| **Products** | `GET` | `/api/products` | All | Query catalog (`?lowStock=true`) |
| **Products** | `POST` | `/api/products` | Admin, Warehouse | Create product |
| **Products** | `POST` | `/api/products/:id/stock-movements` | Admin, Warehouse | Record manual stock intake/outlet |
| **Challans** | `POST` | `/api/challans` | Admin, Sales | Create draft challan with snapshot items |
| **Challans** | `POST` | `/api/challans/:id/confirm` | Admin, Sales, Accounts | **Confirm order:** deducts stock & logs audit |
| **Challans** | `POST` | `/api/challans/:id/cancel` | Admin, Sales, Accounts | **Cancel order:** restores stock if confirmed |

*(A complete, ready-to-import Postman Collection is located in `postman/distroops.postman_collection.json`.)*

---

## 🌐 Deployment Instructions (Free Hosting Stack)

1. **Database (Neon Postgres / Render Postgres):**
   - Create a free PostgreSQL instance on Neon (`neon.tech`) or Render (`render.com`).
   - Copy the connection string to `DATABASE_URL`.
2. **Backend Web Service (Render / Railway / Fly.io):**
   - Deploy the `backend` directory.
   - Configure Environment Variables: `PORT=4000`, `JWT_SECRET=your_jwt_secret`, `CORS_ORIGIN=*`.
3. **Frontend Application (Vercel / Netlify):**
   - Deploy the `frontend` directory.
   - Set Build Command: `npm run build` and Output Directory: `dist`.

---

## 💡 Documented Assumptions & Edge Cases Handled

1. **Product Snapshot Integrity:** When products are added to a sales challan, their name, SKU, and unit price are saved as snapshots on `ChallanItem`. Subsequent catalog updates or price changes will never mutate past challans.
2. **Insufficient Inventory Safety Guard:** The `/api/challans/:id/confirm` endpoint verifies stock for **every line item** before applying changes. If any item is short, the entire request fails with a 400 Bad Request error listing exact shortages, guaranteeing stock never goes negative.
3. **Stock Reversal on Cancellation:** Cancelling a `CONFIRMED` sales challan automatically reverses the stock deduction by adding `IN` stock movement logs with the reason `"Stock Restoration - Cancelled Challan"`.
