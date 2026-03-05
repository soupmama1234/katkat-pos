import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase as sb } from "../supabase";
import { calcPoints, nextThreshold, getPointSettings } from "../utils/points";
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
  const [showRedeem, setShowRedeem] = useState(false);
  const [discountMode, setDiscountMode] = useState("amount"); 
  const [discountInput, setDiscountInput] = useState("");
  const [refValue, setRefValue] = useState("");

  const handleCheckout = async (payMethod) => {
    if (cart.length === 0) return;
    if (orderType === "dine_in" && !tableNo) {
      showToast("กรุณาระบุเลขโต๊ะ", "error");
      return;
    }
    const ok = await showConfirm("ชำระเงิน?", `ยืนยันการชำระเงินยอด ฿${total.toLocaleString()}?`, null, "primary");
    if (ok) onCheckout(payMethod, refValue);
  };

  const handleApplyManualDiscount = () => {
    const val = Number(discountInput);
    if (!(val > 0)) return;
    onApplyManualDiscount?.({ mode: discountMode, value: val });
    setDiscountInput("");
  };

  const memberInfo = sb.auth.user ? null : null; // dummy for logic
  const clearMember = () => setMemberPhone("");

  return (
    <div style={S.container}>
      <div style={S.header}>
        <h3 style={{ margin: 0 }}>ตะกร้าสินค้า</h3>
        <button onClick={onClearCart} style={S.btnClear}>ล้างตะกร้า</button>
      </div>

      {/* ── Order Type & Table (Desktop) ── */}
      <div style={{ padding: "12px 16px", background: "#111", borderBottom: "1px solid #333" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
          <button onClick={() => setOrderType("dine_in")} style={{ ...S.typeBtn, background: orderType === "dine_in" ? "#4caf50" : "#222", color: orderType === "dine_in" ? "#fff" : "#666" }}>
            🏠 ทานที่ร้าน
          </button>
          <button onClick={() => setOrderType("takeaway")} style={{ ...S.typeBtn, background: orderType === "takeaway" ? "#ff9800" : "#222", color: orderType === "takeaway" ? "#fff" : "#666" }}>
            🥡 กลับบ้าน
          </button>
        </div>
        {orderType === "dine_in" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#888" }}>เลขโต๊ะ:</span>
            <input placeholder="ระบุเลขโต๊ะ..." value={tableNo} onChange={e => setTableNo(e.target.value)}
              style={{ ...S.input, flex: 1, padding: "6px 10px", fontSize: 14 }} />
          </div>
        )}
      </div>

      <div style={S.cartList}>
        {cart.length === 0 ? (
          <div style={S.empty}>ไม่มีสินค้าในตะกร้า</div>
        ) : (
          cart.map((item, idx) => (
            <div key={`${item.id}-${idx}`} style={S.cartItem}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", fontSize: "14px" }}>{item.name}</div>
                {item.selectedModifier && (
                  <div style={{ fontSize: "11px", color: "#888" }}>+ {item.selectedModifier.name}</div>
                )}
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
        {/* Discount UI */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div style={{ display: "flex", borderRadius: 8, border: "1px solid #ddd", overflow: "hidden" }}>
            <button onClick={() => setDiscountMode("amount")} style={{ flex: 1, border: "none", background: discountMode === "amount" ? "#213547" : "#fff", color: discountMode === "amount" ? "#fff" : "#213547", fontSize: 12, cursor: "pointer", transition: "0.2s" }}>฿ ลด</button>
            <button onClick={() => setDiscountMode("percent")} style={{ flex: 1, border: "none", borderLeft: "1px solid #ddd", background: discountMode === "percent" ? "#213547" : "#fff", color: discountMode === "percent" ? "#fff" : "#213547", fontSize: 12, cursor: "pointer", transition: "0.2s" }}>% ลด</button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <input value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder={discountMode === "percent" ? "เช่น 10" : "จำนวนเงิน"} type="number" inputMode="decimal" style={{ ...S.input, flex: 1, padding: "6px 8px" }} />
            <button onClick={handleApplyManualDiscount} style={{ ...S.btnSmall, background: "#213547", color: "#fff", border: "none", padding: "0 12px", fontWeight: "bold" }}>ใช้</button>
          </div>
        </div>
        
        {discounts.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, padding: "8px", background: "rgba(0,0,0,0.03)", borderRadius: 8 }}>
            {discounts.map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #213547", color: "#213547", borderRadius: 14, padding: "3px 10px", fontSize: 11 }}>
                <span style={{ fontWeight: "bold" }}>{d.label || "ส่วนลด"}:</span>
                <span>{d.mode === "percent" ? `${d.value}%` : `฿${d.value}`}</span>
                <button onClick={() => onRemoveDiscount?.(d.id)} style={{ background: "none", border: "none", color: "#d32f2f", padding: "0 0 0 4px", cursor: "pointer", fontWeight: "bold", fontSize: 14 }}>✕</button>
              </div>
            ))}
            <button onClick={() => onClearDiscounts?.()} style={{ background: "none", border: "none", color: "#666", fontSize: 11, textDecoration: "underline", cursor: "pointer", padding: "4px 0" }}>ล้างทั้งหมด</button>
          </div>
        )}

        <div style={S.summaryRow}>
          <span>ยอดรวม</span>
          <span>฿{subtotal.toLocaleString()}</span>
        </div>
        {discountTotal > 0 && (
          <div style={{ ...S.summaryRow, color: "#d32f2f" }}>
            <span>ส่วนลดรวม</span>
            <span>-฿{discountTotal.toLocaleString()}</span>
          </div>
        )}
        <div style={{ ...S.summaryRow, fontSize: "20px", fontWeight: "bold", borderTop: "1px solid #ddd", paddingTop: "10px", marginTop: "10px", color: "#4caf50" }}>
          <span>ยอดสุทธิ</span>
          <span>฿{total.toLocaleString()}</span>
        </div>

        <div style={{ marginTop: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button onClick={onSavePending} disabled={cart.length === 0} 
              style={{ ...S.btnCheckout, background: "#2a2a2a", color: "#f5c518", border: "1px solid #f5c51844" }}>
              ⏸️ พักบิล
            </button>
            <button onClick={() => handleCheckout("transfer")} disabled={cart.length === 0} style={S.btnCheckout}>
              📱 โอนเงิน
            </button>
          </div>
          <button onClick={() => handleCheckout("cash")} disabled={cart.length === 0} style={{ ...S.btnCheckout, backgroundColor: "#4caf50", marginTop: 10 }}>
            💵 เงินสด
          </button>
        </div>
      </div>

      {showRedeem && (
        <RedeemModal
          memberPhone={memberPhone}
          onSuccess={(updatedMember) => {
            setShowRedeem(false);
            showToast("แลกรางวัลสำเร็จ");
          }}
          onClose={() => setShowRedeem(false)}
        />
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
  btnDelete: { background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px", borderRadius: "6px" },
  footer: { padding: "20px", borderTop: "1px solid #eee", backgroundColor: "#fcfcfc" },
  summaryRow: { display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "14px" },
  btnCheckout: { width: "100%", padding: "14px", borderRadius: "10px", border: "none", backgroundColor: "#213547", color: "#fff", fontWeight: "bold", fontSize: "16px", cursor: "pointer" },
  input: { padding: "10px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "14px" },
  btnSmall: { padding: "4px 10px", borderRadius: 6, border: "1px solid #333", backgroundColor: "transparent", color: "#aaa", fontSize: 12, cursor: "pointer" },
  typeBtn: { flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: "bold", border: "none", cursor: "pointer", transition: "0.2s" },
  empty: { textAlign: "center", padding: "40px 0", color: "#ccc" },
};
