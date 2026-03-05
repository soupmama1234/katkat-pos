import React, { useState, useEffect } from "react";
import { supabase as sb } from "../supabase";

// Modal แลกแต้ม — บันทึกรางวัลเข้าคลังสมาชิก
export default function RedeemModal({ memberPhone, memberInfo, onSuccess, onClose }) {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(null);

  useEffect(() => {
    sb.from("rewards").select("*").eq("is_active", true).order("points_required")
      .then(({ data }) => { setRewards(data || []); setLoading(false); });
  }, []);

  const handleRedeem = async (reward) => {
    if (memberInfo.points < reward.points_required) return;
    if (!window.confirm(`แลก "${reward.name}" ใช้ ${reward.points_required} แต้ม? (รางวัลจะถูกเก็บไว้ในบัญชีสมาชิก)`)) return;
    
    setRedeeming(reward.id);
    try {
      const newPoints = (memberInfo.points || 0) - reward.points_required;
      
      // ข้อมูลรางวัลที่จะเก็บเข้าคลัง
      const newInventoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        reward_id: reward.id,
        name: reward.name,
        type: reward.type || 'item',
        discount_amount: reward.discount_amount || 0,
        discount_type: reward.discount_type || 'amount',
        redeemed_at: new Date().toISOString(),
        used_at: null
      };

      const currentInventory = Array.isArray(memberInfo.redeemed_rewards) ? memberInfo.redeemed_rewards : [];
      const updatedInventory = [newInventoryItem, ...currentInventory];

      // อัปเดตสมาชิกใน Database
      const { data: updatedMember, error } = await sb.from("members")
        .update({ 
          points: newPoints,
          redeemed_rewards: updatedInventory
        })
        .eq("phone", memberPhone)
        .select()
        .single();

      if (error) throw error;

      // บันทึกประวัติแต้ม
      await sb.from("point_history").insert({
        member_phone: memberPhone,
        type: "redeem",
        points: -reward.points_required,
        note: `แลก: ${reward.name} (เก็บเข้าคลัง)`,
        reward_id: reward.id,
      });

      alert(`✅ แลกสำเร็จ! "${reward.name}" อยู่ในบัญชีสมาชิกแล้ว`);
      onSuccess(updatedMember); // ส่งข้อมูลสมาชิกที่อัปเดตแล้วกลับไป
      onClose();
    } catch (e) {
      alert("แลกแต้มไม่สำเร็จ: " + e.message);
    }
    setRedeeming(null);
  };

  const currentPoints = memberInfo?.points || 0;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 16 }}>🎁 แลกแต้มสมาชิก</div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
              {memberInfo?.nickname} · มี <span style={{ color: "#f5c518", fontWeight: "bold" }}>⭐ {currentPoints} แต้ม</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#555", padding: 30 }}>กำลังโหลด...</div>
          ) : rewards.length === 0 ? (
            <div style={{ textAlign: "center", color: "#555", padding: 30 }}>ยังไม่มีรายการของรางวัล</div>
          ) : rewards.map(r => {
            const canRedeem = currentPoints >= r.points_required;
            const isDiscount = r.type === 'discount';
            return (
              <div key={r.id} style={{ ...S.rewardRow, opacity: canRedeem ? 1 : 0.4 }}>
                <div style={{ fontSize: 24, padding: "0 4px" }}>{isDiscount ? "🎟️" : "🍔"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", fontSize: 15 }}>{r.name}</div>
                  {isDiscount && (
                    <div style={{ fontSize: 11, background: "rgba(76,175,80,0.15)", color: "#4caf50", display: "inline-block", padding: "1px 6px", borderRadius: 4, marginTop: 2, fontWeight: "bold" }}>
                      ส่วนลด {r.discount_amount}{r.discount_type === "percent" ? "%" : "฿"}
                    </div>
                  )}
                  {r.description && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{r.description}</div>}
                  <div style={{ fontSize: 13, color: "#f5c518", marginTop: 4, fontWeight: "bold" }}>⭐ {r.points_required} แต้ม</div>
                </div>
                <button
                  onClick={() => canRedeem && handleRedeem(r)}
                  disabled={!canRedeem || redeeming === r.id}
                  style={{
                    ...S.btnRedeem,
                    background: canRedeem ? "#f5c518" : "#2a2a2a",
                    color: canRedeem ? "#000" : "#555",
                    cursor: canRedeem ? "pointer" : "not-allowed",
                  }}>
                  {redeeming === r.id ? "⏳" : canRedeem ? "แลกเก็บไว้" : "แต้มไม่พอ"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 3000 },
  modal: { background: "#1a1a1a", borderRadius: "20px 20px 0 0", padding: "24px 20px", width: "100%", maxWidth: 480, border: "1px solid #2a2a2a", borderBottom: "none" },
  rewardRow: { display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid #1e1e1e" },
  btnRedeem: { padding: "10px 16px", borderRadius: 10, border: "none", fontWeight: "bold", fontSize: 13, flexShrink: 0 },
};
