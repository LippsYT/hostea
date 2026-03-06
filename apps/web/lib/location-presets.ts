export const locationPresets: Record<string, Record<string, string[]>> = {
  Argentina: {
    'Buenos Aires': ['Palermo', 'Recoleta', 'Belgrano', 'Puerto Madero', 'San Telmo'],
    'Mar del Plata': ['Centro', 'Guemes', 'Playa Grande', 'La Perla'],
    Cordoba: ['Nueva Cordoba', 'Guemes', 'Centro', 'Alta Cordoba']
  },
  Uruguay: {
    Montevideo: ['Pocitos', 'Punta Carretas', 'Centro', 'Ciudad Vieja'],
    'Punta del Este': ['La Barra', 'Playa Brava', 'Peninsula', 'Manantiales']
  },
  Chile: {
    Santiago: ['Providencia', 'Las Condes', 'Santiago Centro', 'Bellavista'],
    Valparaiso: ['Cerro Alegre', 'Cerro Concepcion', 'Plan', 'Playa Ancha']
  },
  Mexico: {
    'Ciudad de Mexico': ['Polanco', 'Roma Norte', 'Condesa', 'Coyoacan'],
    Cancun: ['Zona Hotelera', 'Centro', 'Puerto Juarez']
  },
  Spain: {
    Madrid: ['Centro', 'Salamanca', 'Chamberi', 'Retiro'],
    Barcelona: ['Eixample', 'Gracia', 'Barceloneta', 'Sants']
  },
  'United States': {
    'New York': ['Manhattan', 'Brooklyn', 'Queens', 'Bronx'],
    Miami: ['Downtown', 'Wynwood', 'Brickell', 'Miami Beach']
  }
};

export const normalizeOptions = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'es')
  );

export const getFallbackCountries = () => normalizeOptions(Object.keys(locationPresets));

export const getFallbackCitiesByCountry = (country: string) =>
  normalizeOptions(Object.keys(locationPresets[country] || {}));

export const getFallbackNeighborhoods = (country: string, city: string) =>
  normalizeOptions(locationPresets[country]?.[city] || []);
