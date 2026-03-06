import React, { useState, useEffect } from "react";
import { supabase as sb } from "../supabase";
import { Trash2 } from "lucide-react";

export default function RewardManager({ showToast, showConfirm }) {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    points_required: "",
    description: "",
    type: "item",
    discount_amount: "",
    discount_type: "amount",
  });
  const [saving, setSaving] = useState(false);

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
      };
      const { data, error } = await sb.from("rewards").insert(payload).select().single();
      if (error) throw error;

      setRewards(prev => [...prev, data].sort((a, b) => a.points_required - b.points_required));
      setForm({ name: "", points_required: "", description: "", type: "item", discount_amount: "", discount_type: "amount" });
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
