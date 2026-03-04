export function computeDiscountTotal(subtotal = 0, discounts = []) {
  let remain = Number(subtotal) || 0;
  let totalDiscount = 0;

  const safeDiscounts = Array.isArray(discounts) ? discounts : [];
  const amountDiscounts = safeDiscounts.filter((d) => d?.mode === "amount");
  const percentDiscounts = safeDiscounts.filter((d) => d?.mode === "percent");

  for (const d of amountDiscounts) {
    const value = Math.max(0, Number(d.value) || 0);
    const applied = Math.min(remain, value);
    remain -= applied;
    totalDiscount += applied;
  }

  for (const d of percentDiscounts) {
    const value = Math.max(0, Math.min(100, Number(d.value) || 0));
    const applied = remain * (value / 100);
    remain -= applied;
    totalDiscount += applied;
  }

  return Math.max(0, Math.min(Number(subtotal) || 0, Math.round(totalDiscount * 100) / 100));
}

export function parseRewardDiscount(reward) {
  if (!reward) return null;

  const explicitMode = reward.discount_mode;
  const explicitValue = Number(reward.discount_value);
  if (["amount", "percent"].includes(explicitMode) && explicitValue > 0) {
    return {
      mode: explicitMode,
      value: explicitValue,
      label: `🎁 ${reward.name}`,
      source: "reward",
      rewardId: reward.id,
    };
  }

  const desc = String(reward.description || "");
  const matched = desc.match(/DISCOUNT_(AMOUNT|PERCENT)\s*:\s*(\d+(?:\.\d+)?)/i);
  if (!matched) return null;

  const mode = matched[1].toUpperCase() === "PERCENT" ? "percent" : "amount";
  const value = Number(matched[2]);
  if (!(value > 0)) return null;

  return {
    mode,
    value,
    label: `🎁 ${reward.name}`,
    source: "reward",
    rewardId: reward.id,
  };
}
