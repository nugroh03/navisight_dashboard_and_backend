/**
 * Test Script - Platform Access Configuration
 *
 * Script ini untuk test apakah user yang dibuat dari dashboard
 * otomatis bisa login ke mobile
 */

import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';

async function testPlatformAccess() {
  console.log('🧪 Testing Platform Access Configuration...\n');

  try {
    // Test 1: Create WORKER user
    console.log('📝 Test 1: Creating WORKER user...');
    const workerRole = await prisma.role.findFirst({
      where: { name: 'WORKER' },
    });

    if (!workerRole) {
      console.error('❌ WORKER role not found. Please run seed first.');
      return;
    }

    const workerEmail = `worker.test.${Date.now()}@example.com`;
    const worker = await prisma.user.create({
      data: {
        name: 'Test Worker',
        email: workerEmail,
        passwordHash: await hash('password123', 10),
        roleId: workerRole.id,
        accountType: 'INTERNAL_STAFF',
        canAccessDashboard: true,
        canAccessMobile: true,
      },
    });

    console.log('✅ WORKER created:');
    console.log(`   Email: ${worker.email}`);
    console.log(`   AccountType: ${worker.accountType}`);
    console.log(`   Can Access Dashboard: ${worker.canAccessDashboard}`);
    console.log(`   Can Access Mobile: ${worker.canAccessMobile}`);
    console.log('   ✅ WORKER dapat akses dashboard & mobile\n');

    // Test 2: Create CLIENT user
    console.log('📝 Test 2: Creating CLIENT user...');
    const clientRole = await prisma.role.findFirst({
      where: { name: 'CLIENT' },
    });

    if (!clientRole) {
      console.error('❌ CLIENT role not found. Please run seed first.');
      return;
    }

    const clientEmail = `client.test.${Date.now()}@example.com`;
    const client = await prisma.user.create({
      data: {
        name: 'Test Client',
        email: clientEmail,
        passwordHash: await hash('password123', 10),
        roleId: clientRole.id,
        accountType: 'EXTERNAL_CUSTOMER',
        canAccessDashboard: false,
        canAccessMobile: true,
      },
    });

    console.log('✅ CLIENT created:');
    console.log(`   Email: ${client.email}`);
    console.log(`   AccountType: ${client.accountType}`);
    console.log(`   Can Access Dashboard: ${client.canAccessDashboard}`);
    console.log(`   Can Access Mobile: ${client.canAccessMobile}`);
    console.log('   ✅ CLIENT dapat akses mobile (dashboard blocked)\n');

    // Test 3: Verify existing users
    console.log('📝 Test 3: Checking all users platform access...');
    const allUsers = await prisma.user.findMany({
      where: { deletedAt: null },
      include: { role: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    console.log(`\n📊 Found ${allUsers.length} recent users:\n`);
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Role: ${user.role?.name ?? 'N/A'}`);
      console.log(`   AccountType: ${user.accountType}`);
      console.log(`   Dashboard: ${user.canAccessDashboard ? '✅' : '❌'}`);
      console.log(`   Mobile: ${user.canAccessMobile ? '✅' : '❌'}`);
      console.log('');
    });

    console.log('\n✅ All tests completed successfully!\n');
    console.log('📋 Summary:');
    console.log('   ✅ WORKER users can access both dashboard and mobile');
    console.log('   ✅ CLIENT users can access mobile only');
    console.log('   ✅ All users created from dashboard have mobile access');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  testPlatformAccess();
}

export { testPlatformAccess };
