import { NextResponse } from 'next/server';
import {
  getFallbackCitiesByCountry,
  getFallbackCountries,
  getFallbackNeighborhoods,
  normalizeOptions
} from '@/lib/location-presets';

const cache = new Map<string, { expiresAt: number; options: string[] }>();

const getCached = (key: string) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.options;
};

const setCached = (key: string, options: string[], ttlMs: number) => {
  cache.set(key, { expiresAt: Date.now() + ttlMs, options });
};

const fetchCountries = async () => {
  const cached = getCached('countries');
  if (cached) return cached;

  try {
    const response = await fetch('https://restcountries.com/v3.1/all?fields=name', {
      headers: {
        Accept: 'application/json'
      },
      next: { revalidate: 60 * 60 * 24 }
    });
    if (!response.ok) throw new Error('countries_fetch_failed');
    const json = (await response.json()) as Array<{ name?: { common?: string; official?: string } }>;
    const options = normalizeOptions(
      json.map((item) => item.name?.common || item.name?.official || '')
    );
    if (options.length > 0) {
      setCached('countries', options, 1000 * 60 * 60 * 24);
      return options;
    }
  } catch {}

  const fallback = getFallbackCountries();
  setCached('countries', fallback, 1000 * 60 * 60);
  return fallback;
};

const fetchCities = async (country: string) => {
  const key = `cities:${country.toLowerCase()}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const response = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ country }),
      next: { revalidate: 60 * 60 * 6 }
    });
    if (!response.ok) throw new Error('cities_fetch_failed');
    const json = (await response.json()) as { data?: string[] };
    const options = normalizeOptions(Array.isArray(json?.data) ? json.data : []);
    if (options.length > 0) {
      setCached(key, options, 1000 * 60 * 60 * 6);
      return options;
    }
  } catch {}

  const fallback = getFallbackCitiesByCountry(country);
  setCached(key, fallback, 1000 * 60 * 30);
  return fallback;
};

const extractNeighborhood = (address: Record<string, string | undefined>) =>
  address.suburb ||
  address.neighbourhood ||
  address.neighborhood ||
  address.quarter ||
  address.city_district ||
  address.district ||
  address.borough;

const fetchNeighborhoods = async (country: string, city: string) => {
  const key = `neighborhoods:${country.toLowerCase()}:${city.toLowerCase()}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      city,
      country,
      limit: '180'
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'es',
        'User-Agent': 'hostea-location-service/1.0 (support@gohostea.com)'
      },
      next: { revalidate: 60 * 60 * 6 }
    });
    if (!response.ok) throw new Error('neighborhoods_fetch_failed');
    const json = (await response.json()) as Array<{ address?: Record<string, string | undefined> }>;
    const options = normalizeOptions(
      json
        .map((item) => extractNeighborhood(item.address || {}))
        .filter((value): value is string => Boolean(value))
    );
    if (options.length > 0) {
      setCached(key, options, 1000 * 60 * 60 * 6);
      return options;
    }
  } catch {}

  const fallback = getFallbackNeighborhoods(country, city);
  setCached(key, fallback, 1000 * 60 * 30);
  return fallback;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const level = searchParams.get('level');
  const country = (searchParams.get('country') || '').trim();
  const city = (searchParams.get('city') || '').trim();

  if (level === 'countries') {
    const options = await fetchCountries();
    return NextResponse.json({ options });
  }

  if (level === 'cities') {
    if (!country) {
      return NextResponse.json({ error: 'country requerido' }, { status: 400 });
    }
    const options = await fetchCities(country);
    return NextResponse.json({ options });
  }

  if (level === 'neighborhoods') {
    if (!country || !city) {
      return NextResponse.json({ error: 'country y city requeridos' }, { status: 400 });
    }
    const options = await fetchNeighborhoods(country, city);
    return NextResponse.json({ options });
  }

  return NextResponse.json({ error: 'level invalido' }, { status: 400 });
}
