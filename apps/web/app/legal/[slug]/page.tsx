import { prisma } from '@/lib/db';

const legalDefaults: Record<string, { title: string; content: string }> = {
  'terminos-condiciones': {
    title: 'Términos y Condiciones – HOSTEA',
    content: `Última actualización: February 6, 2026

1. Naturaleza del servicio
HOSTEA es una plataforma tecnológica que conecta huéspedes con anfitriones para la publicación y reserva de alojamientos.

HOSTEA:
- No es propietaria de los alojamientos.
- No administra físicamente las propiedades.
- No actúa como aseguradora ni garante de ninguna estadía.
- No ofrece seguros ni protección contra daños o pérdidas.
El contrato de hospedaje se celebra exclusivamente entre el huésped y el anfitrión.

2. Registro y cuentas
Los usuarios deben:
- Proporcionar información veraz y actualizada.
- Ser mayores de 18 años.
- Mantener la confidencialidad de sus credenciales.
HOSTEA puede suspender cuentas por información falsa, fraude o incumplimiento de normas.

3. Reservas
Al confirmar una reserva se genera un acuerdo entre huésped y anfitrión. HOSTEA actúa como intermediario tecnológico. La disponibilidad depende de la información del anfitrión y sincronización de calendarios externos. HOSTEA no garantiza disponibilidad en plataformas externas.

4. Pagos
Los pagos se procesan a través de pasarelas externas. HOSTEA cobra una comisión por el uso de la plataforma. Actualmente los pagos a anfitriones pueden realizarse manualmente. HOSTEA no actúa como entidad financiera ni custodio bancario.

5. Cancelaciones
Las políticas de cancelación son definidas por cada anfitrión. HOSTEA no es responsable por decisiones de cancelación del anfitrión ni penalidades aplicadas conforme a la política publicada.

6. Limitación de responsabilidad
HOSTEA no será responsable por daños materiales dentro del alojamiento, conflictos entre huésped y anfitrión, pérdidas económicas derivadas de cancelaciones, problemas con servicios públicos del alojamiento o fallas en plataformas externas. La responsabilidad máxima de HOSTEA se limita al monto de comisión efectivamente cobrado por la plataforma en la reserva en cuestión.

7. Conducta del usuario
Está prohibido realizar pagos fuera del sistema para evadir comisiones, usar la plataforma para actividades ilegales o publicar contenido engañoso.

8. Modificaciones
HOSTEA puede actualizar estos términos en cualquier momento.

EXENCIÓN CLAVE (MUY IMPORTANTE)
HOSTEA actúa exclusivamente como intermediario tecnológico y no asume responsabilidad por daños, pérdidas, lesiones, incumplimientos contractuales o cualquier disputa derivada del uso de la plataforma.`
  },
  'politica-privacidad': {
    title: 'Política de Privacidad',
    content: `HOSTEA recopila datos personales (nombre, email, teléfono), información de pago (procesada por terceros) y datos de uso de la plataforma.

HOSTEA no vende datos personales. Los datos pueden compartirse con procesadores de pago, proveedores técnicos y autoridades legales cuando sea requerido.

El usuario puede solicitar acceso, rectificación y eliminación de datos.`
  },
  'politica-pagos-cancelaciones': {
    title: 'Política de Pagos y Cancelaciones',
    content: `Los pagos se realizan a través de pasarelas externas. HOSTEA no almacena datos completos de tarjetas.

Las liquidaciones a anfitriones pueden realizarse manualmente mediante transferencia bancaria. El anfitrión es responsable de proporcionar datos bancarios correctos. HOSTEA no se responsabiliza por errores en datos bancarios ni demoras bancarias externas.`
  },
  'terminos-anfitriones': {
    title: 'Términos para Anfitriones',
    content: `El anfitrión declara tener derecho legal para publicar el alojamiento, ser responsable por el estado y seguridad del inmueble y cumplir normativas locales.

El anfitrión es responsable por impuestos aplicables, licencias requeridas y cumplimiento normativo municipal. HOSTEA no ofrece seguro de responsabilidad civil ni cobertura por daños.`
  },
  'politica-reembolsos': {
    title: 'Política de Reembolsos',
    content: `Los reembolsos dependen exclusivamente de la política de cancelación del anfitrión y de las condiciones específicas de la reserva.

HOSTEA puede intervenir como mediador, pero no garantiza reembolsos automáticos.`
  },
  'limitacion-responsabilidad': {
    title: 'Limitación de Responsabilidad',
    content: `HOSTEA actúa exclusivamente como intermediario tecnológico y no asume responsabilidad por daños, pérdidas, lesiones, incumplimientos contractuales o cualquier disputa derivada del uso de la plataforma.`
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
