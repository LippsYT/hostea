import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const TEST_EMAIL_PATTERNS = [
  /@hostea\.local$/i,
  /test/i,
  /demo/i,
  /example/i,
  /cliente/i
];

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase() || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || '';
const ADMIN_NAME = process.env.ADMIN_NAME?.trim() || 'Administrador Hostea';
const DRY_RUN = process.env.DRY_RUN === '1';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD.');
  process.exit(1);
}

const isTestEmail = (email: string) => TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(email));

async function archiveTestUsers(adminEmail: string) {
  const users = await prisma.user.findMany({
    where: {
      email: {
        not: adminEmail
      }
    },
    select: { id: true, email: true }
  });

  const targets = users.filter((u) => isTestEmail(u.email));
  if (targets.length === 0) return 0;

  const archivedPassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

  for (const user of targets) {
    const archivedEmail = `archived+${user.id.slice(-10)}@deleted.hostea`;
    if (DRY_RUN) {
      console.log(`[DRY RUN] archive ${user.email} -> ${archivedEmail}`);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: archivedEmail,
        passwordHash: archivedPassword,
        emailVerified: null,
        profile: {
          upsert: {
            create: { name: 'Usuario archivado' },
            update: { name: 'Usuario archivado', phone: null, avatarUrl: null }
          }
        }
      }
    });
  }

  return targets.length;
}

async function upsertAdmin(email: string, password: string, name: string) {
  const passwordHash = await bcrypt.hash(password, 10);

  const adminRole = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: {},
    create: { name: RoleName.ADMIN, description: 'Admin role' }
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      emailVerified: new Date(),
      profile: {
        upsert: {
          create: { name },
          update: { name }
        }
      }
    },
    create: {
      email,
      passwordHash,
      emailVerified: new Date(),
      profile: { create: { name } }
    }
  });

  if (!DRY_RUN) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      update: {},
      create: { userId: user.id, roleId: adminRole.id }
    });
  }

  return user.email;
}

async function main() {
  const adminEmail = ADMIN_EMAIL.toLowerCase();
  console.log(`Preparing auth reset. Admin: ${adminEmail}`);

  const archived = await archiveTestUsers(adminEmail);
  const admin = await upsertAdmin(adminEmail, ADMIN_PASSWORD, ADMIN_NAME);

  console.log(`Archived test/local accounts: ${archived}`);
  console.log(`Admin ready: ${admin}`);
  if (DRY_RUN) console.log('DRY_RUN enabled: no write operations were executed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
