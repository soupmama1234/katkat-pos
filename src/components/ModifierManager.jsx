import React, { useState } from "react";

/* ===============================
   Modifier Group Item
================================ */
const ModifierGroupItem = ({
  group,
  addOptionToGroup,
  deleteModifierGroup,
  deleteOption,
}) => {
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const handleAddOption = () => {
    const name = optName.trim();
    const price = Math.max(0, Number(optPrice) || 0);

    if (!name) return;

    // กันชื่อซ้ำ
    const exists = group.options?.some(
      (o) => o.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      alert("มีตัวเลือกนี้แล้ว");
      return;
    }

    addOptionToGroup(group.id, name, price);

    setOptName("");
    setOptPrice("");
  };

  return (
    <div style={s.groupCard}>
      {/* Header */}
      <div style={s.groupHeader}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={s.groupToggleBtn}
        >
          <span style={s.arrow}>{collapsed ? "▶" : "▼"}</span>
          📦 {group.name}
          <span style={s.count}>
            ({group.options?.length || 0})
          </span>
        </button>

        <button
          onClick={() => deleteModifierGroup(group.id)}
          style={s.btnDeleteGroup}
        >
          ลบกลุ่ม
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Add Option */}
          <div style={s.addOptionRow}>
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
              min="0"
              value={optPrice}
              onChange={(e) => setOptPrice(e.target.value)}
              style={s.priceInput}
            />
          </div>

          <button onClick={handleAddOption} style={s.btnAddOption}>
            + เพิ่มตัวเลือก
          </button>

          {/* Option List */}
          {group.options?.length > 0 ? (
            <div style={s.optionList}>
              {group.options.map((option) => (
                <div key={option.id} style={s.optionRow}>
                  <span style={s.optionName}>
                    {option.name}
                  </span>

                  <div style={s.optionRight}>
                    <span style={s.optionPrice}>
                      +{Number(option.price).toLocaleString()} ฿
                    </span>

                    <button
                      onClick={() =>
                        deleteOption(group.id, option.id)
                      }
                      style={s.btnDeleteOption}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={s.emptyText}>
              ยังไม่มีตัวเลือก
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ===============================
   Main Component
================================ */
export default function ModifierManager({
  modifierGroups = [],
  addModifierGroup,
  deleteModifierGroup,
  addOptionToGroup,
  deleteOption,
}) {
  const [newGroupName, setNewGroupName] = useState("");

  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;

    const exists = modifierGroups.some(
      (g) => g.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      alert("มีกลุ่มนี้แล้ว");
      return;
    }

    addModifierGroup(name);
    setNewGroupName("");
  };

  return (
    <div style={s.container}>
      <h2 style={s.title}>
        จัดการเมนูเสริม (Modifiers)
      </h2>

      {/* Create Group */}
      <div style={s.addSection}>
        <div style={s.label}>
          สร้างกลุ่มเมนูเสริมใหม่
        </div>

        <div style={s.createRow}>
          <input
            placeholder="เช่น ระดับความหวาน, ท็อปปิ้ง..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
            style={s.input}
          />

          <button
            onClick={handleCreateGroup}
            style={s.btnPrimary}
          >
            สร้าง
          </button>
        </div>
      </div>

      {/* Group List */}
      {modifierGroups.length === 0 ? (
        <div style={s.emptyMain}>
          ยังไม่มีกลุ่มเมนูเสริม
        </div>
      ) : (
        <div style={s.groupList}>
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

/* ===============================
   Styles
================================ */
const s = {
  container: {
    padding: "14px",
    color: "#fff",
    boxSizing: "border-box",
  },

  title: {
    fontSize: "18px",
    marginBottom: "18px",
    paddingBottom: "10px",
    borderBottom: "1px solid #333",
  },

  addSection: {
    backgroundColor: "#262626",
    padding: "14px",
    borderRadius: "12px",
    marginBottom: "16px",
    border: "1px solid #333",
  },

  label: {
    fontSize: "13px",
    color: "#888",
    marginBottom: "10px",
  },

  createRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "8px",
  },

  groupList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  groupCard: {
    backgroundColor: "#262626",
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #444",
  },

  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },

  groupToggleBtn: {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 0,
  },

  arrow: {
    fontSize: "12px",
    color: "#666",
  },

  count: {
    fontSize: "12px",
    color: "#555",
    fontWeight: "normal",
  },

  input: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    color: "#fff",
    padding: "11px 12px",
    borderRadius: "8px",
    outline: "none",
    fontSize: "14px",
  },

  priceInput: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    color: "#fff",
    padding: "11px 12px",
    borderRadius: "8px",
    textAlign: "center",
    width: "80px",
  },

  btnPrimary: {
    backgroundColor: "#fff",
    color: "#000",
    border: "none",
    padding: "11px 16px",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  btnAddOption: {
    width: "100%",
    marginTop: "8px",
    backgroundColor: "#2a2a2a",
    color: "#aaa",
    border: "1px dashed #555",
    padding: "10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
  },

  optionList: {
    marginTop: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  optionRow: {
    display: "flex",
    alignItems: "center",
    padding: "8px 10px",
    backgroundColor: "#1a1a1a",
    borderRadius: "8px",
    border: "1px solid #2a2a2a",
  },

  optionName: {
    fontSize: "14px",
    color: "#eee",
  },

  optionRight: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  optionPrice: {
    color: "#4caf50",
    fontWeight: "bold",
    fontSize: "13px",
  },

  btnDeleteGroup: {
    background: "none",
    border: "none",
    color: "#ff5252",
    cursor: "pointer",
    fontSize: "12px",
    textDecoration: "underline",
  },

  btnDeleteOption: {
    background: "none",
    border: "none",
    color: "#ff5252",
    cursor: "pointer",
    fontSize: "16px",
  },

  emptyText: {
    color: "#444",
    fontSize: "12px",
    marginTop: "10px",
    textAlign: "center",
    padding: "10px 0",
  },

  emptyMain: {
    textAlign: "center",
    padding: "30px 0",
    color: "#444",
    fontSize: "14px",
  },
};