import { TicketStatus } from '@prisma/client';

export const formatSupportCaseNumber = (caseSequence?: number | null) => {
  if (!caseSequence || !Number.isFinite(caseSequence)) return '#SUP-PENDIENTE';
  return `#SUP-${String(caseSequence).padStart(6, '0')}`;
};

export const ticketStatusLabel = (status: TicketStatus) => {
  switch (status) {
    case 'OPEN':
      return 'Abierto';
    case 'IN_REVIEW':
      return 'En revision';
    case 'WAITING_FOR_USER':
      return 'Pendiente de respuesta del usuario';
    case 'ESCALATED':
      return 'Escalado';
    case 'RESOLVED':
      return 'Resuelto';
    case 'CLOSED':
      return 'Cerrado';
    default:
      return status;
  }
};

export const extractTicketCategory = (subject: string) => {
  const match = subject.match(/^\[([^\]]+)\]/);
  return match?.[1] || 'General';
};
