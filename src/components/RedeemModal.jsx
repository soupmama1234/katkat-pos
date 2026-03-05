import React, { useState, useEffect } from "react";
import { supabase as sb } from "../supabase";

// Modal แลกแต้ม — เรียกใช้จาก MobilePOS และ Cart
// props: memberPhone, memberInfo, onSuccess(updatedMember), onClose
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
    if (!window.confirm(`แลก "${reward.name}" ใช้ ${reward.points_required} แต้ม?`)) return;
    setRedeeming(reward.id);
    try {
      // หักแต้ม
      const newPoints = memberInfo.points - reward.points_required;
      await sb.from("members").update({ points: newPoints }).eq("phone", memberPhone);

      // บันทึก history
      await sb.from("point_history").insert({
        member_phone: memberPhone,
        type: "redeem",
        points: -reward.points_required,
        note: `แลก: ${reward.name}`,
        reward_id: reward.id,
      });

      onSuccess({ ...memberInfo, points: newPoints }, reward);
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
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 16 }}>🎁 แลกแต้ม</div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
              {memberInfo?.nickname} · มี <span style={{ color: "#f5c518", fontWeight: "bold" }}>⭐ {currentPoints} แต้ม</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {/* Rewards list */}
        <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#555", padding: 30 }}>กำลังโหลด...</div>
          ) : rewards.length === 0 ? (
            <div style={{ textAlign: "center", color: "#555", padding: 30 }}>ยังไม่มี reward — ตั้งค่าได้ใน หน้าสมาชิก</div>
          ) : rewards.map(r => {
            const canRedeem = currentPoints >= r.points_required;
            const isLoading = redeeming === r.id;
            const isDiscount = r.type === 'discount';
            return (
              <div key={r.id} style={{ ...S.rewardRow, opacity: canRedeem ? 1 : 0.4 }}>
                <div style={{ fontSize: 24, padding: "0 4px" }}>{isDiscount ? "🎟️" : "🎁"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", fontSize: 15 }}>{r.name}</div>
                  {isDiscount && (
                    <div style={{ fontSize: 11, background: "rgba(76,175,80,0.15)", color: "#4caf50", display: "inline-block", padding: "1px 6px", borderRadius: 4, marginTop: 2, fontWeight: "bold" }}>
                      ส่วนลด {r.discount_amount}{r.discount_type === "percent" ? "%" : "฿"}
                    </div>
                  )}
                  {r.description && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{r.description}</div>}
                  <div style={{ fontSize: 13, color: "#f5c518", marginTop: 4, fontWeight: "bold" }}>⭐ {r.points_required} แต้ม</div>
          ...
                    <div style={{ fontSize: 11, color: "#ff6b6b", marginTop: 2 }}>
                      ขาดอีก {r.points_required - currentPoints} แต้ม
                    </div>
                  )}
                </div>
                <button
                  onClick={() => canRedeem && handleRedeem(r)}
                  disabled={!canRedeem || isLoading}
                  style={{
                    ...S.btnRedeem,
                    background: canRedeem ? "#f5c518" : "#2a2a2a",
                    color: canRedeem ? "#000" : "#555",
                    cursor: canRedeem ? "pointer" : "not-allowed",
                  }}>
                  {isLoading ? "⏳" : canRedeem ? "แลกเลย" : "ไม่พอ"}
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
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#1a1a1a", borderRadius: "20px 20px 0 0", padding: "24px 20px", width: "100%", maxWidth: 480, border: "1px solid #2a2a2a", borderBottom: "none" },
  rewardRow: { display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid #1e1e1e" },
  btnRedeem: { padding: "10px 16px", borderRadius: 10, border: "none", fontWeight: "bold", fontSize: 13, flexShrink: 0 },
};