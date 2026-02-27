import { PaymentStatus, ReservationStatus } from '@prisma/client';

export type ReservationWorkflowStatus =
  | 'pending_approval'
  | 'awaiting_payment'
  | 'confirmed'
  | 'rejected'
  | 'expired';

type WorkflowInput = {
  status: ReservationStatus;
  paymentExpiresAt?: Date | null;
  holdExpiresAt?: Date | null;
  paymentStatus?: PaymentStatus | null;
  now?: Date;
};

export const getReservationWorkflowStatus = ({
  status,
  paymentExpiresAt,
  holdExpiresAt,
  paymentStatus,
  now = new Date()
}: WorkflowInput): ReservationWorkflowStatus => {
  if (status === ReservationStatus.PENDING_APPROVAL) {
    return 'pending_approval';
  }

  if (status === ReservationStatus.AWAITING_PAYMENT) {
    const expiresAt = paymentExpiresAt || holdExpiresAt || null;
    if (expiresAt && expiresAt.getTime() <= now.getTime()) {
      return 'expired';
    }
    return 'awaiting_payment';
  }

  if (
    status === ReservationStatus.CONFIRMED ||
    status === ReservationStatus.CHECKED_IN ||
    status === ReservationStatus.COMPLETED
  ) {
    return 'confirmed';
  }

  if (status === ReservationStatus.PENDING_PAYMENT) {
    if (!holdExpiresAt && !paymentStatus && !paymentExpiresAt) {
      return 'pending_approval';
    }

    const expiresAt = paymentExpiresAt || holdExpiresAt || null;
    if (expiresAt && expiresAt.getTime() > now.getTime()) {
      return 'awaiting_payment';
    }

    return 'expired';
  }

  if (status === ReservationStatus.REJECTED) {
    return 'rejected';
  }

  if (status === ReservationStatus.EXPIRED) {
    return 'expired';
  }

  if (status === ReservationStatus.CANCELED) {
    if (paymentStatus === PaymentStatus.FAILED) {
      return 'expired';
    }
    return 'rejected';
  }

  if (status === ReservationStatus.REFUNDED) {
    return 'expired';
  }

  return 'rejected';
};

export const isPendingApprovalReservation = (input: WorkflowInput) =>
  getReservationWorkflowStatus(input) === 'pending_approval';

export const isAwaitingPaymentReservation = (input: WorkflowInput) =>
  getReservationWorkflowStatus(input) === 'awaiting_payment';
