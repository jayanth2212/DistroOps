import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './lib/prisma.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const JWT_SECRET = process.env.JWT_SECRET ?? 'distroops-jwt-secret-key-2026';

app.use(cors({ origin: true }));
app.use(express.json());

// --- Interfaces & Domain Models ---

export type Role = 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';
export type CustomerType = 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR';
export type CustomerStatus = 'LEAD' | 'ACTIVE' | 'INACTIVE';
export type MovementType = 'IN' | 'OUT';
export type ChallanStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  password?: string;
  passwordHash?: string;
}

export type AuthUser = Omit<User, 'password' | 'passwordHash'>;
type RequestWithUser = Request & { user?: AuthUser };


export interface FollowUp {
  id: string;
  customerId: string;
  note: string;
  followUpDate?: string;
  createdById: string;
  createdBy: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  businessName?: string;
  gstNumber?: string;
  customerType: CustomerType;
  address?: string;
  status: CustomerStatus;
  followUpDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  followUps?: FollowUp[];
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unitPrice: number;
  currentStock: number;
  minStockAlert: number;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  quantityChanged: number;
  movementType: MovementType;
  reason: string;
  createdById: string;
  createdBy: string;
  timestamp: string;
}

export interface ChallanItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
}

export interface Challan {
  id: string;
  challanNumber: string;
  customerId: string;
  totalQuantity: number;
  subtotal: number;
  status: ChallanStatus;
  createdById: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: ChallanItem[];
}

// --- In-Memory Data Backup (Used for zero-config fallback if DB server is offline) ---

const fallbackUsers: User[] = [
  { id: 'u-1', name: 'System Admin', email: 'admin@distroops.com', role: 'ADMIN', password: 'admin123' },
  { id: 'u-2', name: 'Sarah Sales', email: 'sales@distroops.com', role: 'SALES', password: 'sales123' },
  { id: 'u-3', name: 'Wally Warehouse', email: 'warehouse@distroops.com', role: 'WAREHOUSE', password: 'warehouse123' },
  { id: 'u-4', name: 'Alex Accounts', email: 'accounts@distroops.com', role: 'ACCOUNTS', password: 'accounts123' }
];

const fallbackCustomers: Customer[] = [
  {
    id: 'c-1',
    name: 'Asha Industrial Traders',
    mobile: '9876543210',
    email: 'asha@industrial.com',
    businessName: 'Asha Traders Pvt Ltd',
    gstNumber: '27AABCU9603R1ZN',
    customerType: 'WHOLESALE',
    address: 'Plot 42, Industrial Area Phase II, Mumbai',
    status: 'ACTIVE',
    followUpDate: '2026-07-28T10:00:00.000Z',
    notes: 'Key buyer for heavy hardware & industrial fittings.',
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-20T14:30:00.000Z'
  },
  {
    id: 'c-2',
    name: 'Ravi Distributors & Co',
    mobile: '9123456780',
    email: 'contact@ravidistributors.com',
    businessName: 'Ravi Enterprise',
    gstNumber: '07AAACR1234F1Z5',
    customerType: 'DISTRIBUTOR',
    address: '102 Main Wholesale Market, Delhi',
    status: 'LEAD',
    followUpDate: '2026-07-25T11:00:00.000Z',
    notes: 'Interested in regional distribution partnership.',
    createdAt: '2026-07-18T11:20:00.000Z',
    updatedAt: '2026-07-18T11:20:00.000Z'
  }
];

const fallbackProducts: Product[] = [
  {
    id: 'p-1',
    name: 'Stainless Steel Bolt 10mm',
    sku: 'BOLT-SS-10',
    category: 'Fasteners',
    unitPrice: 15.5,
    currentStock: 250,
    minStockAlert: 50,
    location: 'Warehouse A - Bay 04',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z'
  },
  {
    id: 'p-2',
    name: 'Heavy Duty PVC Pipe 1 Inch',
    sku: 'PVC-HD-01',
    category: 'Plumbing',
    unitPrice: 48.0,
    currentStock: 35,
    minStockAlert: 40,
    location: 'Warehouse B - Rack 12',
    createdAt: '2026-07-02T11:15:00.000Z',
    updatedAt: '2026-07-02T11:15:00.000Z'
  }
];

const fallbackChallans: Challan[] = [
  {
    id: 'ch-1',
    challanNumber: 'CH-1001',
    customerId: 'c-1',
    totalQuantity: 20,
    subtotal: 310.0,
    status: 'DRAFT',
    createdById: 'u-2',
    createdBy: 'Sarah Sales',
    createdAt: '2026-07-21T09:00:00.000Z',
    updatedAt: '2026-07-21T09:00:00.000Z',
    items: [
      {
        id: 'ci-1',
        productId: 'p-1',
        productNameSnapshot: 'Stainless Steel Bolt 10mm',
        skuSnapshot: 'BOLT-SS-10',
        unitPriceSnapshot: 15.5,
        quantity: 20
      }
    ]
  }
];

const fallbackStockMovements: StockMovement[] = [
  {
    id: 'sm-1',
    productId: 'p-1',
    quantityChanged: 250,
    movementType: 'IN',
    reason: 'Initial stock intake shipment',
    createdById: 'u-3',
    createdBy: 'Wally Warehouse',
    timestamp: '2026-07-01T10:00:00.000Z'
  }
];

const fallbackFollowUps: FollowUp[] = [];

// --- Helpers & Middlewares ---

const getUserPayload = (user: User): AuthUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role
});

const hasRole = (user: AuthUser | undefined, roles: Role[]) => Boolean(user && roles.includes(user.role));

const authMiddleware = (req: Request, res: Response, next: () => void) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { message: 'Unauthorized: Missing or invalid token' } });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    (req as RequestWithUser).user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: { message: 'Invalid or expired token' } });
  }
};

const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: () => void) => {
    const user = (req as RequestWithUser).user;
    if (!hasRole(user, roles)) {
      res.status(403).json({
        success: false,
        error: { message: `Access denied. Requires one of roles: ${roles.join(', ')}` }
      });
      return;
    }
    next();
  };
};

// Database Connection Helper
let isDbConnected = false;
async function checkDatabaseConnection() {
  try {
    if (prisma && typeof (prisma as any).$queryRaw === 'function') {
      await (prisma as any).$queryRaw`SELECT 1`;
      isDbConnected = true;
    } else {
      isDbConnected = false;
    }
  } catch {
    isDbConnected = false;
  }
}
checkDatabaseConnection();

// --- API Endpoints ---

// Healthcheck
app.get('/health', async (_req, res) => {
  await checkDatabaseConnection();
  res.json({
    success: true,
    data: {
      status: 'ok',
      app: 'DistroOps Mini ERP + CRM',
      database: isDbConnected ? 'PostgreSQL (Prisma ORM - Live Connected)' : 'In-Memory Backup (PostgreSQL Ready)'
    }
  });
});

// Auth Endpoints
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ success: false, error: { message: 'Email and password are required' } });
    return;
  }

  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const dbUser = await (prisma as any).user.findUnique({
        where: { email: email.toLowerCase() }
      });

      let isMatch = false;
      if (dbUser) {
        if (dbUser.passwordHash.startsWith('$2a$') || dbUser.passwordHash.startsWith('$2b$')) {
          isMatch = await bcrypt.compare(password, dbUser.passwordHash);
        } else {
          isMatch = dbUser.passwordHash === password;
        }
      }

      if (!dbUser || !isMatch) {
        res.status(401).json({ success: false, error: { message: 'Invalid email or password' } });
        return;
      }

      const safeUser = getUserPayload({
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role as Role
      });
      const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '12h' });
      res.json({ success: true, data: { token, user: safeUser } });
      return;
    } catch (err) {
      console.warn('Prisma auth fallback due to:', err);
    }
  }

  // Fallback memory login
  const user = fallbackUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
  let isMatch = false;
  if (user) {
    const hash = user.passwordHash || user.password || '';
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(password, hash);
    } else {
      isMatch = hash === password;
    }
  }

  if (!user || !isMatch) {

    res.status(401).json({ success: false, error: { message: 'Invalid email or password' } });
    return;
  }

  const safeUser = getUserPayload(user);
  const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '12h' });
  res.json({ success: true, data: { token, user: safeUser } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = (req as RequestWithUser).user;
  res.json({ success: true, data: { user } });
});

// User Account Management (ADMIN ONLY)
app.get('/api/users', authMiddleware, requireRole('ADMIN'), async (_req, res) => {
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const users = await (prisma as any).user.findMany({
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ success: true, data: users });
      return;
    } catch (err) {
      console.warn('Prisma users fetch fallback:', err);
    }
  }

  const safeUsers = fallbackUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: new Date().toISOString()
  }));
  res.json({ success: true, data: safeUsers });
});

app.post('/api/users', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { name, email, password, role } = req.body as { name?: string; email?: string; password?: string; role?: Role };

  if (!name || !email || !password || !role) {
    res.status(400).json({ success: false, error: { message: 'All fields (name, email, password, role) are required' } });
    return;
  }

  const validRoles: Role[] = ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ success: false, error: { message: `Invalid role. Must be one of: ${validRoles.join(', ')}` } });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 10);
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const newUser = await (prisma as any).user.create({
        data: {
          name,
          email: cleanEmail,
          passwordHash,
          role
        },
        select: { id: true, name: true, email: true, role: true, createdAt: true }
      });
      res.status(201).json({ success: true, data: newUser });
      return;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        res.status(400).json({ success: false, error: { message: `Account with email '${cleanEmail}' already exists` } });
        return;
      }
      console.warn('Prisma user create fallback:', err);
    }
  }

  const existing = fallbackUsers.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    res.status(400).json({ success: false, error: { message: `Account with email '${cleanEmail}' already exists` } });
    return;
  }

  const createdUser: User = {
    id: uuidv4(),
    name,
    email: cleanEmail,
    passwordHash,
    role
  };
  fallbackUsers.push(createdUser);

  const safe = {
    id: createdUser.id,
    name: createdUser.name,
    email: createdUser.email,
    role: createdUser.role,
    createdAt: new Date().toISOString()
  };

  res.status(201).json({ success: true, data: safe });
});


// Customers Endpoints (CRM)
app.get('/api/customers', authMiddleware, async (req, res) => {
  const { search, status, type } = req.query as { search?: string; status?: string; type?: string };
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const whereClause: any = {};
      if (status) whereClause.status = status;
      if (type) whereClause.customerType = type;
      if (search && typeof search === 'string') {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { mobile: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
          { businessName: { contains: search, mode: 'insensitive' } }
        ];
      }

      const dbCustomers = await (prisma as any).customer.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: { followUps: true }
      });

      res.json({ success: true, data: dbCustomers });
      return;
    } catch (err) {
      console.warn('Prisma customer list fallback due to:', err);
    }
  }

  let result = [...fallbackCustomers];
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.businessName && c.businessName.toLowerCase().includes(q))
    );
  }
  if (status) result = result.filter((c) => c.status === status);
  if (type) result = result.filter((c) => c.customerType === type);

  res.json({ success: true, data: result });
});

app.get('/api/customers/:id', authMiddleware, async (req, res) => {
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const dbCustomer = await (prisma as any).customer.findUnique({
        where: { id: req.params.id },
        include: { followUps: { orderBy: { createdAt: 'desc' } } }
      });
      if (!dbCustomer) {
        res.status(404).json({ success: false, error: { message: 'Customer not found' } });
        return;
      }
      res.json({ success: true, data: dbCustomer });
      return;
    } catch (err) {
      console.warn('Prisma customer fetch fallback:', err);
    }
  }

  const customer = fallbackCustomers.find((c) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, error: { message: 'Customer not found' } });
    return;
  }
  const cFollowUps = fallbackFollowUps.filter((f) => f.customerId === customer.id);
  res.json({ success: true, data: { ...customer, followUps: cFollowUps } });
});

app.post('/api/customers', authMiddleware, requireRole('ADMIN', 'SALES'), async (req, res) => {
  const payload = req.body as Partial<Customer>;
  if (!payload.name || !payload.mobile || !payload.customerType) {
    res.status(400).json({ success: false, error: { message: 'Name, mobile, and customerType are required' } });
    return;
  }

  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const newCust = await (prisma as any).customer.create({
        data: {
          name: payload.name,
          mobile: payload.mobile,
          email: payload.email,
          businessName: payload.businessName,
          gstNumber: payload.gstNumber,
          customerType: payload.customerType as any,
          address: payload.address,
          status: (payload.status as any) ?? 'LEAD',
          followUpDate: payload.followUpDate ? new Date(payload.followUpDate) : null,
          notes: payload.notes
        }
      });
      res.status(201).json({ success: true, data: newCust });
      return;
    } catch (err) {
      console.warn('Prisma customer create fallback:', err);
    }
  }

  const now = new Date().toISOString();
  const nextCustomer: Customer = {
    id: uuidv4(),
    name: payload.name,
    mobile: payload.mobile,
    email: payload.email,
    businessName: payload.businessName,
    gstNumber: payload.gstNumber,
    customerType: payload.customerType,
    address: payload.address,
    status: payload.status ?? 'LEAD',
    followUpDate: payload.followUpDate,
    notes: payload.notes,
    createdAt: now,
    updatedAt: now
  };
  fallbackCustomers.unshift(nextCustomer);
  res.status(201).json({ success: true, data: nextCustomer });
});

app.put('/api/customers/:id', authMiddleware, requireRole('ADMIN', 'SALES'), async (req, res) => {
  const payload = req.body as Partial<Customer>;
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const updatedCust = await (prisma as any).customer.update({
        where: { id: req.params.id },
        data: {
          ...(payload.name && { name: payload.name }),
          ...(payload.mobile && { mobile: payload.mobile }),
          ...(payload.email !== undefined && { email: payload.email }),
          ...(payload.businessName !== undefined && { businessName: payload.businessName }),
          ...(payload.gstNumber !== undefined && { gstNumber: payload.gstNumber }),
          ...(payload.customerType && { customerType: payload.customerType }),
          ...(payload.address !== undefined && { address: payload.address }),
          ...(payload.status && { status: payload.status }),
          ...(payload.followUpDate !== undefined && { followUpDate: payload.followUpDate ? new Date(payload.followUpDate) : null }),
          ...(payload.notes !== undefined && { notes: payload.notes })
        }
      });
      res.json({ success: true, data: updatedCust });
      return;
    } catch (err) {
      console.warn('Prisma customer update fallback:', err);
    }
  }

  const index = fallbackCustomers.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ success: false, error: { message: 'Customer not found' } });
    return;
  }

  const updated: Customer = {
    ...fallbackCustomers[index],
    ...payload,
    id: fallbackCustomers[index].id,
    updatedAt: new Date().toISOString()
  };

  fallbackCustomers[index] = updated;
  res.json({ success: true, data: updated });
});

app.delete('/api/customers/:id', authMiddleware, requireRole('ADMIN', 'SALES'), async (req, res) => {
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      await (prisma as any).customer.delete({ where: { id: req.params.id } });
      res.json({ success: true, data: { deleted: true } });
      return;
    } catch (err) {
      console.warn('Prisma customer delete fallback:', err);
    }
  }

  const index = fallbackCustomers.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ success: false, error: { message: 'Customer not found' } });
    return;
  }

  fallbackCustomers.splice(index, 1);
  res.json({ success: true, data: { deleted: true } });
});



app.post('/api/customers/:id/followups', authMiddleware, requireRole('ADMIN', 'SALES'), async (req, res) => {
  const { note, followUpDate } = req.body as { note?: string; followUpDate?: string };
  if (!note) {
    res.status(400).json({ success: false, error: { message: 'Follow-up note content is required' } });
    return;
  }

  const actingUser = (req as RequestWithUser).user!;
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const newFollowUp = await (prisma as any).followUp.create({
        data: {
          customerId: req.params.id,
          note,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          createdById: actingUser.id
        }
      });

      if (followUpDate) {
        await (prisma as any).customer.update({
          where: { id: req.params.id },
          data: { followUpDate: new Date(followUpDate) }
        });
      }

      res.status(201).json({ success: true, data: newFollowUp });
      return;
    } catch (err) {
      console.warn('Prisma follow-up create fallback:', err);
    }
  }

  const newFollowUp: FollowUp = {
    id: uuidv4(),
    customerId: String(req.params.id),
    note,
    followUpDate,
    createdById: actingUser.id,
    createdBy: actingUser.name,
    createdAt: new Date().toISOString()
  };

  fallbackFollowUps.unshift(newFollowUp);
  res.status(201).json({ success: true, data: newFollowUp });
});

// Products & Inventory Endpoints
app.get('/api/products', authMiddleware, async (req, res) => {
  const { search, category, lowStock } = req.query as { search?: string; category?: string; lowStock?: string };
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const whereClause: any = {};
      if (category && typeof category === 'string') whereClause.category = { equals: category, mode: 'insensitive' };
      if (search && typeof search === 'string') {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } }
        ];
      }

      let dbProducts = await (prisma as any).product.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });

      if (lowStock === 'true') {
        dbProducts = dbProducts.filter((p: any) => p.currentStock <= p.minStockAlert);
      }

      res.json({ success: true, data: dbProducts });
      return;
    } catch (err) {
      console.warn('Prisma product list fallback:', err);
    }
  }

  let result = [...fallbackProducts];
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    result = result.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }
  if (category && typeof category === 'string') result = result.filter((p) => p.category?.toLowerCase() === category.toLowerCase());
  if (lowStock === 'true') result = result.filter((p) => p.currentStock <= p.minStockAlert);

  res.json({ success: true, data: result });
});

app.post('/api/products', authMiddleware, requireRole('ADMIN', 'WAREHOUSE'), async (req, res) => {
  const payload = req.body as Partial<Product>;
  if (!payload.name || !payload.sku || payload.unitPrice === undefined) {
    res.status(400).json({ success: false, error: { message: 'Name, SKU, and unitPrice are required' } });
    return;
  }

  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const newProd = await (prisma as any).product.create({
        data: {
          name: payload.name,
          sku: payload.sku.toUpperCase(),
          category: payload.category ?? 'General',
          unitPrice: Number(payload.unitPrice),
          currentStock: Number(payload.currentStock ?? 0),
          minStockAlert: Number(payload.minStockAlert ?? 10),
          location: payload.location
        }
      });
      res.status(201).json({ success: true, data: newProd });
      return;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        res.status(400).json({ success: false, error: { message: `SKU '${payload.sku}' already exists` } });
        return;
      }
      console.warn('Prisma product create fallback:', err);
    }
  }

  const now = new Date().toISOString();
  const nextProduct: Product = {
    id: uuidv4(),
    name: payload.name,
    sku: payload.sku.toUpperCase(),
    category: payload.category ?? 'General',
    unitPrice: Number(payload.unitPrice),
    currentStock: Number(payload.currentStock ?? 0),
    minStockAlert: Number(payload.minStockAlert ?? 10),
    location: payload.location,
    createdAt: now,
    updatedAt: now
  };
  fallbackProducts.unshift(nextProduct);
  res.status(201).json({ success: true, data: nextProduct });
});

app.put('/api/products/:id', authMiddleware, requireRole('ADMIN', 'WAREHOUSE'), async (req, res) => {
  const payload = req.body as Partial<Product>;
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const updatedProd = await (prisma as any).product.update({
        where: { id: req.params.id },
        data: {
          ...(payload.name && { name: payload.name }),
          ...(payload.sku && { sku: payload.sku.toUpperCase() }),
          ...(payload.category !== undefined && { category: payload.category }),
          ...(payload.unitPrice !== undefined && { unitPrice: Number(payload.unitPrice) }),
          ...(payload.currentStock !== undefined && { currentStock: Number(payload.currentStock) }),
          ...(payload.minStockAlert !== undefined && { minStockAlert: Number(payload.minStockAlert) }),
          ...(payload.location !== undefined && { location: payload.location })
        }
      });
      res.json({ success: true, data: updatedProd });
      return;
    } catch (err) {
      console.warn('Prisma product update fallback:', err);
    }
  }

  const index = fallbackProducts.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ success: false, error: { message: 'Product not found' } });
    return;
  }

  const updated: Product = {
    ...fallbackProducts[index],
    ...payload,
    id: fallbackProducts[index].id,
    sku: payload.sku ? payload.sku.toUpperCase() : fallbackProducts[index].sku,
    unitPrice: payload.unitPrice !== undefined ? Number(payload.unitPrice) : fallbackProducts[index].unitPrice,
    currentStock: payload.currentStock !== undefined ? Number(payload.currentStock) : fallbackProducts[index].currentStock,
    minStockAlert: payload.minStockAlert !== undefined ? Number(payload.minStockAlert) : fallbackProducts[index].minStockAlert,
    updatedAt: new Date().toISOString()
  };

  fallbackProducts[index] = updated;
  res.json({ success: true, data: updated });
});

app.delete('/api/products/:id', authMiddleware, requireRole('ADMIN', 'WAREHOUSE'), async (req, res) => {
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      await (prisma as any).product.delete({ where: { id: req.params.id } });
      res.json({ success: true, data: { deleted: true } });
      return;
    } catch (err) {
      console.warn('Prisma product delete fallback:', err);
    }
  }

  const index = fallbackProducts.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ success: false, error: { message: 'Product not found' } });
    return;
  }

  fallbackProducts.splice(index, 1);
  res.json({ success: true, data: { deleted: true } });
});



app.get('/api/products/:id/stock-movements', authMiddleware, async (req, res) => {
  await checkDatabaseConnection();
  if (isDbConnected) {
    try {
      const dbMovements = await (prisma as any).stockMovement.findMany({
        where: { productId: req.params.id },
        orderBy: { timestamp: 'desc' }
      });
      res.json({ success: true, data: dbMovements });
      return;
    } catch (err) {
      console.warn('Prisma stock movements fallback:', err);
    }
  }

  const movements = fallbackStockMovements.filter((m) => m.productId === req.params.id);
  res.json({ success: true, data: movements });
});

app.post('/api/products/:id/stock-movements', authMiddleware, requireRole('ADMIN', 'WAREHOUSE'), async (req, res) => {
  const { quantityChanged, movementType, reason } = req.body as {
    quantityChanged?: number;
    movementType?: MovementType;
    reason?: string;
  };

  if (!quantityChanged || !movementType || !reason) {
    res.status(400).json({ success: false, error: { message: 'quantityChanged, movementType, and reason are required' } });
    return;
  }

  const qty = Number(quantityChanged);
  const actingUser = (req as RequestWithUser).user!;
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const result = await (prisma as any).$transaction(async (tx: any) => {
        const prod = await tx.product.findUnique({ where: { id: req.params.id } });
        if (!prod) throw new Error('Product not found');
        if (movementType === 'OUT' && prod.currentStock < qty) {
          throw new Error(`Cannot reduce stock. Current stock is ${prod.currentStock}, requested is ${qty}`);
        }

        const updatedProd = await tx.product.update({
          where: { id: req.params.id },
          data: {
            currentStock: movementType === 'IN' ? { increment: qty } : { decrement: qty }
          }
        });

        const movement = await tx.stockMovement.create({
          data: {
            productId: req.params.id,
            quantityChanged: qty,
            movementType: movementType as any,
            reason,
            createdById: actingUser.id
          }
        });

        return { product: updatedProd, movement };
      });

      res.status(201).json({ success: true, data: result });
      return;
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message || 'Stock movement transaction failed' } });
      return;
    }
  }

  const product = fallbackProducts.find((p) => p.id === req.params.id);
  if (!product) {
    res.status(404).json({ success: false, error: { message: 'Product not found' } });
    return;
  }
  if (movementType === 'OUT' && product.currentStock < qty) {
    res.status(400).json({ success: false, error: { message: `Current stock is ${product.currentStock}` } });
    return;
  }

  if (movementType === 'IN') product.currentStock += qty;
  else product.currentStock -= qty;

  const newMovement: StockMovement = {
    id: uuidv4(),
    productId: product.id,
    quantityChanged: qty,
    movementType,
    reason,
    createdById: actingUser.id,
    createdBy: actingUser.name,
    timestamp: new Date().toISOString()
  };

  fallbackStockMovements.unshift(newMovement);
  res.status(201).json({ success: true, data: { product, movement: newMovement } });
});

// Sales Challans Endpoints
app.get('/api/challans', authMiddleware, async (req, res) => {
  const { status, customerId } = req.query as { status?: string; customerId?: string };
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const whereClause: any = {};
      if (status) whereClause.status = status;
      if (customerId) whereClause.customerId = customerId;

      const dbChallans = await (prisma as any).challan.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: { items: true }
      });
      res.json({ success: true, data: dbChallans });
      return;
    } catch (err) {
      console.warn('Prisma challans list fallback:', err);
    }
  }

  let result = [...fallbackChallans];
  if (status) result = result.filter((c) => c.status === status);
  if (customerId) result = result.filter((c) => c.customerId === customerId);
  res.json({ success: true, data: result });
});

app.post('/api/challans', authMiddleware, requireRole('ADMIN', 'SALES'), async (req, res) => {
  const { customerId, items } = req.body as {
    customerId?: string;
    items?: Array<{ productId: string; quantity: number }>;
  };

  if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, error: { message: 'customerId and items are required' } });
    return;
  }

  const actingUser = (req as RequestWithUser).user!;
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      let totalQuantity = 0;
      let subtotal = 0;
      const snapshotItems: Array<{
        productId: string;
        productNameSnapshot: string;
        skuSnapshot: string;
        unitPriceSnapshot: number;
        quantity: number;
      }> = [];

      for (const item of items) {
        const prod = await (prisma as any).product.findUnique({ where: { id: item.productId } });
        if (!prod) {
          res.status(400).json({ success: false, error: { message: `Product ID '${item.productId}' not found` } });
          return;
        }
        const qty = Number(item.quantity);
        totalQuantity += qty;
        subtotal += prod.unitPrice * qty;

        snapshotItems.push({
          productId: prod.id,
          productNameSnapshot: prod.name,
          skuSnapshot: prod.sku,
          unitPriceSnapshot: prod.unitPrice,
          quantity: qty
        });
      }

      const challanCount = await (prisma as any).challan.count();
      const challanNumber = `CH-${1001 + challanCount}`;

      const newChallan = await (prisma as any).challan.create({
        data: {
          challanNumber,
          customerId,
          totalQuantity,
          subtotal,
          status: 'DRAFT',
          createdById: actingUser.id,
          items: {
            create: snapshotItems
          }
        },
        include: { items: true }
      });

      res.status(201).json({ success: true, data: newChallan });
      return;
    } catch (err) {
      console.warn('Prisma challan create fallback:', err);
    }
  }

  const challanItems: ChallanItem[] = [];
  let totalQuantity = 0;
  let subtotal = 0;

  for (const item of items) {
    const product = fallbackProducts.find((p) => p.id === item.productId);
    if (!product) {
      res.status(400).json({ success: false, error: { message: `Product with ID '${item.productId}' not found` } });
      return;
    }
    const qty = Number(item.quantity);
    totalQuantity += qty;
    subtotal += product.unitPrice * qty;

    challanItems.push({
      id: uuidv4(),
      productId: product.id,
      productNameSnapshot: product.name,
      skuSnapshot: product.sku,
      unitPriceSnapshot: product.unitPrice,
      quantity: qty
    });
  }

  const now = new Date().toISOString();
  const newChallan: Challan = {
    id: uuidv4(),
    challanNumber: `CH-${1000 + fallbackChallans.length + 1}`,
    customerId,
    totalQuantity,
    subtotal,
    status: 'DRAFT',
    createdById: actingUser.id,
    createdBy: actingUser.name,
    createdAt: now,
    updatedAt: now,
    items: challanItems
  };

  fallbackChallans.unshift(newChallan);
  res.status(201).json({ success: true, data: newChallan });
});

// Confirm Challan (Prisma Transaction with Atomic Stock Deduction)
app.post('/api/challans/:id/confirm', authMiddleware, requireRole('ADMIN', 'SALES', 'ACCOUNTS'), async (req, res) => {
  const actingUser = (req as RequestWithUser).user!;
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const confirmedChallan = await (prisma as any).$transaction(async (tx: any) => {
        const challan = await tx.challan.findUnique({
          where: { id: req.params.id },
          include: { items: true }
        });

        if (!challan) throw new Error('Challan not found');
        if (challan.status !== 'DRAFT') throw new Error(`Cannot confirm challan with status '${challan.status}'`);

        for (const item of challan.items) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          if (!prod || prod.currentStock < item.quantity) {
            throw new Error(`Insufficient stock for ${item.productNameSnapshot} (Available: ${prod?.currentStock ?? 0}, Requested: ${item.quantity})`);
          }
        }

        for (const item of challan.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: item.quantity } }
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantityChanged: item.quantity,
              movementType: 'OUT',
              reason: `Challan Fulfillment (${challan.challanNumber})`,
              createdById: actingUser.id
            }
          });
        }

        return await tx.challan.update({
          where: { id: req.params.id },
          data: { status: 'CONFIRMED' },
          include: { items: true }
        });
      });

      res.json({ success: true, data: confirmedChallan });
      return;
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message || 'Confirmation failed' } });
      return;
    }
  }

  const challan = fallbackChallans.find((c) => c.id === req.params.id);
  if (!challan) {
    res.status(404).json({ success: false, error: { message: 'Challan not found' } });
    return;
  }
  if (challan.status !== 'DRAFT') {
    res.status(400).json({ success: false, error: { message: 'Only draft challans can be confirmed' } });
    return;
  }

  for (const item of challan.items) {
    const product = fallbackProducts.find((p) => p.id === item.productId);
    if (!product || product.currentStock < item.quantity) {
      res.status(400).json({ success: false, error: { message: `Insufficient stock for ${item.productNameSnapshot}` } });
      return;
    }
  }

  for (const item of challan.items) {
    const product = fallbackProducts.find((p) => p.id === item.productId)!;
    product.currentStock -= item.quantity;
  }

  challan.status = 'CONFIRMED';
  res.json({ success: true, data: challan });
});

// Cancel Challan (Restores stock if confirmed)
app.post('/api/challans/:id/cancel', authMiddleware, requireRole('ADMIN', 'SALES', 'ACCOUNTS'), async (req, res) => {
  const actingUser = (req as RequestWithUser).user!;
  await checkDatabaseConnection();

  if (isDbConnected) {
    try {
      const cancelledChallan = await (prisma as any).$transaction(async (tx: any) => {
        const challan = await tx.challan.findUnique({
          where: { id: req.params.id },
          include: { items: true }
        });

        if (!challan) throw new Error('Challan not found');
        if (challan.status === 'CANCELLED') throw new Error('Challan is already cancelled');

        if (challan.status === 'CONFIRMED') {
          for (const item of challan.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { increment: item.quantity } }
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                quantityChanged: item.quantity,
                movementType: 'IN',
                reason: `Stock Restoration - Cancelled Challan (${challan.challanNumber})`,
                createdById: actingUser.id
              }
            });
          }
        }

        return await tx.challan.update({
          where: { id: req.params.id },
          data: { status: 'CANCELLED' },
          include: { items: true }
        });
      });

      res.json({ success: true, data: cancelledChallan });
      return;
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message || 'Cancellation failed' } });
      return;
    }
  }

  const challan = fallbackChallans.find((c) => c.id === req.params.id);
  if (!challan) {
    res.status(404).json({ success: false, error: { message: 'Challan not found' } });
    return;
  }
  if (challan.status === 'CONFIRMED') {
    for (const item of challan.items) {
      const product = fallbackProducts.find((p) => p.id === item.productId);
      if (product) product.currentStock += item.quantity;
    }
  }

  challan.status = 'CANCELLED';
  res.json({ success: true, data: challan });
});

export default app;
