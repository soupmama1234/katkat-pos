import React, { useState, useMemo } from "react";
import { supabase } from "../supabase";

export default function MobilePOS({
  products = [],
  addToCart,
  increaseQty,
  decreaseQty,
  onClearCart,
  categories = [],
  selectedCategory,
  setSelectedCategory,
  cart = [],
  total = 0,
  onCheckout,
  priceChannel,
  setPriceChannel,
  modifierGroups = [],
}) {
  const [showCart, setShowCart] = useState(false);
  const [refValue, setRefValue] = useState("");
  const [showModifierPopup, setShowModifierPopup] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [tempSelection, setTempSelection] = useState([]);

  /* ---------------- PRICE ---------------- */

  const getDisplayPrice = (product) => {
    const channelPrices = {
      pos: product.price,
      grab: product.grabPrice,
      lineman: product.linemanPrice,
      shopee: product.shopeePrice,
    };
    return channelPrices[priceChannel] ?? product.price;
  };

  /* ---------------- MODIFIER ---------------- */

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const activeModifierGroups = useMemo(
    () =>
      modifierGroups.filter((g) =>
        selectedProduct?.modifierGroups?.includes(g.id)
      ),
    [modifierGroups, selectedProduct]
  );

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
        channel: priceChannel,
      });
    }
  };

  const toggleModifier = (opt) => {
    setTempSelection((prev) => {
      const exists = prev.find((i) => i.id === opt.id);
      if (exists) return prev.filter((i) => i.id !== opt.id);
      return [...prev, opt];
    });
  };

  const handleConfirmModifier = () => {
    if (!selectedProduct) return;

    const basePrice = getDisplayPrice(selectedProduct);
    const modTotal = tempSelection.reduce(
      (sum, m) => sum + Number(m.price),
      0
    );

    addToCart({
      ...selectedProduct,
      price: basePrice + modTotal,
      channel: priceChannel,
      selectedModifier:
        tempSelection.length > 0
          ? {
              id: tempSelection.map((m) => m.id).join("-"),
              name: tempSelection.map((m) => m.name).join(", "),
              price: modTotal,
            }
          : null,
    });

    setShowModifierPopup(false);
    setTempSelection([]);
  };

  /* ---------------- CHECKOUT ---------------- */

  const handleConfirmCheckout = (type) => {
    let finalRef = refValue;
    if (type === "grab" && refValue) finalRef = `GF-${refValue}`;

    onCheckout(type, finalRef);
    setRefValue("");
    setShowCart(false);
  };

  const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);

  /* ---------------- UI ---------------- */

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#000",
      }}
    >
      {/* CATEGORY */}
      <div style={styles.categoryBar}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              ...styles.catBtn,
              background: selectedCategory === cat ? "#fff" : "#222",
              color: selectedCategory === cat ? "#000" : "#fff",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* PRODUCT GRID */}
      <div style={styles.productGrid}>
        {products
          .filter(
            (p) =>
              !selectedCategory ||
              selectedCategory === "All" ||
              p.category === selectedCategory
          )
          .map((p) => (
            <button
              key={p.id}
              onClick={() => handleProductClick(p)}
              style={styles.productCard}
            >
              <div>{p.name}</div>
              <div style={{ color: "#4caf50" }}>
                ฿{getDisplayPrice(p).toLocaleString()}
              </div>
            </button>
          ))}
      </div>

      {/* FLOATING CART BUTTON */}
      {cart.length > 0 && !showCart && (
        <button
          style={styles.floatingCart}
          onClick={() => setShowCart(true)}
        >
          🛒 {totalQty} รายการ · ฿{total.toLocaleString()}
        </button>
      )}

      {/* ================= CART OVERLAY ================= */}
      {showCart && (
        <div style={styles.cartOverlay}>
          <div style={styles.cartContainer}>
            <div style={styles.cartHeader}>
              <h3>ตะกร้าสินค้า</h3>
              <button onClick={() => setShowCart(false)}>✕</button>
            </div>

            <div style={styles.cartList}>
              {cart.map((item, idx) => (
                <div key={`${item.id}-${idx}`} style={styles.cartItem}>
                  <div style={{ flex: 1 }}>
                    <div>{item.name}</div>
                    {item.selectedModifier && (
                      <div style={{ fontSize: 12, color: "#aaa" }}>
                        • {item.selectedModifier.name}
                      </div>
                    )}
                    <div>
                      ฿{item.price} × {item.qty}
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() =>
                        decreaseQty(
                          item.id,
                          item.channel,
                          item.selectedModifier?.id
                        )
                      }
                    >
                      −
                    </button>
                    {item.qty}
                    <button
                      onClick={() =>
                        increaseQty(
                          item.id,
                          item.channel,
                          item.selectedModifier?.id
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              {cart.length > 0 && (
                <button onClick={onClearCart}>ล้างทั้งหมด</button>
              )}
            </div>

            <div style={styles.cartFooter}>
              <h3>รวม ฿{total.toLocaleString()}</h3>

              {priceChannel === "pos" ? (
                <>
                  <button
                    onClick={() => handleConfirmCheckout("cash")}
                  >
                    เงินสด
                  </button>
                  <button
                    onClick={() => handleConfirmCheckout("transfer")}
                  >
                    โอนเงิน
                  </button>
                </>
              ) : (
                <button
                  onClick={() =>
                    handleConfirmCheckout(priceChannel)
                  }
                >
                  บันทึก {priceChannel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODIFIER POPUP ================= */}
      {showModifierPopup && selectedProduct && (
        <div
          style={styles.modifierOverlay}
          onClick={() => {
            setShowModifierPopup(false);
            setTempSelection([]);
          }}
        >
          <div
            style={styles.modifierModal}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{selectedProduct.name}</h3>

            {activeModifierGroups.map((group) => (
              <div key={group.id}>
                <strong>{group.name}</strong>

                {group.options?.map((opt) => {
                  const selected = tempSelection.find(
                    (s) => s.id === opt.id
                  );
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleModifier(opt)}
                      style={{
                        background: selected
                          ? "#4caf50"
                          : "#2a2a2a",
                        color: "#fff",
                        display: "block",
                        width: "100%",
                        marginBottom: 6,
                      }}
                    >
                      {opt.name} (+{opt.price})
                    </button>
                  );
                })}
              </div>
            ))}

            <button onClick={handleConfirmModifier}>
              เพิ่มลงตะกร้า
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- STYLES ---------------- */

const styles = {
  categoryBar: {
    display: "flex",
    flexWrap: "wrap",
    padding: 12,
    gap: 8,
    background: "#111",
  },
  catBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "none",
    fontWeight: "bold",
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    padding: 12,
    overflowY: "auto",
  },
  productCard: {
    background: "#1a1a1a",
    borderRadius: 16,
    color: "#fff",
    padding: 20,
  },
  floatingCart: {
    position: "fixed",
    bottom: 20,
    left: 16,
    right: 16,
    background: "#4caf50",
    borderRadius: 14,
    padding: 16,
    fontWeight: "bold",
  },
  cartOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
  },
  cartContainer: {
    background: "#fff",
    height: "100%",
    padding: 16,
  },
  cartHeader: {
    display: "flex",
    justifyContent: "space-between",
  },
  cartList: {
    marginTop: 16,
  },
  cartItem: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cartFooter: {
    marginTop: 20,
  },
  modifierOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modifierModal: {
    background: "#111",
    padding: 20,
    borderRadius: 12,
    width: "90%",
    maxWidth: 400,
  },
};