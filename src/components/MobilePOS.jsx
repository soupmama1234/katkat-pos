import React, { useState, useMemo } from "react";
import { Trash2 } from "lucide-react";
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
  memberPhone = "",
  setMemberPhone,
}) {
  const [showCart, setShowCart] = useState(false);
  const [refValue, setRefValue] = useState("");

  const [memberInput, setMemberInput] = useState("");
  const [memberInfo, setMemberInfo] = useState(null);
  const [memberStatus, setMemberStatus] = useState("idle");
  const [showRegister, setShowRegister] = useState(false);
  const [regNickname, setRegNickname] = useState("");

  const [showModifierPopup, setShowModifierPopup] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [tempSelection, setTempSelection] = useState([]);

  /* ---------------- MEMBER ---------------- */

  const lookupMember = async (phone) => {
    if (phone.length < 9) return;
    setMemberStatus("loading");

    const { data } = await sb
      .from("members")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (data) {
      setMemberInfo(data);
      setMemberStatus("found");
      setMemberPhone(phone);
    } else {
      setMemberInfo(null);
      setMemberStatus("notfound");
      setMemberPhone("");
    }
  };

  const registerMember = async () => {
    if (!memberInput || !regNickname) return;

    const { data, error } = await sb
      .from("members")
      .insert({
        phone: memberInput,
        nickname: regNickname,
        points: 0,
        tier: "standard",
      })
      .select()
      .single();

    if (error) {
      alert("สมัครไม่สำเร็จ: " + error.message);
      return;
    }

    setMemberInfo(data);
    setMemberStatus("found");
    setMemberPhone(memberInput);
    setShowRegister(false);
    setRegNickname("");
  };

  const clearMember = () => {
    setMemberInput("");
    setMemberInfo(null);
    setMemberStatus("idle");
    setMemberPhone("");
    setShowRegister(false);
    setRegNickname("");
  };

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#000" }}>
      {/* หมวดหมู่ */}
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

      {/* สินค้า */}
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

      {/* ปุ่มลอย */}
      {cart.length > 0 && !showCart && (
        <button style={styles.floatingCart} onClick={() => setShowCart(true)}>
          🛒 {totalQty} รายการ · ฿{total.toLocaleString()}
        </button>
      )}
    </div>
  );
}

/* ---------------- STYLES ---------------- */

const styles = {
  categoryBar: {
    display: "flex",
    flexWrap: "wrap",
    padding: "12px",
    gap: "8px",
    background: "#111",
  },
  catBtn: {
    padding: "8px 14px",
    borderRadius: "10px",
    border: "none",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    padding: "12px",
    overflowY: "auto",
  },
  productCard: {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "16px",
    color: "#fff",
    padding: "20px",
    textAlign: "center",
    cursor: "pointer",
  },
  floatingCart: {
    position: "fixed",
    bottom: "20px",
    left: "16px",
    right: "16px",
    background: "#4caf50",
    border: "none",
    borderRadius: "14px",
    padding: "16px",
    fontWeight: "bold",
  },
};
      {/* ================= CART OVERLAY ================= */}
      {showCart && (
        <div style={styles.cartOverlay}>
          <div style={styles.cartHeader}>
            <div>
              <h3 style={{ margin: 0 }}>ตะกร้าสินค้า</h3>
              <span style={{ fontSize: 12, color: "#888" }}>
                ช่องทาง: {priceChannel.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => setShowCart(false)}
              style={styles.closeBtn}
            >
              ✕
            </button>
          </div>

          <div style={styles.cartList}>
            {cart.map((item, idx) => (
              <div key={`${item.id}-${idx}`} style={styles.cartItem}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold" }}>{item.name}</div>

                  {item.selectedModifier && (
                    <div style={{ fontSize: 12, color: "#aaa" }}>
                      • {item.selectedModifier.name}
                    </div>
                  )}

                  <div style={{ fontSize: 13, color: "#888" }}>
                    ฿{item.price.toLocaleString()} × {item.qty} =
                    <strong style={{ color: "#fff", marginLeft: 4 }}>
                      ฿{(item.price * item.qty).toLocaleString()}
                    </strong>
                  </div>
                </div>

                {/* qty control */}
                <div style={styles.qtyControl}>
                  <button
                    onClick={() =>
                      decreaseQty(
                        item.id,
                        item.channel,
                        item.selectedModifier?.id
                      )
                    }
                    style={styles.qtyBtn}
                  >
                    −
                  </button>

                  <span style={styles.qtyNumber}>{item.qty}</span>

                  <button
                    onClick={() =>
                      increaseQty(
                        item.id,
                        item.channel,
                        item.selectedModifier?.id
                      )
                    }
                    style={styles.qtyBtn}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            {cart.length > 0 && (
              <button onClick={onClearCart} style={styles.btnClear}>
                ล้างทั้งหมด
              </button>
            )}
          </div>

          <div style={styles.cartFooter}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 18, fontWeight: "bold" }}>
                รวมทั้งหมด
              </span>
              <span style={{ fontSize: 22, fontWeight: "bold", color: "#4caf50" }}>
                ฿{total.toLocaleString()}
              </span>
            </div>

            <div style={{ marginTop: 16 }}>
              {priceChannel === "pos" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    onClick={() => handleConfirmCheckout("cash")}
                    style={{ ...styles.payBtn, background: "#4caf50" }}
                  >
                    เงินสด
                  </button>
                  <button
                    onClick={() => handleConfirmCheckout("transfer")}
                    style={{ ...styles.payBtn, background: "#2196f3" }}
                  >
                    โอนเงิน
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleConfirmCheckout(priceChannel)}
                  style={{ ...styles.payBtn, background: "#1e293b" }}
                >
                  บันทึก {priceChannel.toUpperCase()}
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
            <h3 style={{ marginTop: 0 }}>{selectedProduct.name}</h3>

            <div style={{ maxHeight: "45vh", overflowY: "auto" }}>
              {activeModifierGroups.map((group) => (
                <div key={group.id} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: "bold", marginBottom: 8 }}>
                    {group.name}
                  </div>

                  {group.options?.map((opt) => {
                    const selected = tempSelection.find(
                      (s) => s.id === opt.id
                    );
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleModifier(opt)}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: 10,
                          marginBottom: 6,
                          background: selected ? "#4caf50" : "#2a2a2a",
                          border: "1px solid #444",
                          borderRadius: 8,
                          color: "#fff",
                          textAlign: "left",
                        }}
                      >
                        {opt.name} (+{Number(opt.price).toLocaleString()} ฿)
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <button
              onClick={handleConfirmModifier}
              style={{
                marginTop: 12,
                width: "100%",
                padding: 14,
                background: "#2196f3",
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontWeight: "bold",
              }}
            >
              เพิ่มลงตะกร้า
            </button>
          </div>
        </div>
      )}