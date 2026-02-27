import React, { useState, useMemo, useEffect } from "react";

export default function Products({
  products = [],
  addToCart,
  categories = [],
  selectedCategory,
  setSelectedCategory,
  priceChannel,
  modifierGroups = [],
}) {
  const [showModifierPopup, setShowModifierPopup] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [tempSelection, setTempSelection] = useState([]);

  /* ===============================
     Helpers
  ============================== */

  const formatMoney = (num) =>
    Number(num || 0).toLocaleString();

  const getDisplayPrice = (product) => {
    const channelPrices = {
      pos: product.price,
      grab: product.grabPrice,
      lineman: product.linemanPrice,
      shopee: product.shopeePrice,
    };

    return Number(
      channelPrices[priceChannel] ?? product.price ?? 0
    );
  };

  /* ===============================
     Selected Product
  ============================== */

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  // reset modifier เมื่อเปลี่ยนสินค้า
  useEffect(() => {
    setTempSelection([]);
  }, [selectedProductId]);

  /* ===============================
     Active Modifier Groups
  ============================== */

  const activeModifierGroups = useMemo(() => {
    if (!selectedProduct?.modifierGroups) return [];
    return modifierGroups.filter((g) =>
      selectedProduct.modifierGroups.includes(g.id)
    );
  }, [modifierGroups, selectedProduct]);

  /* ===============================
     Product Click
  ============================== */

  const handleProductClick = (product) => {
    const productModGroups = modifierGroups.filter((g) =>
      product.modifierGroups?.includes(g.id)
    );

    if (productModGroups.length > 0) {
      setSelectedProductId(product.id);
      setShowModifierPopup(true);
    } else {
      addToCart({
        ...product,
        price: getDisplayPrice(product),
        selectedModifier: null,
      });
    }
  };

  /* ===============================
     Modifier Toggle
  ============================== */

  const toggleModifier = (opt) => {
    setTempSelection((prev) => {
      const exists = prev.find((item) => item.id === opt.id);
      if (exists) return prev.filter((i) => i.id !== opt.id);
      return [...prev, opt];
    });
  };

  const modifierTotal = useMemo(
    () =>
      tempSelection.reduce(
        (sum, m) => sum + Number(m.price || 0),
        0
      ),
    [tempSelection]
  );

  /* ===============================
     Filtered Products
  ============================== */

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "All")
      return products;

    return products.filter(
      (p) => p.category === selectedCategory
    );
  }, [products, selectedCategory]);

  /* ===============================
     Confirm Add to Cart
  ============================== */

  const handleConfirmModifier = () => {
    if (!selectedProduct) return;

    const basePrice = getDisplayPrice(selectedProduct);

    addToCart({
      ...selectedProduct,
      price: basePrice + modifierTotal,
      selectedModifier:
        tempSelection.length > 0
          ? {
              id: tempSelection
                .map((m) => m.id)
                .join("-"),
              name: tempSelection
                .map((m) => m.name)
                .join(", "),
              price: modifierTotal,
            }
          : null,
    });

    setShowModifierPopup(false);
    setTempSelection([]);
  };

  /* ===============================
     UI
  ============================== */

  const ProductButton = ({ product }) => {
    const price = getDisplayPrice(product);

    return (
      <button
        onClick={() => handleProductClick(product)}
        style={styles.productCard}
      >
        <div style={styles.productName}>
          {product.name}
        </div>
        <div style={styles.productPrice}>
          ฿{formatMoney(price)}
        </div>
      </button>
    );
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.headerRow}>
        <h2 style={{ margin: 0 }}>เมนูสินค้า</h2>

        <select
          value={selectedCategory}
          onChange={(e) =>
            setSelectedCategory(e.target.value)
          }
          style={styles.select}
        >
          <option value="All">ทั้งหมด</option>
          {categories
            .filter((c) => c !== "All")
            .map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
        </select>
      </div>

      {/* PRODUCT GRID */}
      <div style={styles.scrollArea}>
        <div style={styles.grid}>
          {filteredProducts.map((p) => (
            <ProductButton key={p.id} product={p} />
          ))}
        </div>
      </div>

      {/* MODIFIER POPUP */}
      {showModifierPopup && selectedProduct && (
        <div
          style={styles.modalOverlay}
          onClick={() => {
            setShowModifierPopup(false);
            setTempSelection([]);
          }}
        >
          <div
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>
              เลือกตัวเลือก: {selectedProduct.name}
            </h3>

            <div style={styles.modifierArea}>
              {activeModifierGroups.map((group) => (
                <div key={group.id}>
                  <div style={styles.groupTitle}>
                    {group.name}
                  </div>

                  <div style={styles.modifierGrid}>
                    {(group.options || []).map((opt) => {
                      const isSelected =
                        tempSelection.find(
                          (s) => s.id === opt.id
                        );

                      return (
                        <button
                          key={opt.id}
                          onClick={() =>
                            toggleModifier(opt)
                          }
                          style={{
                            ...styles.modifierBtn,
                            backgroundColor: isSelected
                              ? "#4caf50"
                              : "#333",
                          }}
                        >
                          <div>
                            {opt.name}
                          </div>
                          <div style={styles.modPrice}>
                            +{formatMoney(opt.price)} ฿
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => {
                  setShowModifierPopup(false);
                  setTempSelection([]);
                }}
                style={styles.btnCancel}
              >
                ยกเลิก
              </button>

              <button
                onClick={handleConfirmModifier}
                style={styles.btnConfirm}
              >
                ยืนยัน (+{formatMoney(modifierTotal)} ฿)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===============================
   Styles
============================== */

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    padding: "15px",
  },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "20px",
  },

  select: {
    padding: "8px 12px",
    borderRadius: "8px",
    backgroundColor: "#262626",
    color: "#fff",
    border: "1px solid #444",
  },

  scrollArea: {
    flex: 1,
    overflowY: "auto",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(110px, 1fr))",
    gap: "10px",
  },

  productCard: {
    aspectRatio: "1 / 1",
    padding: "15px",
    backgroundColor: "#262626",
    border: "1px solid #333",
    borderRadius: "12px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: "#fff",
  },

  productName: {
    fontWeight: "bold",
    fontSize: "14px",
    marginBottom: "8px",
    textAlign: "center",
  },

  productPrice: {
    color: "#4caf50",
    fontWeight: "bold",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.8)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  modalContent: {
    background: "#262626",
    padding: "25px",
    borderRadius: "16px",
    width: "90%",
    maxWidth: "450px",
  },

  modifierArea: {
    maxHeight: "60vh",
    overflowY: "auto",
    margin: "20px 0",
  },

  groupTitle: {
    marginBottom: "8px",
    fontWeight: "bold",
    color: "#aaa",
  },

  modifierGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginBottom: "15px",
  },

  modifierBtn: {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #444",
    color: "#fff",
    cursor: "pointer",
  },

  modPrice: {
    fontSize: "12px",
    color: "#4caf50",
  },

  modalFooter: {
    display: "flex",
    gap: "10px",
  },

  btnCancel: {
    flex: 1,
    padding: "12px",
    background: "none",
    border: "1px solid #555",
    color: "#888",
    borderRadius: "8px",
  },

  btnConfirm: {
    flex: 2,
    padding: "12px",
    backgroundColor: "#2196f3",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
  },
};