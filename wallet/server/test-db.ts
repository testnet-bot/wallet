import prisma from './src/config/database';

async function run() {
console.log('🐘 Testing WIP Protocol Database...');
try {
// No need to "new PrismaClient()" here, we use the one from config
const count = await prisma.payment.count();
console.log(`✅ Connection Successful! Found ${count} payments.`);
} catch (e) {
console.error('❌ FAILED:', e);
} finally {
await prisma.$disconnect();
}
}
run();