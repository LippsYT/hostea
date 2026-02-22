const DEFAULT_BASE_URL = 'https://api.cloudbeds.com/api/v1.1';
const DEFAULT_AVAILABILITY_PATH = '/availability';
const DEFAULT_CREATE_RESERVATION_PATH = '/reservations';
const DEFAULT_CREATE_BLOCK_PATH = '/blocks';

export type CloudbedsRoomTypeAvailability = {
  roomTypeId: string;
  name: string;
  availableUnits: number;
};

export type CloudbedsAvailabilityResult = {
  available: boolean;
  roomTypes: CloudbedsRoomTypeAvailability[];
  provider: 'cloudbeds';
};

export type CloudbedsMapping = {
  propertyId: string;
  roomTypeId?: string;
};

type CloudbedsReservationPayload = {
  listingId: string;
  reservationId: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  guestName: string;
  guestEmail?: string | null;
};

const toDateYmd = (value: Date) => value.toISOString().slice(0, 10);

const getToken = () => process.env.CLOUDBEDS_API_TOKEN || process.env.CLOUDBEDS_TOKEN || '';

const getBaseUrl = () => (process.env.CLOUDBEDS_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

const getPath = (envValue: string | undefined, fallback: string) => {
  if (!envValue) return fallback;
  return envValue.startsWith('/') ? envValue : `/${envValue}`;
};

const parseListingMap = () => {
  const raw = process.env.CLOUDBEDS_LISTING_MAP;
  if (!raw) return {} as Record<string, CloudbedsMapping>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {} as Record<string, CloudbedsMapping>;
    return parsed as Record<string, CloudbedsMapping>;
  } catch {
    return {} as Record<string, CloudbedsMapping>;
  }
};

export const isCloudbedsEnabled = () => {
  const enabled = (process.env.CLOUDBEDS_ENABLED || '').toLowerCase();
  return enabled === '1' || enabled === 'true' || enabled === 'yes';
};

export const isCloudbedsStrict = () => {
  const strict = (process.env.CLOUDBEDS_STRICT || 'true').toLowerCase();
  return strict === '1' || strict === 'true' || strict === 'yes';
};

export const getCloudbedsMappingForListing = (listingId: string): CloudbedsMapping | null => {
  const map = parseListingMap();
  const value = map[listingId];
  if (!value || !value.propertyId) return null;
  return value;
};

const cloudbedsRequest = async (path: string, init: RequestInit = {}) => {
  const token = getToken();
  if (!token) throw new Error('CLOUDBEDS_API_TOKEN no configurado');

  const headers = new Headers(init.headers || {});
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('x-api-key', token);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = typeof data === 'string' ? data : data?.message || data?.error || response.statusText;
    throw new Error(`Cloudbeds ${response.status}: ${message}`);
  }

  return data;
};

const normalizeAvailabilityRows = (payload: any) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.availability)) return payload.availability;
  if (Array.isArray(payload?.rooms)) return payload.rooms;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

export const getCloudbedsAvailability = async (args: {
  listingId: string;
  checkIn: Date;
  checkOut: Date;
}) => {
  const mapping = getCloudbedsMappingForListing(args.listingId);
  if (!mapping) {
    throw new Error('Listing sin mapeo Cloudbeds');
  }

  const availabilityPath = getPath(process.env.CLOUDBEDS_AVAILABILITY_PATH, DEFAULT_AVAILABILITY_PATH);
  const params = new URLSearchParams({
    propertyId: mapping.propertyId,
    startDate: toDateYmd(args.checkIn),
    endDate: toDateYmd(args.checkOut)
  });
  if (mapping.roomTypeId) {
    params.set('roomTypeId', mapping.roomTypeId);
  }

  const data = await cloudbedsRequest(`${availabilityPath}?${params.toString()}`);
  const rows = normalizeAvailabilityRows(data);

  const roomTypes: CloudbedsRoomTypeAvailability[] = rows
    .map((row: any) => {
      const roomTypeId = String(
        row?.roomTypeId ??
          row?.roomTypeID ??
          row?.room_type_id ??
          row?.room_id ??
          row?.id ??
          ''
      );
      const name = String(row?.roomTypeName ?? row?.room_name ?? row?.name ?? 'Habitacion');
      const availableUnits = Number(
        row?.availableUnits ?? row?.available ?? row?.remaining ?? row?.inventory ?? row?.qty ?? 0
      );
      return {
        roomTypeId,
        name,
        availableUnits: Number.isFinite(availableUnits) ? availableUnits : 0
      };
    })
    .filter((row: CloudbedsRoomTypeAvailability) => row.roomTypeId.length > 0);

  const scopedRows = mapping.roomTypeId
    ? roomTypes.filter((row) => row.roomTypeId === mapping.roomTypeId)
    : roomTypes;

  const fallbackAvailable = Boolean(data?.available ?? data?.isAvailable);
  const available =
    scopedRows.length > 0
      ? scopedRows.some((row) => row.availableUnits > 0)
      : fallbackAvailable;

  return {
    available,
    roomTypes: scopedRows.length > 0 ? scopedRows : roomTypes,
    provider: 'cloudbeds' as const
  } satisfies CloudbedsAvailabilityResult;
};

export const createCloudbedsReservation = async (payload: CloudbedsReservationPayload) => {
  const mapping = getCloudbedsMappingForListing(payload.listingId);
  if (!mapping) {
    throw new Error('Listing sin mapeo Cloudbeds');
  }

  const writeMode = (process.env.CLOUDBEDS_WRITE_MODE || 'reservation').toLowerCase();
  const path =
    writeMode === 'block'
      ? getPath(process.env.CLOUDBEDS_CREATE_BLOCK_PATH, DEFAULT_CREATE_BLOCK_PATH)
      : getPath(
          process.env.CLOUDBEDS_CREATE_RESERVATION_PATH,
          DEFAULT_CREATE_RESERVATION_PATH
        );

  const body = {
    propertyId: mapping.propertyId,
    roomTypeId: mapping.roomTypeId || undefined,
    checkIn: toDateYmd(payload.checkIn),
    checkOut: toDateYmd(payload.checkOut),
    guests: payload.guests,
    guestName: payload.guestName,
    guestEmail: payload.guestEmail || undefined,
    externalReference: payload.reservationId,
    source: 'HOSTEA'
  };

  const response = await cloudbedsRequest(path, {
    method: 'POST',
    body: JSON.stringify(body)
  });

  return {
    externalId:
      response?.id ||
      response?.reservationId ||
      response?.reservation_id ||
      response?.blockId ||
      response?.block_id ||
      null,
    raw: response
  };
};
