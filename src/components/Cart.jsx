import React, { useState, useMemo } from "react";
import { Trash2, Ticket } from "lucide-react";
import RedeemModal from "./RedeemModal";

export default function Cart({ 
  cart = [], 
  addToCart, 
  increaseQty, 
  decreaseQty, 
  total = 0, 
  onCheckout, 
  onClearCart, 
  priceChannel,
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
  const [showRedeem, setShowRedeem] = useState(false);
  const [discountMode, setDiscountMode] = useState("amount"); 
  const [discountInput, setDiscountInput] = useState("");

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
        storage_id: reward.id
      });
    }
    if (showToast) showToast(`ใช้: ${reward.name}`);
  };

  return (
    <div style={S.container}>
      <div style={S.header}>
        <h3 style={{ margin: 0 }}>ตะกร้าสินค้า</h3>
        <button onClick={onClearCart} style={S.btnClear}>ล้างตะกร้า</button>
      </div>

      {/* ── Member Section ── */}
      {priceChannel === "pos" && (
        <div style={{ padding: "12px 16px", background: "#fcfcfc", borderBottom: "1px solid #eee" }}>
          {!memberPhone ? (
            <div style={{ color: "#888", fontSize: 13, textAlign: "center" }}>ยังไม่ได้เลือกสมาชิก</div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: redeemedRewards.length > 0 ? 10 : 0 }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: 14, color: "#4caf50" }}>👤 {memberInfo?.nickname || memberPhone}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>⭐ {memberInfo?.points || 0} แต้ม</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setShowRedeem(true)} style={S.btnSmallAction}>🎁 แลก</button>
                  <button onClick={() => setMemberPhone("")} style={{ ...S.btnSmallAction, background: "#eee", color: "#666" }}>เปลี่ยน</button>
                </div>
              </div>

              {/* Stored Rewards (Desktop) */}
              {redeemedRewards.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 8, borderTop: "1px dashed #eee" }}>
                  {redeemedRewards.map(r => (
                    <button key={r.id} onClick={() => handleApplyReward(r)} style={S.rewardBadge}>
                      <Ticket size={12} /> {r.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={S.cartList}>
        {cart.length === 0 ? (
          <div style={S.empty}>ไม่มีสินค้าในตะกร้า</div>
        ) : (
          cart.map((item, idx) => (
            <div key={`${item.id}-${idx}`} style={S.cartItem}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", fontSize: "14px" }}>{item.name}</div>
                {item.selectedModifier && <div style={{ fontSize: "11px", color: "#888" }}>+ {item.selectedModifier.name}</div>}
                <div style={{ fontSize: "12px", color: "#aaa" }}>฿{item.price.toLocaleString()} x {item.qty}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ fontWeight: "bold", color: "#4caf50" }}>฿{(item.price * item.qty).toLocaleString()}</div>
                <button onClick={() => decreaseQty(item.id, item.channel, item.selectedModifier?.id)} style={S.btnDelete}>
                  <Trash2 size={16} color="#d32f2f" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={S.footer}>
        {/* Discounts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div style={{ display: "flex", borderRadius: 8, border: "1px solid #ddd", overflow: "hidden" }}>
            <button onClick={() => setDiscountMode("amount")} style={{ flex: 1, border: "none", background: discountMode === "amount" ? "#213547" : "#fff", color: discountMode === "amount" ? "#fff" : "#213547", fontSize: 12, cursor: "pointer" }}>฿ ลด</button>
            <button onClick={() => setDiscountMode("percent")} style={{ flex: 1, border: "none", borderLeft: "1px solid #ddd", background: discountMode === "percent" ? "#213547" : "#fff", color: discountMode === "percent" ? "#fff" : "#213547", fontSize: 12, cursor: "pointer" }}>% ลด</button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <input value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder="0" type="number" style={{ ...S.input, flex: 1, padding: "6px 8px" }} />
            <button onClick={() => { onApplyManualDiscount?.({ mode: discountMode, value: Number(discountInput) }); setDiscountInput(""); }} style={{ ...S.btnSmall, background: "#213547", color: "#fff", border: "none", padding: "0 12px", fontWeight: "bold" }}>ใช้</button>
          </div>
        </div>

        {discounts.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {discounts.map(d => (
              <div key={d.id} style={S.tag}>
                {d.label} <button onClick={() => onRemoveDiscount(d.id)} style={S.removeTag}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={S.summaryRow}><span>ยอดรวม</span><span>฿{subtotal.toLocaleString()}</span></div>
        <div style={{ ...S.summaryRow, color: "#d32f2f" }}><span>ส่วนลดรวม</span><span>-฿{discountTotal.toLocaleString()}</span></div>
        <div style={{ ...S.summaryRow, fontSize: "20px", fontWeight: "bold", borderTop: "1px solid #ddd", paddingTop: "10px", color: "#4caf50" }}>
          <span>ยอดสุทธิ</span><span>฿{total.toLocaleString()}</span>
        </div>

        <button onClick={() => onCheckout("transfer")} disabled={cart.length === 0} style={{ ...S.btnCheckout, marginTop: 15 }}>📱 โอนเงิน</button>
        <button onClick={() => onCheckout("cash")} disabled={cart.length === 0} style={{ ...S.btnCheckout, backgroundColor: "#4caf50", marginTop: 8 }}>💵 เงินสด</button>
      </div>

      {showRedeem && memberInfo && (
        <RedeemModal memberPhone={memberPhone} memberInfo={memberInfo} onSuccess={(updated) => { setShowRedeem(false); }} onClose={() => setShowRedeem(false)} />
      )}
    </div>
  );
}

const S = {
  container: { height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#fff", color: "#333" },
  header: { padding: "15px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" },
  btnClear: { background: "none", border: "none", color: "#ff4444", cursor: "pointer", fontSize: "13px" },
  cartList: { flex: 1, overflowY: "auto", padding: "10px 20px" },
  cartItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f9f9f9" },
  btnDelete: { background: "none", border: "none", cursor: "pointer", padding: "4px" },
  footer: { padding: "20px", borderTop: "1px solid #eee", backgroundColor: "#fcfcfc" },
  summaryRow: { display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "14px" },
  btnCheckout: { width: "100%", padding: "14px", borderRadius: "10px", border: "none", backgroundColor: "#213547", color: "#fff", fontWeight: "bold", fontSize: "16px", cursor: "pointer" },
  input: { padding: "10px", borderRadius: "8px", border: "1px solid #ddd", outline: "none" },
  btnSmallAction: { padding: "4px 12px", borderRadius: 6, background: "#f5c518", color: "#000", border: "none", fontSize: 11, fontWeight: "bold", cursor: "pointer" },
  rewardBadge: { display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#fff", border: "1px solid #f5c518", color: "#b8860b", borderRadius: 14, fontSize: 11, fontWeight: "bold", cursor: "pointer" },
  tag: { padding: "4px 10px", background: "#f3f3f3", borderRadius: 14, fontSize: 11, border: "1px solid #ddd", display: "flex", alignItems: "center", gap: 6 },
  removeTag: { background: "none", border: "none", color: "#ff4444", cursor: "pointer", padding: 0, fontWeight: "bold" },
  empty: { textAlign: "center", padding: "40px 0", color: "#ccc" }
};
