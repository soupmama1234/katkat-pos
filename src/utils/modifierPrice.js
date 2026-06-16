// src/utils/modifierPrice.js
// Channel-specific pricing for modifier options
// Mirrors product pricing logic in Products.jsx getDisplayPrice()

/**
 * Get modifier option price for a given channel.
 *
 * Fallback rules:
 *   grab    → grabPrice ?? price
 *   lineman → linemanPrice ?? price
 *   shopee  → shopeePrice ?? price
 *   pos / * → price
 *
 * Note: 0 means FREE and must be respected (use ??, not ||)
 *
 * @param {object} option  - modifier option { price, grabPrice?, linemanPrice?, shopeePrice? }
 * @param {string} channel - "pos" | "grab" | "lineman" | "shopee"
 * @returns {number}
 */
export function getModifierPriceByChannel(option, channel) {
  if (!option) return 0

  const base = Number(option.price) || 0

  switch (channel) {
    case 'grab':    return Number(option.grabPrice    ?? base)
    case 'lineman': return Number(option.linemanPrice ?? base)
    case 'shopee':  return Number(option.shopeePrice  ?? base)
    default:        return base
  }
}
