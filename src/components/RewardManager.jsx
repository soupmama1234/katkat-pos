import React, { useState, useEffect } from "react";
import { supabase as sb } from "../supabase";

export default function RewardManager() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", points_required: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchRewards(); }, []);

  const fetchRewards = async () => {
    setLoading(true);
    const { data } = await sb.from("rewards").select("*").order("points_required");
    setRewards(data || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.name || !form.points_required) return;
    setSaving(true);
    const { data, error } = await sb.from("rewards").insert({
      name: form.name.trim(),
      points_required: Number(form.points_required),
      description: form.description.trim() || null,
      is_active: true,
    }).select().single();
    if (!error) { setRewards(prev => [...prev, data].sort((a,b) => a.points_required - b.points_required)); }
    setForm({ name: "", points_required: "", description: "" });
    setSaving(false);
  };

  const toggleActive = async (r) => {
    await sb.from("rewards").update({ is_active: !r.is_active }).eq("id", r.id);
    setRewards(prev => prev.map(x => x.id === r.id ? { ...x, is_active: !x.is_active } : x));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("ลบ reward นี้?")) return;
    await sb.from("rewards").delete().eq("id", id);
    setRewards(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div style={S.wrap}>
      <div style={S.title}>🎁 จัดการ Rewards</div>

      {/* Add form */}
      <div style={S.card}>
        <div style={S.cardTitle}>เพิ่ม Reward ใหม่</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="ชื่อ reward เช่น เครื่องดื่มฟรี" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ ...S.input, flex: 2 }} />
            <input type="number" placeholder="แต้มที่ใช้" value={form.points_required}
              onChange={e => setForm(f => ({ ...f, points_required: e.target.value }))}
              style={{ ...S.input, width: 110 }} />
          </div>
          <input placeholder="คำอธิบาย (optional) เช่น เมนูราคาไม่เกิน ฿40" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            style={S.input} />
          <button onClick={handleAdd} disabled={saving || !form.name || !form.points_required} style={S.btnAdd}>
            {saving ? "กำลังบันทึก..." : "+ เพิ่ม Reward"}
          </button>
        </div>
      </div>

      {/* List */}
      <div style={S.card}>
        <div style={S.cardTitle}>Rewards ทั้งหมด ({rewards.length})</div>
        {loading ? <div style={S.dim}>กำลังโหลด...</div> : rewards.length === 0 ? (
          <div style={S.dim}>ยังไม่มี reward — เพิ่มด้านบนได้เลย</div>
        ) : rewards.map(r => (
          <div key={r.id} style={{ ...S.row, opacity: r.is_active ? 1 : 0.45 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "bold", display: "flex", alignItems: "center", gap: 8 }}>
                🎁 {r.name}
                {!r.is_active && <span style={S.tagOff}>ปิดใช้งาน</span>}
              </div>
              {r.description && <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{r.description}</div>}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ color: "#f5c518", fontWeight: "bold", fontSize: 16 }}>⭐ {r.points_required}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 4, justifyContent: "flex-end" }}>
                <button onClick={() => toggleActive(r)} style={S.btnToggle}>
                  {r.is_active ? "ปิด" : "เปิด"}
                </button>
                <button onClick={() => handleDelete(r.id)} style={S.btnDel}>🗑️</button>
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
  btnAdd: { background: "#4caf50", border: "none", color: "#fff", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: "bold", cursor: "pointer" },
  row: { display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 0", borderBottom: "1px solid #1a1a1a" },
  tagOff: { fontSize: 10, background: "#333", color: "#666", padding: "2px 7px", borderRadius: 8 },
  btnToggle: { background: "#2a2a2a", border: "1px solid #333", color: "#aaa", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" },
  btnDel: { background: "none", border: "none", color: "#555", fontSize: 16, cursor: "pointer", padding: "4px 6px" },
  dim: { color: "#444", fontSize: 13, padding: "8px 0" },
};