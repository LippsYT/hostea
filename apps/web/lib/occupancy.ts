export type OccupancyValue = {
  adults: number;
  children: number;
  infants: number;
};

const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

export const buildOccupancySummary = ({ adults, children, infants }: OccupancyValue) => {
  const parts = [
    pluralize(adults, 'adulto', 'adultos'),
    pluralize(children, 'nino', 'ninos'),
    pluralize(infants, 'infante', 'infantes')
  ];
  return parts.join(' · ');
};
