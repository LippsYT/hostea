import { PrismaClient, RoleName, ListingType, CancelPolicy } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const seedRoles = async () => {
  const permissions = [
    'LISTING_MANAGE',
    'RESERVATION_MANAGE',
    'USER_MANAGE',
    'KYC_REVIEW',
    'TICKET_MANAGE',
    'SETTINGS_MANAGE',
    'AUDIT_VIEW',
    'FINANCE_VIEW'
  ];

  for (const name of permissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  const roleMap: Record<RoleName, string[]> = {
    ADMIN: permissions,
    HOST: ['LISTING_MANAGE', 'RESERVATION_MANAGE', 'FINANCE_VIEW'],
    CLIENT: [],
    MODERATOR: ['LISTING_MANAGE', 'TICKET_MANAGE', 'KYC_REVIEW'],
    SUPPORT: ['TICKET_MANAGE'],
    FINANCE: ['FINANCE_VIEW']
  };

  for (const roleName of Object.keys(roleMap) as RoleName[]) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `${roleName} role` }
    });

    for (const perm of roleMap[roleName]) {
      const permission = await prisma.permission.findUnique({ where: { name: perm } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id }
        });
      }
    }
  }
};

const createUser = async (email: string, password: string, name: string, role: RoleName) => {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      emailVerified: new Date(),
      profile: { create: { name } }
    }
  });
  const roleRecord = await prisma.role.findUnique({ where: { name: role } });
  if (roleRecord) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleRecord.id } },
      update: {},
      create: { userId: user.id, roleId: roleRecord.id }
    });
  }
  return user;
};

const seedListings = async (hostId: string) => {
  const amenityNames = ['Wifi', 'Cocina equipada', 'Aire acondicionado', 'Piscina', 'Gimnasio', 'Desayuno'];
  for (const name of amenityNames) {
    await prisma.amenity.upsert({ where: { name }, update: {}, create: { name } });
  }

  const hotel = await prisma.listing.create({
    data: {
      hostId,
      title: 'Silver Living Palermo',
      description: 'Hotel boutique con diseno moderno y rooftop en Palermo Soho.',
      type: ListingType.HOTEL,
      address: 'Av. Santa Fe 3120',
      city: 'Buenos Aires',
      neighborhood: 'Palermo',
      pricePerNight: 80,
      cleaningFee: 12,
      serviceFee: 10,
      taxRate: 0.12,
      capacity: 2,
      beds: 1,
      baths: 1,
      instantBook: true,
      cancelPolicy: CancelPolicy.MODERATE,
      photos: {
        create: [
          { url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop', sortOrder: 1 },
          { url: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1200&auto=format&fit=crop', sortOrder: 2 }
        ]
      },
      roomTypes: {
        create: [
          { name: 'Suite Deluxe', quantity: 8, priceModifier: 0 },
          { name: 'Junior Suite', quantity: 12, priceModifier: -10 }
        ]
      }
    }
  });

  const apartmentData = [
    { title: 'Canitas Style Loft', neighborhood: 'Las Canitas' },
    { title: 'Canitas Zen Studio', neighborhood: 'Las Canitas' },
    { title: 'Recoleta Chic Flat', neighborhood: 'Recoleta' },
    { title: 'Palermo Skyline Dept', neighborhood: 'Palermo' }
  ];

  for (const apt of apartmentData) {
    await prisma.listing.create({
      data: {
        hostId,
        title: apt.title,
        description: 'Departamento premium con amenities completos y vistas abiertas.',
        type: ListingType.APARTMENT,
        address: 'Calle Gorostiaga 1800',
        city: 'Buenos Aires',
        neighborhood: apt.neighborhood,
        pricePerNight: 70,
        cleaningFee: 8,
        serviceFee: 9,
        taxRate: 0.1,
        capacity: 3,
        beds: 2,
        baths: 1,
        instantBook: true,
        cancelPolicy: CancelPolicy.FLEXIBLE,
        photos: {
          create: [
            { url: 'https://images.unsplash.com/photo-1505691723518-36a5ac3be353?q=80&w=1200&auto=format&fit=crop', sortOrder: 1 },
            { url: 'https://images.unsplash.com/photo-1502005097973-6a7082348e28?q=80&w=1200&auto=format&fit=crop', sortOrder: 2 }
          ]
        }
      }
    });
  }

  const wifi = await prisma.amenity.findUnique({ where: { name: 'Wifi' } });
  if (wifi) {
    await prisma.listingAmenity.create({ data: { listingId: hotel.id, amenityId: wifi.id } });
  }
};

const seedSettings = async () => {
  await prisma.settings.upsert({
    where: { key: 'commissionPercent' },
    update: {},
    create: { key: 'commissionPercent', value: 0.15 }
  });
  await prisma.settings.upsert({
    where: { key: 'usdToArsRate' },
    update: {},
    create: { key: 'usdToArsRate', value: 980 }
  });
  await prisma.settings.upsert({
    where: { key: 'cancelWindowHours' },
    update: {},
    create: { key: 'cancelWindowHours', value: 48 }
  });
  await prisma.settings.upsert({
    where: { key: 'partialRefundPercent' },
    update: {},
    create: { key: 'partialRefundPercent', value: 0.5 }
  });
};

const seedLegal = async () => {
  const pages = [
    { slug: 'terms', title: 'Terminos y condiciones', content: 'Terminos base de HOSTEA. Editar desde Admin.' },
    { slug: 'privacy', title: 'Politica de privacidad', content: 'Politica de privacidad editable desde Admin.' },
    { slug: 'cookies', title: 'Politica de cookies', content: 'Cookies y tracking. Editable desde Admin.' },
    { slug: 'cancellation', title: 'Politica de cancelacion', content: 'Reglas de cancelacion y reembolsos.' }
  ];
  for (const page of pages) {
    await prisma.legalPage.upsert({
      where: { slug: page.slug },
      update: { title: page.title, content: page.content },
      create: page
    });
  }
};

async function main() {
  await seedRoles();
  const admin = await createUser('admin@hostea.local', 'admin123', 'Admin Hostea', RoleName.ADMIN);
  const host = await createUser('host@hostea.local', 'host123', 'Host Palermo', RoleName.HOST);
  await createUser('cliente@hostea.local', 'cliente123', 'Cliente Demo', RoleName.CLIENT);

  await seedListings(host.id);
  await seedSettings();
  await seedLegal();

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'SEED',
      entity: 'SYSTEM',
      entityId: 'seed',
      meta: { message: 'Seed inicial HOSTEA' }
    }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
