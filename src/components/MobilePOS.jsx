import React, { useState, useMemo } from "react";
import { Trash2, ShoppingCart, Ticket } from "lucide-react";
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
  members = [],
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
}) {
  const [showCart, setShowCart] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  
  // ค้นหาข้อมูลสมาชิกปัจจุบัน
  const memberInfo = useMemo(() => members.find(m => m.phone === memberPhone), [members, memberPhone]);
  const redeemedRewards = useMemo(() => (memberInfo?.redeemed_rewards || []).filter(r => !r.used_at), [memberInfo]);

  const handleApplyReward = (reward) => {
    if (reward.type === 'discount') {
      onApplyRewardDiscount?.({
        id: reward.id,
        mode: reward.discount_type || 'amount',
        value: reward.discount_amount || 0,
        label: reward.name,
        source: 'member_storage'
      });
    } else {
      addToCart({
        id: `reward-${reward.id}`,
        name: `🎁 ${reward.name}`,
        price: 0,
        qty: 1,
        category: "reward",
        storage_id: reward.id // เพื่อไว้ตัดสต็อกตอนจ่ายเงิน
      });
    }
    if (showToast) showToast(`ใช้: ${reward.name}`);
  };

  return (
    <div style={styles.container}>
      {/* ── Member Bar (POS only) ── */}
      {priceChannel === "pos" && memberPhone && memberInfo && (
        <div style={{ backgroundColor: "#0a0a0a", borderBottom: "1px solid #222" }}>
          <div style={{ padding: "10px 15px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ color: "#4caf50", fontWeight: "bold", fontSize: 13 }}>👤 {memberInfo.nickname}</span>
              <span style={{ color: "#666", fontSize: 12, marginLeft: 8 }}>⭐ {memberInfo.points} แต้ม</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowRedeem(true)} style={styles.smallBtn}>🎁 แลก</button>
              <button onClick={() => setMemberPhone("")} style={{ ...styles.smallBtn, background: "#222", color: "#666" }}>เปลี่ยน</button>
            </div>
          </div>

          {/* Stored Rewards Strip */}
          {redeemedRewards.length > 0 && (
            <div style={{ padding: "0 15px 10px", display: "flex", gap: 8, overflowX: "auto" }}>
              {redeemedRewards.map(r => (
                <button key={r.id} onClick={() => handleApplyReward(r)} style={styles.rewardTag}>
                  <Ticket size={12} /> {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
            <div style={{ color: "#4caf50", fontWeight: "bold", marginTop: 4 }}>฿{p[`${priceChannel}Price`] || p.price}</div>
          </button>
        ))}
      </div>

      {/* ── Floating Cart ── */}
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
              <h3 style={{ margin: 0 }}>รายการสั่งซื้อ</h3>
            </div>
            <button onClick={onClearCart} style={{ background: "none", border: "none", color: "#ff4444" }}>ล้าง</button>
          </div>

          <div style={styles.cartItems}>
            {cart.map((item, idx) => (
              <div key={`${item.id}-${idx}`} style={styles.itemRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold" }}>{item.name}</div>
                  {item.selectedModifier && <div style={{ fontSize: 11, color: "#888" }}>+ {item.selectedModifier.name}</div>}
                  <div style={{ fontSize: 12, color: "#aaa" }}>฿{item.price} x {item.qty}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontWeight: "bold" }}>฿{item.price * item.qty}</div>
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
            {discounts.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {discounts.map(d => (
                  <div key={d.id} style={styles.discountTag}>
                    {d.label} <button onClick={() => onRemoveDiscount(d.id)} style={styles.removeTag}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ color: "#888" }}>ยอดสุทธิ</span>
              <span style={{ fontSize: 24, fontWeight: "bold", color: "#4caf50" }}>฿{total.toLocaleString()}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={() => { onCheckout("transfer"); setShowCart(false); }} style={{ ...styles.actionBtn, background: "#213547" }}>📱 โอนเงิน</button>
              <button onClick={() => { onCheckout("cash"); setShowCart(false); }} style={{ ...styles.actionBtn, background: "#4caf50" }}>💵 เงินสด</button>
            </div>
          </div>
        </div>
      )}

      {showRedeem && memberInfo && (
        <RedeemModal 
          memberPhone={memberPhone} 
          memberInfo={memberInfo} 
          onSuccess={(updated) => {
            // อัปเดตข้อมูลสมาชิกในระดับ App ผ่าน callback
            // (ในระบบจริง App.jsx ควรเป็นคนจัดการ members state)
            setShowRedeem(false);
          }} 
          onClose={() => setShowRedeem(false)} 
        />
      )}
    </div>
  );
}

const styles = {
  container: { height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#000" },
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
  smallBtn: { padding: "4px 12px", borderRadius: 8, background: "#f5c518", color: "#000", border: "none", fontSize: 11, fontWeight: "bold", cursor: "pointer" },
  rewardTag: { display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", background: "#1a1a1a", border: "1px solid #f5c518", color: "#f5c518", borderRadius: 20, fontSize: 11, fontWeight: "bold", whiteSpace: "nowrap", cursor: "pointer" },
  discountTag: { padding: "4px 10px", background: "#333", borderRadius: 20, fontSize: 11, display: "flex", alignItems: "center", gap: 6 },
  removeTag: { background: "none", border: "none", color: "#ff5252", fontSize: 14, cursor: "pointer", padding: 0 }
};
