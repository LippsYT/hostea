export type BookingMode = 'instant' | 'approval';

export const bookingModeFromInstantBook = (instantBook: boolean): BookingMode =>
  instantBook ? 'instant' : 'approval';

export const instantBookFromBookingMode = (mode: BookingMode) => mode === 'instant';

export const bookingModeLabel = (mode: BookingMode) =>
  mode === 'instant' ? 'Reserva inmediata (Instant)' : 'Reservas por aprobacion';

