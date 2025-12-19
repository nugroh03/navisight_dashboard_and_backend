const { PrismaClient, RoleName } = require("@prisma/client");
const { hash } = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const roles = {
    admin:
      (await prisma.role.findFirst({ where: { name: RoleName.ADMINISTRATOR } })) ??
      (await prisma.role.create({ data: { name: RoleName.ADMINISTRATOR } })),
    client:
      (await prisma.role.findFirst({ where: { name: RoleName.CLIENT } })) ??
      (await prisma.role.create({ data: { name: RoleName.CLIENT } })),
    worker:
      (await prisma.role.findFirst({ where: { name: RoleName.WORKER } })) ??
      (await prisma.role.create({ data: { name: RoleName.WORKER } })),
  };

  const adminEmail = "admin@navisight.test";
  const adminPassword = "Admin123!";
  const passwordHash = await hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Administrator",
      passwordHash,
      roleId: roles.admin.id,
    },
    create: {
      email: adminEmail,
      name: "Administrator",
      passwordHash,
      roleId: roles.admin.id,
    },
  });

  const clientEmail = "client@navisight.test";
  await prisma.user.upsert({
    where: { email: clientEmail },
    update: {
      name: "Client User",
      passwordHash,
      roleId: roles.client.id,
    },
    create: {
      email: clientEmail,
      name: "Client User",
      passwordHash,
      roleId: roles.client.id,
    },
  });

  const workerEmail = "worker@navisight.test";
  await prisma.user.upsert({
    where: { email: workerEmail },
    update: {
      name: "Worker User",
      passwordHash,
      roleId: roles.worker.id,
    },
    create: {
      email: workerEmail,
      name: "Worker User",
      passwordHash,
      roleId: roles.worker.id,
    },
  });

  console.log(
    `Seeder selesai.\n` +
      `Admin: ${adminEmail} / ${adminPassword}\n` +
      `Client: ${clientEmail} / ${adminPassword}\n` +
      `Worker: ${workerEmail} / ${adminPassword}`
  );
}

main()
  .catch((error) => {
    console.error("Gagal menjalankan seeder:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
