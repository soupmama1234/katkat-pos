import React, { useState, useMemo } from "react";
import { Trash2 } from "lucide-react";

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

  // --- Modifier Popup State ---
  const [showModifierPopup, setShowModifierPopup] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [tempSelection, setTempSelection] = useState([]);

  const getDisplayPrice = (product) => {
    const channelPrices = {
      pos: product.price,
      grab: product.grabPrice,
      lineman: product.linemanPrice,
      shopee: product.shopeePrice
    };
    return channelPrices[priceChannel] ?? product.price;
  };

  const selectedProduct = useMemo(() =>
    (products || []).find(p => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const activeModifierGroups = useMemo(() =>
    modifierGroups.filter(g => selectedProduct?.modifierGroups?.includes(g.id)),
    [modifierGroups, selectedProduct]
  );

  const handleProductClick = (product) => {
    const productModGroups = modifierGroups.filter(g =>
      product.modifierGroups?.includes(g.id)
    );
    if (productModGroups.length > 0) {
      setSelectedProductId(product.id);
      setShowModifierPopup(true);
    } else {
      addToCart({ ...product, price: getDisplayPrice(product) });
    }
  };

  const toggleModifier = (opt) => {
    setTempSelection(prev => {
      const isExist = prev.find(item => item.id === opt.id);
      if (isExist) return prev.filter(item => item.id !== opt.id);
      return [...prev, opt];
    });
  };

  const handleConfirmModifier = () => {
    if (!selectedProduct) return;
    const basePrice = getDisplayPrice(selectedProduct);
    const totalModPrice = tempSelection.reduce((sum, m) => sum + Number(m.price), 0);
    addToCart({
      ...selectedProduct,
      price: basePrice + totalModPrice,
      selectedModifier: tempSelection.length > 0 ? {
        id: tempSelection.map(m => m.id).join("-"),
        name: tempSelection.map(m => m.name).join(", "),
        price: totalModPrice
      } : null
    });
    setShowModifierPopup(false);
    setTempSelection([]);
  };

  const handleConfirmCheckout = (type) => {
    let finalRef = refValue;
    if (type === "grab" && refValue) finalRef = `GF-${refValue}`;
    onCheckout(type, finalRef);
    setRefValue("");
    setShowCart(false);
  };

  const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#000", position: "relative" }}>
      
      {/* 1. หมวดหมู่ */}
      <div style={styles.categoryBar}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              ...styles.catBtn,
              backgroundColor: selectedCategory === cat ? "#fff" : "#222",
              color: selectedCategory === cat ? "#000" : "#fff",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 2. แถบช่องทาง */}
      <div style={styles.channelBar}>
        {[
          { key: "pos", label: "POS", color: "#4a4a4a" },
          { key: "grab", label: "Grab", color: "#00B14F" },
          { key: "lineman", label: "Lineman", color: "#00A84F" },
          { key: "shopee", label: "Shopee", color: "#EE4D2D" },
        ].map((ch) => (
          <button
            key={ch.key}
            onClick={() => { setPriceChannel(ch.key); setRefValue(""); }}
            style={{
              ...styles.channelBtn,
              background: priceChannel === ch.key ? ch.color : "#262626",
              border: priceChannel === ch.key ? "2px solid #fff" : "2px solid transparent",
              opacity: priceChannel === ch.key ? 1 : 0.6,
            }}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* 2.5 ช่องเลข ref — โชว์ทันทีเมื่อเลือก Delivery channel */}
      {["grab", "lineman", "shopee"].includes(priceChannel) && (
        <div style={{ padding: "8px 12px", backgroundColor: "#111", borderBottom: "1px solid #222" }}>
          <div style={styles.inputGroup}>
            {priceChannel === "grab" && (
              <span style={styles.prefixLabel}>GF-</span>
            )}
            <input
              type="number"
              inputMode="numeric"
              placeholder={priceChannel === "grab" ? "ระบุตัวเลข" : "เลขที่อ้างอิง"}
              value={refValue}
              onChange={(e) => setRefValue(e.target.value)}
              style={{ ...styles.innerInput, fontSize: "16px", padding: "10px 12px" }}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* 3. รายการสินค้า */}
      <div style={styles.productGrid}>
        {products
          .filter(p => !selectedCategory || selectedCategory === "All" || p.category === selectedCategory)
          .map((p) => {
          const hasModifiers = modifierGroups.some(g => p.modifierGroups?.includes(g.id));
          return (
            <button key={p.id} onClick={() => handleProductClick(p)} style={styles.productCard}>
              <div style={{ fontSize: "15px", fontWeight: "bold", marginBottom: "6px", lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ color: "#4caf50", fontWeight: "bold", fontSize: "16px" }}>
                ฿{(p[`${priceChannel}Price`] || p.price || 0).toLocaleString()}
              </div>
              {hasModifiers && (
                <div style={styles.modifierBadge}>⚙️ มีตัวเลือก</div>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. ปุ่มลอย */}
      {cart.length > 0 && !showCart && (
        <button style={styles.floatingCart} onClick={() => setShowCart(true)}>
          <span>🛒 {totalQty} รายการ</span>
          <span style={{ marginLeft: "auto", fontWeight: "bold" }}>ดูตะกร้า ฿{total.toLocaleString()}</span>
        </button>
      )}

      {/* 5. ตะกร้า Overlay */}
      {showCart && (
        <div style={styles.cartOverlay}>
          <div style={styles.cartHeader}>
            <div>
              <h3 style={{ margin: 0 }}>ตะกร้าสินค้า</h3>
              <span style={{ fontSize: "12px", color: "#888" }}>ช่องทาง: {priceChannel.toUpperCase()}</span>
              {["grab","lineman","shopee"].includes(priceChannel) && refValue && (
                <span style={{ fontSize: "12px", color: "#4caf50", marginLeft: 8 }}>
                  · {priceChannel === "grab" ? `GF-${refValue}` : refValue}
                </span>
              )}
            </div>
            <button onClick={() => setShowCart(false)} style={styles.closeBtn}>✕</button>
          </div>

          <div style={styles.cartList}>
            {cart.map((item, idx) => (
              <div key={`${item.id}-${idx}`} style={styles.cartItem}>
                {/* ชื่อ + ราคา */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: "bold", fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.name}
                  </div>
                  {item.selectedModifier && (
                    <div style={{ fontSize: "12px", color: "#aaa", fontStyle: "italic" }}>
                      • {item.selectedModifier.name}
                    </div>
                  )}
                  <div style={{ fontSize: "13px", color: "#888", marginTop: 2 }}>
                    ฿{item.price.toLocaleString()} × {item.qty} = <strong style={{ color: "#fff" }}>฿{(item.price * item.qty).toLocaleString()}</strong>
                  </div>
                </div>

                {/* ปุ่ม - จำนวน + (FIX: layout ตรง + ใช้ increaseQty แทน addToCart) */}
                <div style={styles.qtyControl}>
                  <button
                    onClick={() => decreaseQty(item.id, item.channel, item.selectedModifier?.id)}
                    style={styles.qtyBtn}
                  >
                    −
                  </button>
                  <span style={styles.qtyNumber}>{item.qty}</span>
                  <button
                    onClick={() => increaseQty(item.id, item.channel, item.selectedModifier?.id)}
                    style={styles.qtyBtn}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            {cart.length > 0 && (
              <button onClick={onClearCart} style={styles.btnClear}>
                <Trash2 size={16} /> ล้างทั้งหมด
              </button>
            )}
          </div>

          <div style={styles.cartFooter}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "18px", fontWeight: "bold" }}>รวมทั้งหมด</span>
              <span style={{ fontSize: "24px", fontWeight: "bold", color: "#4caf50" }}>฿{total.toLocaleString()}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: priceChannel === "pos" ? "1fr 1fr" : "1fr", gap: "12px" }}>
              {priceChannel === "pos" ? (
                <>
                  <button onClick={() => handleConfirmCheckout("cash")} style={{ ...styles.payBtn, backgroundColor: "#4caf50" }}>💵 เงินสด</button>
                  <button onClick={() => handleConfirmCheckout("transfer")} style={{ ...styles.payBtn, backgroundColor: "#2196f3" }}>📱 โอนเงิน</button>
                </>
              ) : (
                <button
                  onClick={() => handleConfirmCheckout(priceChannel)}
                  style={{ ...styles.payBtn, backgroundColor: "#1e293b", fontSize: "18px" }}
                >
                  💾 บันทึก {priceChannel.toUpperCase()}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Modifier Popup (bottom sheet) */}
      {showModifierPopup && selectedProduct && (
        <div style={styles.modifierOverlay} onClick={() => { setShowModifierPopup(false); setTempSelection([]); }}>
          <div style={styles.modifierModal} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#fff", fontSize: "18px" }}>{selectedProduct.name}</h3>
              <button
                onClick={() => { setShowModifierPopup(false); setTempSelection([]); }}
                style={{ background: "none", border: "none", color: "#888", fontSize: "24px", cursor: "pointer", lineHeight: 1 }}
              >✕</button>
            </div>

            <div style={{ overflowY: "auto", maxHeight: "45vh" }}>
              {activeModifierGroups.map(group => (
                <div key={group.id} style={{ marginBottom: "18px" }}>
                  <div style={{ fontSize: "13px", color: "#888", marginBottom: "10px", fontWeight: "bold" }}>
                    {group.name}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {group.options && group.options.map(opt => {
                      const isSelected = tempSelection.find(s => s.id === opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleModifier(opt)}
                          style={{
                            padding: "14px 10px",
                            backgroundColor: isSelected ? "#4caf50" : "#2a2a2a",
                            border: isSelected ? "2px solid #fff" : "1px solid #444",
                            color: "#fff", borderRadius: "10px", cursor: "pointer", textAlign: "center", transition: "all 0.15s"
                          }}
                        >
                          <div style={{ fontWeight: "bold", fontSize: "14px" }}>{opt.name}</div>
                          <div style={{ color: isSelected ? "#fff" : "#4caf50", fontSize: "13px", marginTop: "4px" }}>
                            +{Number(opt.price).toLocaleString()} ฿
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #333", paddingTop: "14px", marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", color: "#aaa" }}>
                <span>ราคาสินค้า</span>
                <span>฿{getDisplayPrice(selectedProduct).toLocaleString()}</span>
              </div>
              {tempSelection.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", color: "#aaa" }}>
                  <span>{tempSelection.map(m => m.name).join(", ")}</span>
                  <span>+{tempSelection.reduce((s, m) => s + Number(m.price), 0).toLocaleString()} ฿</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", margin: "12px 0 16px", fontSize: "20px", fontWeight: "bold" }}>
                <span>รวม</span>
                <span style={{ color: "#4caf50" }}>
                  ฿{(getDisplayPrice(selectedProduct) + tempSelection.reduce((s, m) => s + Number(m.price), 0)).toLocaleString()}
                </span>
              </div>
              <button
                onClick={handleConfirmModifier}
                style={{ width: "100%", padding: "16px", backgroundColor: "#2196f3", color: "#fff", border: "none", borderRadius: "12px", fontWeight: "bold", fontSize: "17px", cursor: "pointer" }}
              >
                เพิ่มลงตะกร้า
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  categoryBar: { display: "flex", flexWrap: "wrap", padding: "12px", gap: "8px", backgroundColor: "#111", borderBottom: "1px solid #333" },
  catBtn: { padding: "8px 14px", borderRadius: "10px", border: "none", fontSize: "13px", fontWeight: "bold", cursor: "pointer" },
  channelBar: { display: "flex", padding: "8px 12px", gap: "8px", backgroundColor: "#000", borderBottom: "1px solid #333" },
  channelBtn: { flex: 1, padding: "10px 0", borderRadius: "10px", color: "#fff", fontSize: "12px", fontWeight: "bold", cursor: "pointer" },
  productGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "12px", overflowY: "auto" },
  productCard: { backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "16px", color: "#fff", padding: "20px 12px", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" },
  modifierBadge: { marginTop: "8px", fontSize: "10px", color: "#888", background: "#2a2a2a", padding: "3px 8px", borderRadius: "10px" },
  floatingCart: { position: "fixed", bottom: "90px", left: "16px", right: "16px", backgroundColor: "#4caf50", color: "#000", border: "none", borderRadius: "14px", padding: "16px 20px", fontSize: "16px", fontWeight: "bold", display: "flex", alignItems: "center", zIndex: 100, cursor: "pointer" },
  cartOverlay: { position: "fixed", inset: 0, backgroundColor: "#111", zIndex: 2000, display: "flex", flexDirection: "column" },
  cartHeader: { padding: "20px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1a1a1a", flexShrink: 0 },
  closeBtn: { background: "none", border: "none", color: "#fff", fontSize: "26px", cursor: "pointer", lineHeight: 1 },
  cartList: { flex: 1, overflowY: "auto", padding: "16px" },
  cartItem: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #222" },

  // FIX: qtyControl — flexbox ที่ตรง align กัน
  qtyControl: {
    display: "flex",
    alignItems: "center",
    gap: "0",
    backgroundColor: "#222",
    borderRadius: "10px",
    border: "1px solid #444",
    overflow: "hidden",
    flexShrink: 0,
  },
  qtyBtn: {
    width: "38px",
    height: "38px",
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: "20px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    padding: 0,
  },
  qtyNumber: {
    minWidth: "32px",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: "16px",
    color: "#fff",
    borderLeft: "1px solid #444",
    borderRight: "1px solid #444",
    height: "38px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  btnClear: { width: "100%", background: "none", border: "1px solid #333", color: "#ff5252", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", borderRadius: "8px", cursor: "pointer", marginTop: "8px" },
  cartFooter: { padding: "20px", borderTop: "1px solid #333", backgroundColor: "#1a1a1a", flexShrink: 0 },
  inputGroup: { display: "flex", alignItems: "center", backgroundColor: "#222", borderRadius: "12px", border: "1px solid #333", padding: "0 15px", marginBottom: "4px" },
  prefixLabel: { color: "#00B14F", fontSize: "18px", fontWeight: "bold", marginRight: "5px" },
  innerInput: { flex: 1, padding: "14px 0", backgroundColor: "transparent", border: "none", color: "#fff", fontSize: "18px", outline: "none" },
  payBtn: { border: "none", padding: "18px", borderRadius: "12px", color: "#fff", fontWeight: "bold", fontSize: "16px", cursor: "pointer" },
  modifierOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 3000 },
  modifierModal: { background: "#1a1a1a", borderRadius: "20px 20px 0 0", padding: "24px", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTop: "1px solid #333" },
};
