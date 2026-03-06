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
  }
};

export const getCountries = () => Object.keys(locationPresets);

export const getCitiesByCountry = (country: string) =>
  Object.keys(locationPresets[country] || {});

export const getNeighborhoods = (country: string, city: string) =>
  locationPresets[country]?.[city] || [];
