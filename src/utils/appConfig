export const BRAND_BG = "#161616";

export const sortCategoriesWithAllFirst = (cats = []) => {
  const unique = [...new Set((cats || []).filter(Boolean))];
  const withoutAll = unique.filter((category) => category !== "All");
  const sorted = withoutAll.sort((a, b) =>
    a.localeCompare(b, "th", { numeric: true, sensitivity: "base" })
  );
  return ["All", ...sorted];
};

export const repairInvalidModifierLinks = async (products = [], modifierGroups = [], db) => {
  const validGroupIds = new Set((modifierGroups || []).map((g) => g.id));
  const fixedProducts = (products || []).reduce((acc, product) => {
    const original = Array.isArray(product.modifierGroups) ? product.modifierGroups : [];
    const filtered = original.filter((id) => validGroupIds.has(id));
    if (filtered.length !== original.length) {
      acc.push({ ...product, modifierGroups: filtered });
    }
    return acc;
  }, []);

  if (fixedProducts.length > 0) {
    await Promise.all(
      fixedProducts.map((product) =>
        db.updateProduct(product.id, { modifierGroups: product.modifierGroups })
      )
    );
  }

  return (products || []).map((product) => {
    const fixed = fixedProducts.find((fp) => fp.id === product.id);
    return fixed || product;
  });
};
