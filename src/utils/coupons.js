/**
 * Groups raw redeemed rewards by their name and filters out used ones.
 * Returns an array of objects: { name, count, ids: [], sampleReward }
 */
export function groupAvailableCoupons(redeemedRewards) {
  if (!Array.isArray(redeemedRewards)) return [];
  
  const available = redeemedRewards.filter(r => !r.used_at);
  const groups = {};

  available.forEach(r => {
    if (!groups[r.name]) {
      groups[r.name] = {
        name: r.name,
        count: 0,
        ids: [],
        sampleReward: r
      };
    }
    groups[r.name].count += 1;
    groups[r.name].ids.push(r.id);
  });

  return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name, 'th'));
}
