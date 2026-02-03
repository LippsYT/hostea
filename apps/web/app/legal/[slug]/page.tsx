import { prisma } from '@/lib/db';

export default async function LegalPage({ params }: { params: { slug: string } }) {
  const page = await prisma.legalPage.findUnique({ where: { slug: params.slug } });
  if (!page) {
    return <div className="p-10">Pagina legal no encontrada.</div>
  }
  return (
    <div className="px-8 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold">{page.title}</h1>
        <p className="mt-6 whitespace-pre-wrap text-neutral-600">{page.content}</p>
      </div>
    </div>
  );
}
