# DISTROOPS — Build Plan

Stack: Express.js + TypeScript + Prisma + PostgreSQL (backend) · React + Vite + TypeScript + Tailwind (frontend) · Vercel + Render + Neon (deployment)

---

## 1. Folder Structure

```
distroops/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts                  # loads & validates env vars
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts      # verifies JWT
│   │   │   ├── role.middleware.ts      # requireRole('ADMIN', 'SALES', ...)
│   │   │   ├── error.middleware.ts     # centralized error handler
│   │   │   └── validate.middleware.ts  # runs Zod schemas against req.body
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   └── auth.service.ts
│   │   │   ├── customers/
│   │   │   │   ├── customer.routes.ts
│   │   │   │   ├── customer.controller.ts
│   │   │   │   ├── customer.service.ts
│   │   │   │   └── customer.schema.ts
│   │   │   ├── products/
│   │   │   │   ├── product.routes.ts
│   │   │   │   ├── product.controller.ts
│   │   │   │   ├── product.service.ts
│   │   │   │   └── product.schema.ts
│   │   │   └── challans/
│   │   │       ├── challan.routes.ts
│   │   │       ├── challan.controller.ts
│   │   │       ├── challan.service.ts      # confirm/cancel business logic lives here
│   │   │       └── challan.schema.ts
│   │   ├── lib/
│   │   │   └── prisma.ts               # singleton PrismaClient
│   │   ├── utils/
│   │   │   ├── generateChallanNumber.ts
│   │   │   ├── apiResponse.ts          # consistent { success, data, error } shape
│   │   │   └── pagination.ts
│   │   ├── app.ts                      # express app, middleware wiring
│   │   └── server.ts                   # entrypoint
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts                     # seeds one user per role + sample products
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── api/                        # axios instance + per-module API calls
│   │   │   ├── client.ts
│   │   │   ├── customers.api.ts
│   │   │   ├── products.api.ts
│   │   │   └── challans.api.ts
│   │   ├── components/
│   │   │   ├── layout/ (Sidebar, Topbar, ProtectedRoute)
│   │   │   └── ui/ (Table, Modal, Badge, FormInput)
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── customers/ (CustomerList, CustomerDetail, CustomerForm)
│   │   │   ├── products/ (ProductList, ProductForm, StockLog)
│   │   │   └── challans/ (ChallanList, ChallanForm, ChallanDetail)
│   │   ├── hooks/ (useAuth, useCustomers, useProducts, useChallans)
│   │   ├── context/AuthContext.tsx
│   │   ├── routes/AppRoutes.tsx
│   │   ├── types/ (shared TS interfaces, mirrors backend Zod schemas)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
│
├── postman/
│   └── distroops.postman_collection.json
└── README.md
```

---

## 2. Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  SALES
  WAREHOUSE
  ACCOUNTS
}

enum CustomerType {
  RETAIL
  WHOLESALE
  DISTRIBUTOR
}

enum CustomerStatus {
  LEAD
  ACTIVE
  INACTIVE
}

enum MovementType {
  IN
  OUT
}

enum ChallanStatus {
  DRAFT
  CONFIRMED
  CANCELLED
}

model User {
  id            String          @id @default(uuid())
  name          String
  email         String          @unique
  passwordHash  String
  role          Role
  createdAt     DateTime        @default(now())

  followUps     FollowUp[]
  stockMovements StockMovement[]
  challans      Challan[]
}

model Customer {
  id            String          @id @default(uuid())
  name          String
  mobile        String
  email         String?
  businessName  String?
  gstNumber     String?
  customerType  CustomerType
  address       String?
  status        CustomerStatus  @default(LEAD)
  followUpDate  DateTime?
  notes         String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  followUps     FollowUp[]
  challans      Challan[]
}

model FollowUp {
  id            String    @id @default(uuid())
  customerId    String
  customer      Customer  @relation(fields: [customerId], references: [id])
  note          String
  followUpDate  DateTime?
  createdById   String
  createdBy     User      @relation(fields: [createdById], references: [id])
  createdAt     DateTime  @default(now())
}

model Product {
  id              String          @id @default(uuid())
  name            String
  sku             String          @unique
  category        String?
  unitPrice       Decimal
  currentStock    Int             @default(0)
  minStockAlert   Int             @default(0)
  location        String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  stockMovements  StockMovement[]
  challanItems    ChallanItem[]
}

model StockMovement {
  id              String        @id @default(uuid())
  productId       String
  product         Product       @relation(fields: [productId], references: [id])
  quantityChanged Int
  movementType    MovementType
  reason          String
  createdById     String
  createdBy       User          @relation(fields: [createdById], references: [id])
  createdAt       DateTime      @default(now())
}

model Challan {
  id              String          @id @default(uuid())
  challanNumber   String          @unique
  customerId      String
  customer        Customer        @relation(fields: [customerId], references: [id])
  totalQuantity   Int             @default(0)
  status          ChallanStatus   @default(DRAFT)
  createdById     String
  createdBy       User            @relation(fields: [createdById], references: [id])
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  items           ChallanItem[]
}

// Snapshot line item — stores product data at time of challan, not just a reference
model ChallanItem {
  id                  String    @id @default(uuid())
  challanId           String
  challan             Challan   @relation(fields: [challanId], references: [id])
  productId           String
  product             Product   @relation(fields: [productId], references: [id])
  productNameSnapshot String
  skuSnapshot         String
  unitPriceSnapshot   Decimal
  quantity            Int
}
```

**Why snapshot fields on `ChallanItem`:** if a product's name or price changes after a challan is confirmed, the challan must still show what was actually sold at that time — so `productId` is kept for reference/joins, but the display fields are frozen copies.

---

## 3. API Routes

All routes prefixed `/api`. Auth required on everything except `/auth/login`.

### Auth

| Method | Route         | Roles             | Notes                               |
| ------ | ------------- | ----------------- | ----------------------------------- |
| POST   | `/auth/login` | Public            | returns JWT + user (id, name, role) |
| GET    | `/auth/me`    | Any authenticated | returns current user from token     |

### Customers

| Method | Route                      | Roles        | Notes                                   |
| ------ | -------------------------- | ------------ | --------------------------------------- |
| GET    | `/customers`               | All          | `?page=&limit=&search=&status=&type=`   |
| GET    | `/customers/:id`           | All          | includes recent follow-ups              |
| POST   | `/customers`               | Admin, Sales |                                         |
| PUT    | `/customers/:id`           | Admin, Sales |                                         |
| POST   | `/customers/:id/followups` | Admin, Sales | add note + optional next follow-up date |
| GET    | `/customers/:id/followups` | All          |                                         |

### Products

| Method | Route                           | Roles            | Notes                                            |
| ------ | ------------------------------- | ---------------- | ------------------------------------------------ |
| GET    | `/products`                     | All              | `?page=&limit=&search=&category=&lowStock=true`  |
| GET    | `/products/:id`                 | All              |                                                  |
| POST   | `/products`                     | Admin, Warehouse |                                                  |
| PUT    | `/products/:id`                 | Admin, Warehouse |                                                  |
| GET    | `/products/:id/stock-movements` | All              | paginated log                                    |
| POST   | `/products/:id/stock-movements` | Admin, Warehouse | manual IN/OUT adjustment; updates `currentStock` |

### Challans

| Method | Route                   | Roles        | Notes                                               |
| ------ | ----------------------- | ------------ | --------------------------------------------------- |
| GET    | `/challans`             | All          | `?page=&limit=&status=&customerId=`                 |
| GET    | `/challans/:id`         | All          | includes items + customer                           |
| POST   | `/challans`             | Admin, Sales | creates as `DRAFT`; auto-generates `challanNumber`  |
| PUT    | `/challans/:id`         | Admin, Sales | only if status is `DRAFT`; replace items/quantities |
| POST   | `/challans/:id/confirm` | Admin, Sales | **core business logic**, see below                  |
| POST   | `/challans/:id/cancel`  | Admin, Sales | only if status is `DRAFT` or `CONFIRMED` (see note) |

**Confirm logic (`POST /challans/:id/confirm`)** — run inside a single Prisma transaction:

1. Load challan + items, reject if status isn't `DRAFT`.
2. For each item, check `product.currentStock >= item.quantity`.
3. If any item fails → rollback, return `400` with a list of which products are short and by how much.
4. If all pass → decrement `currentStock` per product, insert a `StockMovement` (`OUT`, reason: `"Challan {number}"`) per item, set challan `status = CONFIRMED`.
5. Cancelling a `CONFIRMED` challan should reverse stock (insert compensating `IN` movements) — worth a one-line note in your README as a documented assumption if you simplify this to "cancel only works on DRAFT" to save time.

### Standard response shape

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "message": "...", "details": [...] } }
```

---

## 4. Role Permission Matrix

| Module          | Admin | Sales                 | Warehouse | Accounts |
| --------------- | ----- | --------------------- | --------- | -------- |
| Customers       | full  | full                  | read      | read     |
| Products        | full  | read                  | full      | read     |
| Stock movements | full  | read                  | full      | read     |
| Challans        | full  | create/confirm/cancel | read      | read     |

Enforce with a small `requireRole(...roles)` middleware placed after `auth.middleware.ts` on each route.

---

## 5. Environment Variables

**backend/.env.example**

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=8h
PORT=4000
CORS_ORIGIN=http://localhost:5173
```

**frontend/.env.example**

```
VITE_API_BASE_URL=http://localhost:4000/api
```

---

## 6. Suggested 48-Hour Build Order

| Hours | Focus                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------- |
| 0–4   | Repo + Prisma schema + migration + seed (4 users, 1 per role) + login/JWT + role middleware           |
| 4–10  | Customer CRUD + follow-ups API                                                                        |
| 10–16 | Product CRUD + stock movement API                                                                     |
| 16–26 | Challan module: draft creation, item add/edit, confirm logic (stock validation + transaction), cancel |
| 26–34 | Frontend: auth flow, layout/sidebar, customer pages                                                   |
| 34–42 | Frontend: product pages, challan pages (multi-product picker, draft/confirm actions)                  |
| 42–46 | Deploy: Neon (DB) → Render (backend) → Vercel (frontend), wire env vars, smoke-test full flow         |
| 46–48 | README, Postman collection export, screen recording, known-limitations writeup                        |

If time runs short, cut in this order: stock movement manual-adjustment UI → follow-up notes UI → search/filter polish → low-stock alert badge. Keep the confirm-challan stock logic intact — it's the piece most likely to be scrutinized.
