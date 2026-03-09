import React, { useState, useEffect } from "react";
import { supabase as sb } from "../supabase";
import { Trash2 } from "lucide-react";
import db from "../storage";

export default function RewardManager({ showToast, showConfirm, members = [] }) {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    points_required: "",
    description: "",
    type: "item",
    discount_amount: "",
    discount_type: "amount",
    expiry_days: "30",
  });
  const [saving, setSaving] = useState(false);
  const [sendTarget, setSendTarget] = useState("all");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await sb.from("rewards").select("*").order("points_required");
      if (!active) return;
      if (error) showToast?.("โหลด Rewards ไม่ได้: " + error.message, "error");
      setRewards(data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const handleAdd = async () => {
    if (!form.name.trim()) return showToast("กรุณาใส่ชื่อ Reward", "error");
    if (!form.points_required) return showToast("กรุณาใส่จำนวนแต้มที่ใช้", "error");
    if (form.type === "discount" && !form.discount_amount)
      return showToast("กรุณาใส่มูลค่าส่วนลด", "error");

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        points_required: Number(form.points_required),
        description: form.description.trim() || null,
        type: form.type,
        discount_amount: form.type === "discount" ? Number(form.discount_amount) : 0,
        discount_type: form.type === "discount" ? form.discount_type : null,
        is_active: true,
        expiry_days: form.expiry_days ? Number(form.expiry_days) : null,
      };
      const { data, error } = await sb.from("rewards").insert(payload).select().single();
      if (error) throw error;

      setRewards(prev => [...prev, data].sort((a, b) => a.points_required - b.points_required));
      setForm({ name: "", points_required: "", description: "", type: "item", discount_amount: "", discount_type: "amount", expiry_days: "30" });
      showToast?.(`✅ เพิ่ม "${data.name}" เรียบร้อย`);
    } catch (e) {
      showToast?.("เพิ่มไม่สำเร็จ: " + e.message, "error");
    }
    setSaving(false);
  };

  const toggleActive = async (r) => {
    const next = !r.is_active;
    setRewards(prev => prev.map(x => x.id === r.id ? { ...x, is_active: next } : x));
    try {
      const { error } = await sb.from("rewards").update({ is_active: next }).eq("id", r.id);
      if (error) throw error;
      showToast?.(`${next ? "✅ เปิด" : "⏸️ ปิด"} "${r.name}" แล้ว`);
    } catch (e) {
      setRewards(prev => prev.map(x => x.id === r.id ? { ...x, is_active: r.is_active } : x));
      showToast?.("เปลี่ยนสถานะไม่สำเร็จ: " + e.message, "error");
    }
  };

  const handleDelete = async (r) => {
    const ok = showConfirm
      ? await showConfirm("ลบ Reward?", `ต้องการลบ "${r.name}" ใช่หรือไม่?`)
      : window.confirm(`ลบ "${r.name}"?`);
    if (!ok) return;

    try {
      const { error } = await sb.from("rewards").delete().eq("id", r.id);
      if (error) throw error;
      setRewards(prev => prev.filter(x => x.id !== r.id));
      showToast?.(`🗑️ ลบ "${r.name}" แล้ว`);
    } catch (e) {
      showToast?.("ลบไม่สำเร็จ: " + e.message, "error");
    }
  };

  const handleSendCoupon = async (reward) => {
    const targetList = sendTarget === "all" ? members : members.filter(m => {
      if (sendTarget === "never") return !m.last_visit;
      return false;
    });
    if (targetList.length === 0) return showToast("ไม่มีสมาชิกในกลุ่มนี้", "error");
    const ok = await showConfirm?.("ส่งคูปอง?", `ส่ง "${reward.name}" ให้ ${targetList.length} คน?`);
    if (!ok) return;
    setSending(true);
    try {
      const expiryDate = reward.expiry_days ? new Date(Date.now() + reward.expiry_days * 86400000).toISOString() : null;
      const coupon = { id: `${reward.id}-${Date.now()}`, name: reward.name, type: reward.type, discount_amount: reward.discount_amount, discount_type: reward.discount_type, expires_at: expiryDate, granted_at: new Date().toISOString() };
      await db.sendCouponToMembers(targetList.map(m => m.phone), coupon);
      showToast?.(`ส่งคูปองให้ ${targetList.length} คนเรียบร้อย 🎁`);
    } catch (e) { showToast?.("ส่งไม่สำเร็จ: " + e.message, "error"); }
    setSending(false);
  };

  return (
    <div style={S.wrap}>
      <div style={S.title}>🎁 จัดการ Rewards</div>

      {/* Add form */}
      <div style={S.card}>
        <div style={S.cardTitle}>เพิ่ม Reward ใหม่</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Type selector */}
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { key: "item", label: "🍔 สินค้าฟรี / อื่นๆ" },
              { key: "discount", label: "🎟️ ส่วนลดเงินสด" },
            ].map(t => (
              <button key={t.key} onClick={() => setForm(f => ({ ...f, type: t.key }))}
                style={{ ...S.typeBtn,
                  border: form.type === t.key ? "1px solid #4caf50" : "1px solid #333",
                  background: form.type === t.key ? "rgba(76,175,80,0.1)" : "none",
                  color: form.type === t.key ? "#4caf50" : "#666",
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Name + points */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="ชื่อ reward เช่น เครื่องดื่มฟรี"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              style={{ ...S.input, flex: 2 }}
            />
            <input
              type="number" inputMode="numeric"
              placeholder="แต้มที่ใช้"
              value={form.points_required}
              onChange={e => setForm(f => ({ ...f, points_required: e.target.value }))}
              style={{ ...S.input, width: 110 }}
            />
          </div>

          {/* Discount fields */}
          {form.type === "discount" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#1a1a1a", padding: "8px 12px", borderRadius: 10, border: "1px dashed #333" }}>
              <span style={{ fontSize: 13, color: "#888", flexShrink: 0 }}>มูลค่าส่วนลด:</span>
              <input
                type="number" inputMode="decimal"
                placeholder="0"
                value={form.discount_amount}
                onChange={e => setForm(f => ({ ...f, discount_amount: e.target.value }))}
                style={{ ...S.input, width: 90, textAlign: "center" }}
              />
              <select
                value={form.discount_type}
                onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}
                style={{ ...S.input, width: 115 }}
              >
                <option value="amount">บาท (฿)</option>
                <option value="percent">เปอร์เซ็นต์ (%)</option>
              </select>
            </div>
          )}

          <input
            placeholder="คำอธิบาย (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            style={S.input}
          />

          {/* Expiry days */}
          <div>
            <div style={{ color: "#666", fontSize: 12, marginBottom: 6 }}>หมดอายุคูปองภายใน (วัน) — ว่างไว้ = ไม่หมดอายุ</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {["7", "14", "30", "60", "90"].map(d => (
                <button key={d} onClick={() => setForm(f => ({ ...f, expiry_days: d }))}
                  style={{ padding: "5px 12px", borderRadius: 8, border: form.expiry_days === d ? "1px solid #4D96FF" : "1px solid #333", background: form.expiry_days === d ? "rgba(77,150,255,0.15)" : "none", color: form.expiry_days === d ? "#4D96FF" : "#666", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                  {d} วัน
                </button>
              ))}
              <button onClick={() => setForm(f => ({ ...f, expiry_days: "" }))}
                style={{ padding: "5px 12px", borderRadius: 8, border: !form.expiry_days ? "1px solid #4D96FF" : "1px solid #333", background: !form.expiry_days ? "rgba(77,150,255,0.15)" : "none", color: !form.expiry_days ? "#4D96FF" : "#666", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                ไม่หมดอายุ
              </button>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={saving || !form.name || !form.points_required}
            style={{ ...S.btnAdd, opacity: saving || !form.name || !form.points_required ? 0.5 : 1 }}
          >
            {saving ? "กำลังบันทึก..." : "+ เพิ่ม Reward"}
          </button>
        </div>
      </div>

      {/* List */}
      <div style={S.card}>
        <div style={S.cardTitle}>Rewards ทั้งหมด ({rewards.length})</div>
        {loading ? (
          <div style={S.dim}>กำลังโหลด...</div>
        ) : rewards.length === 0 ? (
          <div style={S.dim}>ยังไม่มี reward — เพิ่มด้านบนได้เลย</div>
        ) : rewards.map(r => (
          <div key={r.id} style={{ ...S.row, opacity: r.is_active ? 1 : 0.4 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: "bold", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18 }}>{r.type === "discount" ? "🎟️" : "🎁"}</span>
                <span>{r.name}</span>
                {r.type === "discount" && r.discount_amount > 0 && (
                  <span style={{ fontSize: 11, background: "rgba(76,175,80,0.2)", color: "#4caf50", padding: "2px 7px", borderRadius: 6, fontWeight: "bold" }}>
                    ลด {r.discount_amount}{r.discount_type === "percent" ? "%" : "฿"}
                  </span>
                )}
                {!r.is_active && <span style={S.tagOff}>ปิดใช้งาน</span>}
                {r.expiry_days && <span style={{ fontSize: 11, background: "rgba(77,150,255,0.15)", color: "#4D96FF", padding: "2px 7px", borderRadius: 6 }}>⏰ {r.expiry_days} วัน</span>}
              </div>
              {r.description && <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>{r.description}</div>}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ color: "#f5c518", fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>⭐ {r.points_required}</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={() => toggleActive(r)}
                  style={{ ...S.btnToggle, color: r.is_active ? "#ff9800" : "#4caf50" }}>
                  {r.is_active ? "ปิด" : "เปิด"}
                </button>
                <button onClick={() => handleDelete(r)} style={S.btnDel}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Send Coupon Section */}
      {members.length > 0 && rewards.filter(r => r.is_active).length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>📢 ส่งคูปองให้สมาชิก</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>กลุ่มเป้าหมาย</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["all", `👥 ทั้งหมด (${members.length} คน)`], ["never", `👻 ยังไม่เคยมา`]].map(([val, label]) => (
                <button key={val} onClick={() => setSendTarget(val)}
                  style={{ padding: "8px 14px", borderRadius: 10, border: sendTarget === val ? "1px solid #FF9F0A" : "1px solid #333", background: sendTarget === val ? "rgba(255,159,10,0.15)" : "none", color: sendTarget === val ? "#FF9F0A" : "#666", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>เลือก Reward ที่จะส่ง</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rewards.filter(r => r.is_active).map(r => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a1a1a", borderRadius: 10, padding: "10px 14px" }}>
                <div>
                  <span style={{ fontSize: 15 }}>{r.type === "discount" ? "🎟️" : "🎁"}</span>
                  <span style={{ color: "#fff", fontWeight: 700, marginLeft: 8 }}>{r.name}</span>
                  {r.expiry_days && <span style={{ color: "#4D96FF", fontSize: 12, marginLeft: 8 }}>⏰ {r.expiry_days} วัน</span>}
                </div>
                <button onClick={() => handleSendCoupon(r)} disabled={sending}
                  style={{ background: sending ? "#333" : "#FF9F0A", color: sending ? "#666" : "#000", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 800, cursor: sending ? "not-allowed" : "pointer" }}>
                  {sending ? "⏳" : "ส่ง"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  wrap: { padding: 16, color: "#fff", maxWidth: 600 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 14 },
  card: { background: "#111", borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 11, color: "#555", fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  input: { background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", width: "100%" },
  btnAdd: { background: "#4caf50", border: "none", color: "#fff", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: "bold", cursor: "pointer", marginTop: 2 },
  typeBtn: { flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: "bold" },
  row: { display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 0", borderBottom: "1px solid #1a1a1a" },
  tagOff: { fontSize: 10, background: "#333", color: "#666", padding: "2px 7px", borderRadius: 8 },
  btnToggle: { background: "#2a2a2a", border: "1px solid #333", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" },
  btnDel: { background: "none", border: "none", color: "#555", cursor: "pointer", padding: "4px 6px", display: "flex", alignItems: "center" },
  dim: { color: "#444", fontSize: 13, padding: "8px 0" },
};
