import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting DistroOps PostgreSQL database seed...');

  // Seed Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@distroops.com' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@distroops.com',
      passwordHash: 'admin123',
      role: 'ADMIN'
    }
  });

  const sales = await prisma.user.upsert({
    where: { email: 'sales@distroops.com' },
    update: {},
    create: {
      name: 'Sarah Sales',
      email: 'sales@distroops.com',
      passwordHash: 'sales123',
      role: 'SALES'
    }
  });

  const warehouse = await prisma.user.upsert({
    where: { email: 'warehouse@distroops.com' },
    update: {},
    create: {
      name: 'Wally Warehouse',
      email: 'warehouse@distroops.com',
      passwordHash: 'warehouse123',
      role: 'WAREHOUSE'
    }
  });

  const accounts = await prisma.user.upsert({
    where: { email: 'accounts@distroops.com' },
    update: {},
    create: {
      name: 'Alex Accounts',
      email: 'accounts@distroops.com',
      passwordHash: 'accounts123',
      role: 'ACCOUNTS'
    }
  });

  // Seed Customers
  const customer1 = await prisma.customer.create({
    data: {
      name: 'Asha Industrial Traders',
      mobile: '9876543210',
      email: 'asha@industrial.com',
      businessName: 'Asha Traders Pvt Ltd',
      gstNumber: '27AABCU9603R1ZN',
      customerType: 'WHOLESALE',
      address: 'Plot 42, Industrial Area Phase II, Mumbai',
      status: 'ACTIVE',
      notes: 'Key buyer for heavy hardware & industrial fittings.'
    }
  });

  const customer2 = await prisma.customer.create({
    data: {
      name: 'Ravi Distributors & Co',
      mobile: '9123456780',
      email: 'contact@ravidistributors.com',
      businessName: 'Ravi Enterprise',
      gstNumber: '07AAACR1234F1Z5',
      customerType: 'DISTRIBUTOR',
      address: '102 Main Wholesale Market, Delhi',
      status: 'LEAD',
      notes: 'Interested in regional distribution partnership.'
    }
  });

  // Seed Products
  const product1 = await prisma.product.upsert({
    where: { sku: 'BOLT-SS-10' },
    update: {},
    create: {
      name: 'Stainless Steel Bolt 10mm',
      sku: 'BOLT-SS-10',
      category: 'Fasteners',
      unitPrice: 15.5,
      currentStock: 250,
      minStockAlert: 50,
      location: 'Warehouse A - Bay 04'
    }
  });

  const product2 = await prisma.product.upsert({
    where: { sku: 'PVC-HD-01' },
    update: {},
    create: {
      name: 'Heavy Duty PVC Pipe 1 Inch',
      sku: 'PVC-HD-01',
      category: 'Plumbing',
      unitPrice: 48.0,
      currentStock: 35,
      minStockAlert: 40,
      location: 'Warehouse B - Rack 12'
    }
  });

  console.log('✅ PostgreSQL Database Seed Completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
