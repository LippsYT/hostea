import { PaymentStatus, ReservationStatus } from '@prisma/client';

export type ReservationWorkflowStatus =
  | 'pending_approval'
  | 'awaiting_payment'
  | 'confirmed'
  | 'rejected'
  | 'expired';

type WorkflowInput = {
  status: ReservationStatus;
  holdExpiresAt?: Date | null;
  paymentStatus?: PaymentStatus | null;
  now?: Date;
};

export const getReservationWorkflowStatus = ({
  status,
  holdExpiresAt,
  paymentStatus,
  now = new Date()
}: WorkflowInput): ReservationWorkflowStatus => {
  if (
    status === ReservationStatus.CONFIRMED ||
    status === ReservationStatus.CHECKED_IN ||
    status === ReservationStatus.COMPLETED
  ) {
    return 'confirmed';
  }

  if (status === ReservationStatus.PENDING_PAYMENT) {
    if (!holdExpiresAt && !paymentStatus) {
      return 'pending_approval';
    }

    if (holdExpiresAt && holdExpiresAt.getTime() > now.getTime()) {
      return 'awaiting_payment';
    }

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
