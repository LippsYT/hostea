export const calculateHostSplit = (total: number, commissionPercent: number) => {
  const commission = total * commissionPercent;
  const host = total - commission;
  return { commission, host };
};
