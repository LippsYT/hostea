import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json() as Array<{ key: string; value: unknown }>;

		for (const { key, value } of body) {
			const safeValue = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
			
			await prisma.settings.upsert({
				where: { key },
				update: { value: safeValue },
				create: { key, value: safeValue }
			});
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
