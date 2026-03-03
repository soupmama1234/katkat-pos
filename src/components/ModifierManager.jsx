import React, { useState } from "react";

// ย้ายออกมานอก component เพื่อป้องกัน re-render/focus bug
const ModifierGroupItem = ({ group, addOptionToGroup, deleteModifierGroup, deleteOption }) => {
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const handleAddOption = () => {
    if (!optName.trim()) return;
    addOptionToGroup(group.id, optName.trim(), Number(optPrice) || 0);
    setOptName("");
    setOptPrice("");
  };

  return (
    <div style={s.groupCard}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: collapsed ? 0 : 14 }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{ background: "none", border: "none", color: "#fff", fontSize: "15px", fontWeight: "bold", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8 }}
        >
          <span style={{ fontSize: "12px", color: "#666" }}>{collapsed ? "▶" : "▼"}</span>
          📦 {group.name}
          <span style={{ fontSize: "12px", color: "#555", fontWeight: "normal" }}>({group.options?.length || 0})</span>
        </button>
        <button onClick={() => deleteModifierGroup(group.id)} style={s.btnDel}>ลบกลุ่ม</button>
      </div>

      {!collapsed && (
        <>
          {/* Add option inputs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", marginBottom: "10px" }}>
            <input
              placeholder="ชื่อตัวเลือก เช่น หวานน้อย"
              value={optName}
              onChange={(e) => setOptName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddOption()}
              style={s.input}
            />
            <input
              placeholder="+฿"
              type="number"
              inputMode="numeric"
              value={optPrice}
              onChange={(e) => setOptPrice(e.target.value)}
              style={{ ...s.input, width: "70px", textAlign: "center" }}
            />
          </div>
          <button onClick={handleAddOption} style={s.btnAdd}>+ เพิ่มตัวเลือก</button>

          {/* Options list */}
          {group.options?.length > 0 && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {group.options.map((option) => (
                <div key={option.id} style={s.optionRow}>
                  <span style={{ color: "#eee", fontSize: "14px" }}>{option.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "auto" }}>
                    <span style={{ color: "#4caf50", fontWeight: "bold", fontSize: "13px" }}>
                      +{option.price}฿
                    </span>
                    <button
                      onClick={() => deleteOption(group.id, option.id)}
                      style={s.btnX}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {group.options?.length === 0 && (
            <div style={{ color: "#444", fontSize: "12px", marginTop: "10px", textAlign: "center", padding: "10px 0" }}>
              ยังไม่มีตัวเลือก
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default function ModifierManager({
  modifierGroups = [],
  addModifierGroup,
  deleteModifierGroup,
  addOptionToGroup,
  deleteOption,
  cleanupUnusedModifierGroups,
}) {
  const [newGroupName, setNewGroupName] = useState("");

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    addModifierGroup(newGroupName.trim());
    setNewGroupName("");
  };

  return (
    <div style={{ padding: "12px", color: "#fff", boxSizing: "border-box" }}>
      <h2 style={{ fontSize: "18px", margin: "0 0 16px 0", paddingBottom: "10px", borderBottom: "1px solid #333" }}>
        จัดการเมนูเสริม (Modifiers)
      </h2>

      {/* สร้างกลุ่มใหม่ */}
      <div style={s.addSection}>
        <div style={{ fontSize: "13px", color: "#888", marginBottom: "10px" }}>สร้างกลุ่มเมนูเสริมใหม่</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px" }}>
          <input
            placeholder="เช่น ระดับความหวาน, ท็อปปิ้ง..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
            style={s.input}
          />
          <button onClick={handleCreateGroup} style={s.btnPrimary}>สร้าง</button>
        </div>
        <button onClick={cleanupUnusedModifierGroups} style={s.btnCleanup}>
          🧹 ลบกลุ่มที่ไม่ได้ใช้
        </button>
      </div>

      {/* รายการกลุ่ม */}
      {modifierGroups.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: "#444", fontSize: "14px" }}>
          ยังไม่มีกลุ่มเมนูเสริม
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {modifierGroups.map((group) => (
            <ModifierGroupItem
              key={group.id}
              group={group}
              addOptionToGroup={addOptionToGroup}
              deleteModifierGroup={deleteModifierGroup}
              deleteOption={deleteOption}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  addSection: {
    backgroundColor: "#262626", padding: "14px", borderRadius: "12px",
    marginBottom: "16px", border: "1px solid #333",
  },
  groupCard: {
    backgroundColor: "#262626", padding: "14px",
    borderRadius: "12px", border: "1px solid #444",
  },
  input: {
    backgroundColor: "#1a1a1a", border: "1px solid #444", color: "#fff",
    padding: "11px 12px", borderRadius: "8px", outline: "none",
    width: "100%", fontSize: "14px", boxSizing: "border-box",
  },
  btnPrimary: {
    backgroundColor: "#fff", color: "#000", border: "none",
    padding: "11px 16px", borderRadius: "8px", fontWeight: "bold",
    cursor: "pointer", fontSize: "14px", whiteSpace: "nowrap",
  },
  btnAdd: {
    width: "100%", backgroundColor: "#2a2a2a", color: "#aaa",
    border: "1px dashed #555", padding: "10px", borderRadius: "8px",
    cursor: "pointer", fontSize: "13px",
  },
  btnCleanup: {
    marginTop: "10px", width: "100%", backgroundColor: "#1f2937", color: "#cbd5e1",
    border: "1px solid #334155", padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px",
  },
  btnDel: {
    background: "none", border: "none", color: "#ff5252",
    cursor: "pointer", fontSize: "12px", textDecoration: "underline",
    whiteSpace: "nowrap",
  },
  optionRow: {
    display: "flex", alignItems: "center", padding: "8px 10px",
    backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #2a2a2a",
  },
  btnX: {
    background: "none", border: "none", color: "#ff5252",
    cursor: "pointer", fontSize: "16px", padding: "0 4px", lineHeight: 1,
  },
};
