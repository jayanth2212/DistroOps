import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let prismaInstance = null;
try {
    const { PrismaClient } = require('@prisma/client');
    prismaInstance = new PrismaClient();
}
catch {
    console.log('ℹ️ Prisma Client initializing for PostgreSQL...');
    prismaInstance = null;
}
export const prisma = prismaInstance;
