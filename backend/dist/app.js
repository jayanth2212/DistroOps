import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './lib/prisma.js';
dotenv.config();
const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const JWT_SECRET = process.env.JWT_SECRET ?? 'distroops-jwt-secret-key-2026';
app.use(cors({ origin: true }));
app.use(express.json());
// --- In-Memory Data Backup (Used for zero-config fallback if DB server is offline) ---
const fallbackUsers = [
    { id: 'u-1', name: 'System Admin', email: 'admin@distroops.com', role: 'ADMIN', password: 'admin123' },
    { id: 'u-2', name: 'Sarah Sales', email: 'sales@distroops.com', role: 'SALES', password: 'sales123' },
    { id: 'u-3', name: 'Wally Warehouse', email: 'warehouse@distroops.com', role: 'WAREHOUSE', password: 'warehouse123' },
    { id: 'u-4', name: 'Alex Accounts', email: 'accounts@distroops.com', role: 'ACCOUNTS', password: 'accounts123' }
];
const fallbackCustomers = [
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
const fallbackProducts = [
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
const fallbackChallans = [
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
const fallbackStockMovements = [
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
const fallbackFollowUps = [];
// --- Helpers & Middlewares ---
const getUserPayload = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
});
const hasRole = (user, roles) => Boolean(user && roles.includes(user.role));
const authMiddleware = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: { message: 'Unauthorized: Missing or invalid token' } });
        return;
    }
    try {
        const token = header.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ success: false, error: { message: 'Invalid or expired token' } });
    }
};
const requireRole = (...roles) => {
    return (req, res, next) => {
        const user = req.user;
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
        if (prisma && typeof prisma.$queryRaw === 'function') {
            await prisma.$queryRaw `SELECT 1`;
            isDbConnected = true;
        }
        else {
            isDbConnected = false;
        }
    }
    catch {
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
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ success: false, error: { message: 'Email and password are required' } });
        return;
    }
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const dbUser = await prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });
            if (!dbUser || dbUser.passwordHash !== password) {
                res.status(401).json({ success: false, error: { message: 'Invalid email or password' } });
                return;
            }
            const safeUser = getUserPayload({
                id: dbUser.id,
                name: dbUser.name,
                email: dbUser.email,
                role: dbUser.role
            });
            const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '12h' });
            res.json({ success: true, data: { token, user: safeUser } });
            return;
        }
        catch (err) {
            console.warn('Prisma auth fallback due to:', err);
        }
    }
    // Fallback memory login
    const user = fallbackUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || password !== user.password) {
        res.status(401).json({ success: false, error: { message: 'Invalid email or password' } });
        return;
    }
    const safeUser = getUserPayload(user);
    const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '12h' });
    res.json({ success: true, data: { token, user: safeUser } });
});
app.get('/api/auth/me', authMiddleware, (req, res) => {
    const user = req.user;
    res.json({ success: true, data: { user } });
});
// Customers Endpoints (CRM)
app.get('/api/customers', authMiddleware, async (req, res) => {
    const { search, status, type } = req.query;
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const whereClause = {};
            if (status)
                whereClause.status = status;
            if (type)
                whereClause.customerType = type;
            if (search && typeof search === 'string') {
                whereClause.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { mobile: { contains: search } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { businessName: { contains: search, mode: 'insensitive' } }
                ];
            }
            const dbCustomers = await prisma.customer.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                include: { followUps: true }
            });
            res.json({ success: true, data: dbCustomers });
            return;
        }
        catch (err) {
            console.warn('Prisma customer list fallback due to:', err);
        }
    }
    let result = [...fallbackCustomers];
    if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        result = result.filter((c) => c.name.toLowerCase().includes(q) ||
            c.mobile.includes(q) ||
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.businessName && c.businessName.toLowerCase().includes(q)));
    }
    if (status)
        result = result.filter((c) => c.status === status);
    if (type)
        result = result.filter((c) => c.customerType === type);
    res.json({ success: true, data: result });
});
app.get('/api/customers/:id', authMiddleware, async (req, res) => {
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const dbCustomer = await prisma.customer.findUnique({
                where: { id: req.params.id },
                include: { followUps: { orderBy: { createdAt: 'desc' } } }
            });
            if (!dbCustomer) {
                res.status(404).json({ success: false, error: { message: 'Customer not found' } });
                return;
            }
            res.json({ success: true, data: dbCustomer });
            return;
        }
        catch (err) {
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
    const payload = req.body;
    if (!payload.name || !payload.mobile || !payload.customerType) {
        res.status(400).json({ success: false, error: { message: 'Name, mobile, and customerType are required' } });
        return;
    }
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const newCust = await prisma.customer.create({
                data: {
                    name: payload.name,
                    mobile: payload.mobile,
                    email: payload.email,
                    businessName: payload.businessName,
                    gstNumber: payload.gstNumber,
                    customerType: payload.customerType,
                    address: payload.address,
                    status: payload.status ?? 'LEAD',
                    followUpDate: payload.followUpDate ? new Date(payload.followUpDate) : null,
                    notes: payload.notes
                }
            });
            res.status(201).json({ success: true, data: newCust });
            return;
        }
        catch (err) {
            console.warn('Prisma customer create fallback:', err);
        }
    }
    const now = new Date().toISOString();
    const nextCustomer = {
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
    const payload = req.body;
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const updatedCust = await prisma.customer.update({
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
        }
        catch (err) {
            console.warn('Prisma customer update fallback:', err);
        }
    }
    const index = fallbackCustomers.findIndex((c) => c.id === req.params.id);
    if (index === -1) {
        res.status(404).json({ success: false, error: { message: 'Customer not found' } });
        return;
    }
    const updated = {
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
            await prisma.customer.delete({ where: { id: req.params.id } });
            res.json({ success: true, data: { deleted: true } });
            return;
        }
        catch (err) {
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
    const { note, followUpDate } = req.body;
    if (!note) {
        res.status(400).json({ success: false, error: { message: 'Follow-up note content is required' } });
        return;
    }
    const actingUser = req.user;
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const newFollowUp = await prisma.followUp.create({
                data: {
                    customerId: req.params.id,
                    note,
                    followUpDate: followUpDate ? new Date(followUpDate) : null,
                    createdById: actingUser.id
                }
            });
            if (followUpDate) {
                await prisma.customer.update({
                    where: { id: req.params.id },
                    data: { followUpDate: new Date(followUpDate) }
                });
            }
            res.status(201).json({ success: true, data: newFollowUp });
            return;
        }
        catch (err) {
            console.warn('Prisma follow-up create fallback:', err);
        }
    }
    const newFollowUp = {
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
    const { search, category, lowStock } = req.query;
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const whereClause = {};
            if (category && typeof category === 'string')
                whereClause.category = { equals: category, mode: 'insensitive' };
            if (search && typeof search === 'string') {
                whereClause.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { sku: { contains: search, mode: 'insensitive' } }
                ];
            }
            let dbProducts = await prisma.product.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' }
            });
            if (lowStock === 'true') {
                dbProducts = dbProducts.filter((p) => p.currentStock <= p.minStockAlert);
            }
            res.json({ success: true, data: dbProducts });
            return;
        }
        catch (err) {
            console.warn('Prisma product list fallback:', err);
        }
    }
    let result = [...fallbackProducts];
    if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        result = result.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (category && typeof category === 'string')
        result = result.filter((p) => p.category?.toLowerCase() === category.toLowerCase());
    if (lowStock === 'true')
        result = result.filter((p) => p.currentStock <= p.minStockAlert);
    res.json({ success: true, data: result });
});
app.post('/api/products', authMiddleware, requireRole('ADMIN', 'WAREHOUSE'), async (req, res) => {
    const payload = req.body;
    if (!payload.name || !payload.sku || payload.unitPrice === undefined) {
        res.status(400).json({ success: false, error: { message: 'Name, SKU, and unitPrice are required' } });
        return;
    }
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const newProd = await prisma.product.create({
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
        }
        catch (err) {
            if (err?.code === 'P2002') {
                res.status(400).json({ success: false, error: { message: `SKU '${payload.sku}' already exists` } });
                return;
            }
            console.warn('Prisma product create fallback:', err);
        }
    }
    const now = new Date().toISOString();
    const nextProduct = {
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
    const payload = req.body;
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const updatedProd = await prisma.product.update({
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
        }
        catch (err) {
            console.warn('Prisma product update fallback:', err);
        }
    }
    const index = fallbackProducts.findIndex((p) => p.id === req.params.id);
    if (index === -1) {
        res.status(404).json({ success: false, error: { message: 'Product not found' } });
        return;
    }
    const updated = {
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
            await prisma.product.delete({ where: { id: req.params.id } });
            res.json({ success: true, data: { deleted: true } });
            return;
        }
        catch (err) {
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
            const dbMovements = await prisma.stockMovement.findMany({
                where: { productId: req.params.id },
                orderBy: { timestamp: 'desc' }
            });
            res.json({ success: true, data: dbMovements });
            return;
        }
        catch (err) {
            console.warn('Prisma stock movements fallback:', err);
        }
    }
    const movements = fallbackStockMovements.filter((m) => m.productId === req.params.id);
    res.json({ success: true, data: movements });
});
app.post('/api/products/:id/stock-movements', authMiddleware, requireRole('ADMIN', 'WAREHOUSE'), async (req, res) => {
    const { quantityChanged, movementType, reason } = req.body;
    if (!quantityChanged || !movementType || !reason) {
        res.status(400).json({ success: false, error: { message: 'quantityChanged, movementType, and reason are required' } });
        return;
    }
    const qty = Number(quantityChanged);
    const actingUser = req.user;
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const result = await prisma.$transaction(async (tx) => {
                const prod = await tx.product.findUnique({ where: { id: req.params.id } });
                if (!prod)
                    throw new Error('Product not found');
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
                        movementType: movementType,
                        reason,
                        createdById: actingUser.id
                    }
                });
                return { product: updatedProd, movement };
            });
            res.status(201).json({ success: true, data: result });
            return;
        }
        catch (err) {
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
    if (movementType === 'IN')
        product.currentStock += qty;
    else
        product.currentStock -= qty;
    const newMovement = {
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
    const { status, customerId } = req.query;
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const whereClause = {};
            if (status)
                whereClause.status = status;
            if (customerId)
                whereClause.customerId = customerId;
            const dbChallans = await prisma.challan.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                include: { items: true }
            });
            res.json({ success: true, data: dbChallans });
            return;
        }
        catch (err) {
            console.warn('Prisma challans list fallback:', err);
        }
    }
    let result = [...fallbackChallans];
    if (status)
        result = result.filter((c) => c.status === status);
    if (customerId)
        result = result.filter((c) => c.customerId === customerId);
    res.json({ success: true, data: result });
});
app.post('/api/challans', authMiddleware, requireRole('ADMIN', 'SALES'), async (req, res) => {
    const { customerId, items } = req.body;
    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: { message: 'customerId and items are required' } });
        return;
    }
    const actingUser = req.user;
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            let totalQuantity = 0;
            let subtotal = 0;
            const snapshotItems = [];
            for (const item of items) {
                const prod = await prisma.product.findUnique({ where: { id: item.productId } });
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
            const challanCount = await prisma.challan.count();
            const challanNumber = `CH-${1001 + challanCount}`;
            const newChallan = await prisma.challan.create({
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
        }
        catch (err) {
            console.warn('Prisma challan create fallback:', err);
        }
    }
    const challanItems = [];
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
    const newChallan = {
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
    const actingUser = req.user;
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const confirmedChallan = await prisma.$transaction(async (tx) => {
                const challan = await tx.challan.findUnique({
                    where: { id: req.params.id },
                    include: { items: true }
                });
                if (!challan)
                    throw new Error('Challan not found');
                if (challan.status !== 'DRAFT')
                    throw new Error(`Cannot confirm challan with status '${challan.status}'`);
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
        }
        catch (err) {
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
        const product = fallbackProducts.find((p) => p.id === item.productId);
        product.currentStock -= item.quantity;
    }
    challan.status = 'CONFIRMED';
    res.json({ success: true, data: challan });
});
// Cancel Challan (Restores stock if confirmed)
app.post('/api/challans/:id/cancel', authMiddleware, requireRole('ADMIN', 'SALES', 'ACCOUNTS'), async (req, res) => {
    const actingUser = req.user;
    await checkDatabaseConnection();
    if (isDbConnected) {
        try {
            const cancelledChallan = await prisma.$transaction(async (tx) => {
                const challan = await tx.challan.findUnique({
                    where: { id: req.params.id },
                    include: { items: true }
                });
                if (!challan)
                    throw new Error('Challan not found');
                if (challan.status === 'CANCELLED')
                    throw new Error('Challan is already cancelled');
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
        }
        catch (err) {
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
            if (product)
                product.currentStock += item.quantity;
        }
    }
    challan.status = 'CANCELLED';
    res.json({ success: true, data: challan });
});
export default app;
