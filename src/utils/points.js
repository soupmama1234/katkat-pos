const RATE_KEY = "katkat_point_rate";
const TIERS_KEY = "katkat_bonus_tiers";

const defaultRate = { baht: 10, points: 1 };
const defaultTiers = [
  { id: 1, minSpend: 200, multiplier: 2 },
  { id: 2, minSpend: 350, multiplier: 3 },
];

export const loadRate = () => {
  try {
    return JSON.parse(localStorage.getItem(RATE_KEY)) || defaultRate;
  } catch {
    return defaultRate;
  }
};

export const loadTiers = () => {
  try {
    return JSON.parse(localStorage.getItem(TIERS_KEY)) || defaultTiers;
  } catch {
    return defaultTiers;
  }
};

export const saveRate = (rate) => localStorage.setItem(RATE_KEY, JSON.stringify(rate));
export const saveTiers = (tiers) => localStorage.setItem(TIERS_KEY, JSON.stringify(tiers));

export const calcPoints = (total, rate, tiers) => {
  const base = Math.floor(total / rate.baht) * rate.points;
  const sorted = [...tiers].sort((a, b) => b.minSpend - a.minSpend);
  const match = sorted.find((tier) => total >= tier.minSpend);
  return match ? base * match.multiplier : base;
};

export const nextThreshold = (total, tiers) => {
  const sorted = [...tiers].sort((a, b) => a.minSpend - b.minSpend);
  return sorted.find((tier) => total < tier.minSpend) || null;
};

export const getPointSettings = () => ({ rate: loadRate(), tiers: loadTiers() });

