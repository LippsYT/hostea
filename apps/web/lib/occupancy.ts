export type OccupancyValue = {
  adults: number;
  children: number;
  infants: number;
};

export type AgeRules = {
  infantMaxAge?: number | null;
  childMaxAge?: number | null;
  adultMinAge?: number | null;
  minimumAge?: number | null;
  childrenLabelFallback?: string;
  infantsAllowed?: boolean;
};

const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

const defaultAgeRules = {
  infantMaxAge: 2,
  childMaxAge: 12,
  adultMinAge: 13
};

export const buildOccupancySummary = ({ adults, children, infants }: OccupancyValue) => {
  const parts = [
    pluralize(adults, 'adulto', 'adultos'),
    pluralize(children, 'nino', 'ninos'),
    pluralize(infants, 'infante', 'infantes')
  ];
  return parts.join(' · ');
};

const buildRangeLabel = (start: number | null | undefined, end: number | null | undefined) => {
  if (start === null || start === undefined) return null;
  if (end === null || end === undefined) return `${start}+`;
  return `${start}-${end}`;
};

export const buildHumanAgeRules = (rules?: AgeRules) => {
  const infantMaxAge = rules?.infantMaxAge ?? defaultAgeRules.infantMaxAge;
  const childMaxAge = rules?.childMaxAge ?? defaultAgeRules.childMaxAge;
  const adultMinAge = rules?.adultMinAge ?? defaultAgeRules.adultMinAge;
  const minimumAge = rules?.minimumAge ?? null;
  const infantsAllowed = rules?.infantsAllowed ?? true;

  const childStart = infantsAllowed ? infantMaxAge + 1 : 0;

  return {
    adults: `Adultos: ${buildRangeLabel(adultMinAge, null)}`,
    children:
      minimumAge && minimumAge > childStart
        ? rules?.childrenLabelFallback || 'Ninos segun reglas del alojamiento'
        : `Ninos: ${buildRangeLabel(childStart, childMaxAge)}`,
    infants: infantsAllowed
      ? `Infantes: ${buildRangeLabel(0, infantMaxAge)}`
      : 'Infantes no permitidos'
  };
};

export const buildAgeRulesSummary = (rules?: AgeRules) => {
  const labels = buildHumanAgeRules(rules);
  return [labels.adults, labels.children, labels.infants].join(' · ');
};
