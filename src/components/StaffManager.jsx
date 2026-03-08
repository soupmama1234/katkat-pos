// src/components/StaffManager.jsx
import React, { useState, useEffect } from "react";
import { supabase as sb } from "../supabase";
import { hashPin } from "../utils/auth";

const ROLE_LABEL = { owner: "👑 Owner", manager: "🔑 Manager", staff: "👤 Staff" };
const ROLE_COLOR = { owner: "#FF9F0A", manager: "#0A84FF", staff: "#32D74B" };

export default function StaffManager({ session }) {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);

  // form state
  const [formName, setFormName] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formPin2, setFormPin2] = useState("");
  const [formRole, setFormRole] = useState("staff");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => { fetchStaff(); }, []);

  async function fetchStaff() {
    setLoading(true);
    const { data } = await sb.from("staff").select("id,name,role,is_active,created_at").order("created_at");
    setStaffList(data || []);
    setLoading(false);
  }

  function openAdd() {
    setFormName(""); setFormPin(""); setFormPin2(""); setFormRole("staff"); setFormError("");
    setEditId(null); setShowAdd(true);
  }

  function openEdit(s) {
    setFormName(s.name); setFormPin(""); setFormPin2(""); setFormRole(s.role); setFormError("");
    setEditId(s.id); setShowAdd(true);
  }

  async function handleSave() {
    setFormError("");
    if (!formName.trim()) { setFormError("กรุณากรอกชื่อ"); return; }

    // ถ้าเพิ่มใหม่ หรือกรอก PIN → ต้อง validate PIN
    if (!editId || formPin) {
      if (!/^\d{6}$/.test(formPin)) { setFormError("PIN ต้องเป็นตัวเลข 6 หลัก"); return; }
      if (formPin !== formPin2) { setFormError("PIN ทั้งสองช่องไม่ตรงกัน"); return; }
    }

    setFormLoading(true);
    try {
      if (editId) {
        // แก้ไข
        const updates = { name: formName.trim(), role: formRole };
        if (formPin) updates.pin_hash = await hashPin(formPin);
        const { error } = await sb.from("staff").update(updates).eq("id", editId);
        if (error) throw error;
      } else {
        // เพิ่มใหม่
        const pin_hash = await hashPin(formPin);
        const { error } = await sb.from("staff").insert({
          name: formName.trim(), pin_hash, role: formRole, is_active: true,
        });
        if (error) throw error;
      }
      setShowAdd(false);
      fetchStaff();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setFormLoading(false);
    }
  }

  async function toggleActive(s) {
    if (s.id === session.id) { alert("ไม่สามารถปิดบัญชีของตัวเองได้"); return; }
    await sb.from("staff").update({ is_active: !s.is_active }).eq("id", s.id);
    fetchStaff();
  }

  async function handleDelete(s) {
    if (s.id === session.id) { alert("ไม่สามารถลบบัญชีของตัวเองได้"); return; }
    if (!window.confirm(`ลบ "${s.name}" ออกจากระบบ?`)) return;
    await sb.from("staff").delete().eq("id", s.id);
    fetchStaff();
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div>
          <div style={s.title}>👥 จัดการพนักงาน</div>
          <div style={s.sub}>{staffList.length} บัญชี</div>
        </div>
        <button style={s.addBtn} onClick={openAdd}>+ เพิ่มพนักงาน</button>
      </div>

      {/* Staff list */}
      {loading ? (
        <div style={s.empty}>⏳ กำลังโหลด...</div>
      ) : (
        <div style={s.list}>
          {staffList.map(staff => (
            <div key={staff.id} style={{ ...s.row, opacity: staff.is_active ? 1 : 0.5 }}>
              <div style={s.rowLeft}>
                <div style={s.rowName}>
                  {staff.name}
                  {staff.id === session.id && (
                    <span style={s.meBadge}>ฉัน</span>
                  )}
                </div>
                <div style={{ ...s.roleBadge, color: ROLE_COLOR[staff.role], borderColor: ROLE_COLOR[staff.role] + "44" }}>
                  {ROLE_LABEL[staff.role]}
                </div>
              </div>
              <div style={s.rowActions}>
                <button style={s.iconBtn} onClick={() => openEdit(staff)} title="แก้ไข">✏️</button>
                <button
                  style={{ ...s.iconBtn, color: staff.is_active ? "#32D74B" : "#555" }}
                  onClick={() => toggleActive(staff)}
                  title={staff.is_active ? "ปิดบัญชี" : "เปิดบัญชี"}
                >
                  {staff.is_active ? "✅" : "⛔"}
                </button>
                <button style={{ ...s.iconBtn, color: "#FF453A" }} onClick={() => handleDelete(staff)} title="ลบ">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal เพิ่ม/แก้ไข */}
      {showAdd && (
        <div style={s.modalOverlay} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={s.modal}>
            <div style={s.modalTitle}>{editId ? "✏️ แก้ไขพนักงาน" : "➕ เพิ่มพนักงาน"}</div>

            <div style={s.fieldWrap}>
              <label style={s.label}>ชื่อ</label>
              <input style={s.input} value={formName} onChange={e => setFormName(e.target.value)} placeholder="ชื่อพนักงาน" />
            </div>

            <div style={s.fieldWrap}>
              <label style={s.label}>Role</label>
              <div style={s.roleRow}>
                {["owner","manager","staff"].map(r => (
                  <button
                    key={r}
                    style={{
                      ...s.roleBtn,
                      background: formRole === r ? ROLE_COLOR[r] + "22" : "#1e1e1e",
                      border: `1px solid ${formRole === r ? ROLE_COLOR[r] : "#333"}`,
                      color: formRole === r ? ROLE_COLOR[r] : "#888",
                    }}
                    onClick={() => setFormRole(r)}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.fieldWrap}>
              <label style={s.label}>{editId ? "PIN ใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" : "PIN 6 หลัก"}</label>
              <input
                style={s.input} type="password" inputMode="numeric"
                maxLength={6} value={formPin}
                onChange={e => setFormPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
              />
            </div>

            {(!editId || formPin) && (
              <div style={s.fieldWrap}>
                <label style={s.label}>ยืนยัน PIN</label>
                <input
                  style={s.input} type="password" inputMode="numeric"
                  maxLength={6} value={formPin2}
                  onChange={e => setFormPin2(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                />
              </div>
            )}

            {formError && <div style={s.errBox}>⚠️ {formError}</div>}

            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button style={s.cancelBtn} onClick={() => setShowAdd(false)}>ยกเลิก</button>
              <button
                style={{ ...s.saveBtn, opacity: formLoading ? 0.6 : 1 }}
                onClick={handleSave}
                disabled={formLoading}
              >
                {formLoading ? "⏳ กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { padding: "16px", maxWidth: "600px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" },
  title: { fontSize: "18px", fontWeight: 700, color: "#fff" },
  sub: { color: "#555", fontSize: "12px", marginTop: "2px" },
  addBtn: {
    background: "#FF9F0A", color: "#000", border: "none",
    borderRadius: "12px", padding: "10px 16px",
    fontFamily: "inherit", fontSize: "13px", fontWeight: 700, cursor: "pointer",
  },
  list: { display: "flex", flexDirection: "column", gap: "8px" },
  row: {
    background: "#1a1a1a", border: "1px solid #2a2a2a",
    borderRadius: "14px", padding: "14px 16px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  rowLeft: { display: "flex", flexDirection: "column", gap: "5px" },
  rowName: { fontSize: "14px", fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: "8px" },
  meBadge: {
    background: "#FF9F0A22", color: "#FF9F0A",
    border: "1px solid #FF9F0A44",
    borderRadius: "6px", padding: "1px 7px", fontSize: "10px", fontWeight: 700,
  },
  roleBadge: {
    display: "inline-block", fontSize: "11px", fontWeight: 700,
    border: "1px solid", borderRadius: "8px", padding: "2px 8px", width: "fit-content",
  },
  rowActions: { display: "flex", gap: "4px" },
  iconBtn: {
    background: "none", border: "1px solid #2a2a2a", borderRadius: "8px",
    padding: "7px 10px", cursor: "pointer", fontSize: "14px",
    color: "#888",
  },
  empty: { textAlign: "center", color: "#555", padding: "32px 0", fontSize: "13px" },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999, padding: "16px",
  },
  modal: {
    background: "#141414", border: "1px solid #2a2a2a",
    borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "380px",
    display: "flex", flexDirection: "column", gap: "16px",
  },
  modalTitle: { fontSize: "16px", fontWeight: 700, color: "#fff" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: "7px" },
  label: { color: "#888", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" },
  input: {
    background: "#1e1e1e", border: "1px solid #333", borderRadius: "10px",
    padding: "11px 13px", color: "#fff", fontSize: "15px",
    outline: "none", fontFamily: "inherit",
  },
  roleRow: { display: "flex", gap: "8px" },
  roleBtn: {
    flex: 1, borderRadius: "10px", padding: "9px 6px",
    fontFamily: "inherit", fontSize: "11px", fontWeight: 700, cursor: "pointer",
  },
  errBox: {
    background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.3)",
    borderRadius: "10px", padding: "10px 13px", color: "#FF453A", fontSize: "12px",
  },
  cancelBtn: {
    flex: 1, background: "#1e1e1e", border: "1px solid #333", borderRadius: "12px",
    padding: "13px", color: "#888", fontFamily: "inherit", fontSize: "14px", cursor: "pointer",
  },
  saveBtn: {
    flex: 2, background: "#FF9F0A", border: "none", borderRadius: "12px",
    padding: "13px", color: "#000", fontFamily: "inherit", fontSize: "14px",
    fontWeight: 700, cursor: "pointer",
  },
};
                  
