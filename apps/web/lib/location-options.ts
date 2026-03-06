const getOptions = async (params: URLSearchParams) => {
  const response = await fetch(`/api/location/options?${params.toString()}`);
  if (!response.ok) {
    throw new Error('No se pudieron cargar opciones de ubicacion');
  }
  const data = (await response.json()) as { options?: string[] };
  return Array.isArray(data.options) ? data.options : [];
};

export const fetchCountryOptions = async () => {
  const params = new URLSearchParams({ level: 'countries' });
  return getOptions(params);
};

export const fetchCityOptions = async (country: string) => {
  const params = new URLSearchParams({ level: 'cities', country });
  return getOptions(params);
};

export const fetchNeighborhoodOptions = async (country: string, city: string) => {
  const params = new URLSearchParams({ level: 'neighborhoods', country, city });
  return getOptions(params);
};
