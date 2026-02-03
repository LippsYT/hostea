import { prisma } from './db';

export const getSetting = async <T = any>(key: string, fallback: T) => {
  const row = await prisma.settings.findUnique({ where: { key } });
  if (!row) return fallback;
  return row.value as T;
};
