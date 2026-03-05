import React, { useState, useMemo } from "react";
import { Trash2, ShoppingCart, Clock } from "lucide-react";
import { supabase as sb } from "../supabase";
import RedeemModal from "./RedeemModal";

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
  subtotal = 0,
  discountTotal = 0,
  discounts = [],
  onApplyManualDiscount,
  onApplyRewardDiscount,
  onRemoveDiscount,
  onClearDiscounts,
  showToast,
  showConfirm,
  orderType = "dine_in",
  setOrderType,
  tableNo = "",
  setTableNo,
  onSavePending,
}) {
  const [showCart, setShowCart] = useState(false);
  const [refValue, setRefValue] = useState("");
  const [showRedeem, setShowRedeem] = useState(false);
  const [discountMode, setDiscountMode] = useState("amount");
  const [discountInput, setDiscountInput] = useState("");

  const handleApplyManualDiscount = () => {
    const val = Number(discountInput);
    if (!(val > 0)) return;
    onApplyManualDiscount?.({ mode: discountMode, value: val });
    setDiscountInput("");
  };

  const handleCheckout = async (method) => {
    onCheckout(method, refValue);
    setShowCart(false);
  };

  const currentPriceChannel = priceChannel || "pos";

  return (
    <div style={styles.container}>
      {/* ── Order Type & Platform Tabs ── */}
      <div style={{ padding: "10px 12px", background: "#000", borderBottom: "1px solid #222" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={() => setOrderType("dine_in")} style={{ ...styles.typeBtn, background: orderType === "dine_in" ? "#4caf50" : "#1a1a1a", color: orderType === "dine_in" ? "#fff" : "#666", border: orderType === "dine_in" ? "none" : "1px solid #333" }}>
            🏠 ทานที่ร้าน
          </button>
          <button onClick={() => setOrderType("takeaway")} style={{ ...styles.typeBtn, background: orderType === "takeaway" ? "#ff9800" : "#1a1a1a", color: orderType === "takeaway" ? "#fff" : "#666", border: orderType === "takeaway" ? "none" : "1px solid #333" }}>
            🥡 กลับบ้าน
          </button>
        </div>
        
        {/* Platform Tabs (Grab, etc) */}
        <div style={{ display: "flex", gap: 6, marginBottom: orderType === "dine_in" ? 10 : 0, overflowX: "auto", paddingBottom: 2 }}>
          {["pos", "grab", "lineman", "shopee"].map(ch => (
            <button key={ch} onClick={() => setPriceChannel(ch)} style={{ 
              padding: "6px 12px", borderRadius: 20, border: "none", whiteSpace: "nowrap",
              background: currentPriceChannel === ch ? "#fff" : "#1a1a1a", 
              color: currentPriceChannel === ch ? "#000" : "#666", 
              fontSize: 11, fontWeight: "bold", cursor: "pointer" 
            }}>
              {ch.toUpperCase()}
            </button>
          ))}
        </div>

        {orderType === "dine_in" && (
          <input placeholder="📍 ระบุเลขโต๊ะ..." value={tableNo} onChange={e => setTableNo(e.target.value)}
            style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", color: "#fff", borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }} />
        )}
      </div>

      {/* ── Category Tabs ── */}
      <div style={styles.categoryBar}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)}
            style={cat === selectedCategory ? styles.catBtnActive : styles.catBtn}>
            {cat}
          </button>
        ))}
      </div>

      {/* ── Product Grid ── */}
      <div style={styles.productGrid}>
        {products.filter(p => selectedCategory === "All" || p.category === selectedCategory).map(p => (
          <button key={p.id} onClick={() => addToCart(p)} style={styles.productCard}>
            <div style={{ fontWeight: "bold", fontSize: 14 }}>{p.name}</div>
            <div style={{ color: "#4caf50", fontWeight: "bold", marginTop: 4 }}>฿{p[`${currentPriceChannel}Price`] || p.price}</div>
          </button>
        ))}
      </div>

      {/* ── Bottom Floating Button ── */}
      {cart.length > 0 && !showCart && (
        <button onClick={() => setShowCart(true)} style={styles.floatingCart}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={styles.cartBadge}>{cart.reduce((s, i) => s + i.qty, 0)}</div>
            <div style={{ fontWeight: "bold" }}>ดูตะกร้า</div>
          </div>
          <div style={{ fontWeight: "bold", fontSize: 18 }}>฿{total.toLocaleString()}</div>
        </button>
      )}

      {/* ── Cart Overlay ── */}
      {showCart && (
        <div style={styles.cartOverlay}>
          <div style={styles.cartHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setShowCart(false)} style={styles.btnClose}>✕</button>
              <h3 style={{ margin: 0 }}>ตะกร้า ({orderType === "dine_in" ? `โต๊ะ ${tableNo || '?'}` : 'กลับบ้าน'})</h3>
            </div>
            <button onClick={onClearCart} style={{ background: "none", border: "none", color: "#ff4444" }}>ล้าง</button>
          </div>

          <div style={styles.cartItems}>
            {cart.map((item, idx) => (
              <div key={`${item.id}-${idx}`} style={styles.itemRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", fontSize: 14 }}>{item.name}</div>
                  {item.selectedModifier && <div style={{ fontSize: 11, color: "#888" }}>+ {item.selectedModifier.name}</div>}
                  <div style={{ fontSize: 12, color: "#aaa" }}>฿{item.price} x {item.qty}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontWeight: "bold", color: "#4caf50" }}>฿{item.price * item.qty}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#222", borderRadius: 8, padding: "2px" }}>
                    <button onClick={() => decreaseQty(item.id, item.channel, item.selectedModifier?.id)} style={styles.qtyBtn}>-</button>
                    <span style={{ minWidth: 20, textAlign: "center" }}>{item.qty}</span>
                    <button onClick={() => increaseQty(item.id, item.channel, item.selectedModifier?.id)} style={styles.qtyBtn}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.cartFooter}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "#888" }}>ยอดสุทธิ</span>
              <span style={{ fontSize: 24, fontWeight: "bold", color: "#4caf50" }}>฿{total.toLocaleString()}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <button onClick={() => { onSavePending?.(); setShowCart(false); }} 
                style={{ ...styles.actionBtn, background: "#222", color: "#f5c518", border: "1px solid #f5c51844" }}>
                ⏸️ พักบิล
              </button>
              <button onClick={() => handleCheckout("transfer")} style={{ ...styles.actionBtn, background: "#213547" }}>โอน</button>
              <button onClick={() => handleCheckout("cash")} style={{ ...styles.actionBtn, background: "#4caf50" }}>เงินสด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#000" },
  typeBtn: { flex: 1, padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: "bold", cursor: "pointer" },
  categoryBar: { display: "flex", gap: 8, padding: "12px", overflowX: "auto", background: "#000", borderBottom: "1px solid #111" },
  catBtn: { padding: "8px 16px", borderRadius: 20, background: "#111", color: "#666", border: "none", whiteSpace: "nowrap", fontSize: 13 },
  catBtnActive: { padding: "8px 16px", borderRadius: 20, background: "#fff", color: "#000", border: "none", whiteSpace: "nowrap", fontWeight: "bold", fontSize: 13 },
  productGrid: { flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: 12, overflowY: "auto" },
  productCard: { background: "#111", border: "1px solid #222", borderRadius: 14, padding: 16, textAlign: "left", color: "#fff", cursor: "pointer" },
  floatingCart: { position: "fixed", bottom: 85, left: 12, right: 12, height: 60, background: "#4caf50", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", color: "#fff", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 100 },
  cartBadge: { background: "#fff", color: "#4caf50", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold" },
  cartOverlay: { position: "fixed", inset: 0, background: "#000", zIndex: 2000, display: "flex", flexDirection: "column" },
  cartHeader: { padding: "16px 20px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" },
  btnClose: { background: "#222", border: "none", color: "#fff", width: 32, height: 32, borderRadius: "50%", fontSize: 16 },
  cartItems: { flex: 1, overflowY: "auto", padding: "10px 20px" },
  itemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid #111" },
  qtyBtn: { width: 32, height: 32, borderRadius: 8, border: "none", background: "#333", color: "#fff", fontSize: 20, fontWeight: "bold" },
  cartFooter: { padding: "20px", background: "#0a0a0a", borderTop: "1px solid #222" },
  actionBtn: { padding: "16px", borderRadius: 12, border: "none", color: "#fff", fontWeight: "bold", fontSize: 15 },
};
