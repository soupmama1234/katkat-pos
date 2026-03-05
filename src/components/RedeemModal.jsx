import React, { useState, useEffect } from "react";
import { supabase as sb } from "../supabase";

// Modal แลกแต้ม — เรียกใช้จาก MobilePOS และ Cart
// props: memberPhone, memberInfo, onSuccess(updatedMember), onClose
export default function RedeemModal({ memberPhone, memberInfo, onSuccess, onClose }) {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(null);
  
  // Custom Notification & Confirmation State
  const [notif, setNotif] = useState(null); // { message, type, isConfirm, onOk }

  useEffect(() => {
    sb.from("rewards").select("*").eq("is_active", true).order("points_required")
      .then(({ data }) => { setRewards(data || []); setLoading(false); });
  }, []);

  const showNotif = (msg, type = "success", isConfirm = false, onOk = null) => {
    setNotif({ message: msg, type, isConfirm, onOk });
    if (!isConfirm) {
      setTimeout(() => setNotif(null), 3000);
    }
  };

  const handleRedeem = async (reward) => {
    if (memberInfo.points < reward.points_required) return;
    
    showNotif(
      `แลก "${reward.name}" ใช้ ${reward.points_required} แต้ม?\n(รางวัลจะถูกเก็บไว้ในบัญชีของคุณ)`,
      "confirm",
      true,
      async () => {
        setNotif(null);
        setRedeeming(reward.id);
        try {
          const newPoints = memberInfo.points - reward.points_required;
          
          const newRewardItem = {
            id: Math.random().toString(36).substr(2, 9),
            reward_id: reward.id,
            name: reward.name,
            type: reward.type || 'item',
            discount_amount: reward.discount_amount || 0,
            discount_type: reward.discount_type || 'amount',
            redeemed_at: new Date().toISOString(),
            used_at: null
          };

          const currentRewards = Array.isArray(memberInfo.redeemed_rewards) ? memberInfo.redeemed_rewards : [];
          const updatedRewards = [newRewardItem, ...currentRewards];

          const { data: updatedMember, error } = await sb.from("members")
            .update({ 
              points: newPoints,
              redeemed_rewards: updatedRewards
            })
            .eq("phone", memberPhone)
            .select()
            .single();

          if (error) throw error;

          await sb.from("point_history").insert({
            member_phone: memberPhone,
            type: "redeem",
            points: -reward.points_required,
            note: `แลก: ${reward.name} (เก็บเข้าคลัง)`,
            reward_id: reward.id,
          });

          showNotif(`✅ แลกสำเร็จ! "${reward.name}" อยู่ในบัญชีสมาชิกแล้ว`);
          setTimeout(() => {
            onSuccess(updatedMember, reward); 
            onClose();
          }, 1500);
        } catch (e) {
          showNotif("แลกแต้มไม่สำเร็จ: " + e.message, "error");
        }
        setRedeeming(null);
      }
    );
  };

  const currentPoints = memberInfo?.points || 0;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 16 }}>🎁 แลกแต้ม</div>
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
            <div style={{ textAlign: "center", color: "#555", padding: 30 }}>ยังไม่มี reward — ตั้งค่าได้ใน หน้าสมาชิก</div>
          ) : rewards.map(r => {
            const canRedeem = currentPoints >= r.points_required;
            const isLoading = redeeming === r.id;
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
                  {!canRedeem && (
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

      {/* Modern Center Notification / Confirmation */}
      {notif && (
        <div style={S.notifOverlay}>
          <div style={S.notifCard}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>
              {notif.type === "confirm" ? "🤔" : notif.type === "error" ? "❌" : "✨"}
            </div>
            <div style={{ fontSize: 15, color: "#fff", lineHeight: "1.5", whiteSpace: "pre-line", marginBottom: 20 }}>
              {notif.message}
            </div>
            {notif.isConfirm ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setNotif(null)} style={{ ...S.notifBtn, backgroundColor: "#333", color: "#ccc" }}>ยกเลิก</button>
                <button onClick={notif.onOk} style={{ ...S.notifBtn, backgroundColor: "#f5c518", color: "#000" }}>ตกลง</button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 3000 },
  modal: { background: "#1a1a1a", borderRadius: "20px 20px 0 0", padding: "24px 20px", width: "100%", maxWidth: 480, border: "1px solid #2a2a2a", borderBottom: "none" },
  rewardRow: { display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid #1e1e1e" },
  btnRedeem: { padding: "10px 16px", borderRadius: 10, border: "none", fontWeight: "bold", fontSize: 13, flexShrink: 0 },
  
  // New Styles for Center Notification
  notifOverlay: { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, background: "rgba(0,0,0,0.4)" },
  notifCard: { background: "#111", border: "1px solid #333", borderRadius: 24, padding: "24px", width: "85%", maxWidth: 300, textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.5)", animation: "popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" },
  notifBtn: { flex: 1, padding: "12px", borderRadius: 12, border: "none", fontWeight: "bold", fontSize: 14, cursor: "pointer" },
};
