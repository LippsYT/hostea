import { prisma } from '@/lib/db';

const legalDefaults: Record<string, { title: string; content: string }> = {
  'terminos-condiciones': {
    title: 'Terminos y Condiciones - HOSTEA',
    content: `Ultima actualizacion: 25 de febrero de 2026

1. Naturaleza del servicio
HOSTEA es una plataforma tecnologica que conecta huespedes con anfitriones para la publicacion y reserva de alojamientos.

HOSTEA:
- No es propietaria de los alojamientos.
- No administra fisicamente las propiedades.
- No actua como aseguradora ni garante de ninguna estadia.
- No ofrece seguros ni proteccion contra danos o perdidas.

El contrato de hospedaje se celebra exclusivamente entre el huesped y el anfitrion.

2. Registro y cuentas
Los usuarios deben proporcionar informacion veraz y actualizada, ser mayores de 18 anos y mantener la confidencialidad de sus credenciales.
HOSTEA puede suspender cuentas por informacion falsa, fraude o incumplimiento de normas.

3. Reservas
Al confirmar una reserva se genera un acuerdo entre huesped y anfitrion. HOSTEA actua como intermediario tecnologico.
La disponibilidad depende de la informacion proporcionada por el anfitrion y de sincronizaciones externas.

4. Pagos
Los pagos se procesan a traves de pasarelas externas. HOSTEA cobra una comision por el uso de la plataforma.
HOSTEA no actua como entidad financiera ni custodio bancario.

5. Cancelaciones
Las politicas de cancelacion son definidas por cada anfitrion. HOSTEA no es responsable por decisiones de cancelacion ni penalidades publicadas por el anfitrion.

6. Limitacion de responsabilidad
HOSTEA no sera responsable por danos materiales, robos, accidentes, lesiones fisicas, fallecimientos, conflictos entre huesped y anfitrion, perdidas economicas por cancelaciones o fallas de terceros.
La responsabilidad maxima de HOSTEA se limita al monto de comision efectivamente cobrado en la reserva en cuestion.

7. Conducta del usuario
Esta prohibido realizar pagos fuera de la plataforma para evadir comisiones, usar la plataforma para actividades ilegales o publicar contenido enganoso.

8. Modificaciones
HOSTEA puede actualizar estos terminos en cualquier momento.

Exencion clave
HOSTEA actua exclusivamente como intermediario tecnologico y no asume responsabilidad por danos, perdidas, lesiones, incumplimientos contractuales o disputas derivadas del uso de la plataforma.`
  },
  'politica-privacidad': {
    title: 'Politica de Privacidad',
    content: `HOSTEA recopila datos personales (nombre, email, telefono), informacion de pago (procesada por terceros) y datos de uso de la plataforma.

HOSTEA no vende datos personales. Los datos pueden compartirse con procesadores de pago, proveedores tecnicos y autoridades legales cuando sea requerido.

El usuario puede solicitar acceso, rectificacion y eliminacion de datos.`
  },
  'politica-pagos-cancelaciones': {
    title: 'Politica de Pagos y Cancelaciones',
    content: `Las politicas de cancelacion son definidas por el anfitrion.
HOSTEA actua como intermediario de pagos.
Los cargos administrativos no son reembolsables.

Las liquidaciones a anfitriones pueden realizarse manualmente por transferencia bancaria.
El anfitrion es responsable de proporcionar datos bancarios correctos.`
  },
  'terminos-anfitriones': {
    title: 'Terminos para Anfitriones',
    content: `El anfitrion declara tener derecho legal para publicar el alojamiento y es responsable por el estado y seguridad del inmueble.

El anfitrion es responsable por impuestos, licencias y cumplimiento normativo local.
HOSTEA no ofrece seguro de responsabilidad civil ni cobertura por danos.`
  },
  'politica-reembolsos': {
    title: 'Politica de Reembolsos',
    content: `Los reembolsos dependen de la politica de cancelacion del anfitrion y de las condiciones especificas de la reserva.

HOSTEA puede intervenir como mediador, pero no garantiza reembolsos automaticos.`
  },
  'limitacion-responsabilidad': {
    title: 'Limitacion de Responsabilidad',
    content: `HOSTEA no asume responsabilidad civil, penal ni comercial por hechos derivados de la estadia.

El uso de la plataforma es bajo responsabilidad del usuario, quien libera expresamente a HOSTEA de reclamos por danos, perdidas o disputas entre partes.`
  }
};

export default async function LegalPage({ params }: { params: { slug: string } }) {
  const page = await prisma.legalPage.findUnique({ where: { slug: params.slug } });
  const fallback = legalDefaults[params.slug];
  const title = page?.title || fallback?.title;
  const content = page?.content || fallback?.content;

  if (!title || !content) {
    return <div className="p-10">Pagina legal no encontrada.</div>;
  }

  return (
    <div className="px-8 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-6 whitespace-pre-wrap text-neutral-600">{content}</p>
      </div>
    </div>
  );
}
