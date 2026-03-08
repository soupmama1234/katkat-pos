// src/components/CustomerOrder.jsx
import React, { useState, useEffect, useRef } from "react";
import { supabase as sb } from "../supabase";

const BRAND = "#FF9F0A";
const BRAND_DARK = "#cc7a00";

// ── Supabase helpers ──────────────────────────────────────────
async function fetchProducts() {
  const { data } = await sb.from("products").select("*").order("created_at");
  return data || [];
}
async function fetchCategories() {
  const { data } = await sb.from("categories").select("name").order("sort_order");
  return (data || []).map(r => r.name);
}
async function fetchModifierGroups() {
  const [{ data: groups }, { data: options }] = await Promise.all([
    sb.from("modifier_groups").select("*"),
    sb.from("modifier_options").select("*"),
  ]);
  return (groups || []).map(g => ({
    ...g,
    options: (options || []).filter(o => o.group_id === g.id),
  }));
}
async function fetchMemberByPhone(phone) {
  const { data } = await sb.from("members").select("*").eq("phone", phone).single();
  return data || null;
}
async function registerMember(phone, nickname) {
  const { data } = await sb.from("members").insert({ phone, nickname, points: 0 }).select().single();
  return data;
}
async function submitOrder({ tableNumber, memberPhone, items, note }) {
  const total = items.reduce((s, i) => s + (i.price + (i.modifier?.price || 0)) * i.qty, 0);
  const { data, error } = await sb.from("orders").insert({
    channel: "pos",
    payment: "pending",
    ref_id: "",
    total,
    actual_amount: 0,
    is_settled: false,
    is_history: false,
    member_phone: memberPhone || null,
    order_type: "dine_in",
    table_number: tableNumber,
    status: "pending_customer",
    note: note || null,
  }).select().single();
  if (error) throw error;

  const rows = items.map(i => ({
    order_id: data.id,
    name: i.name,
    qty: i.qty,
    price: i.price,
    channel: "pos",
    category: i.category || null,
    modifier_name: i.modifier?.name || null,
    modifier_price: i.modifier?.price || null,
  }));
  if (rows.length > 0) await sb.from("order_items").insert(rows);
  return data;
}

// ── STEP components ───────────────────────────────────────────

function StepTable({ onNext }) {
  const [table, setTable] = useState("");
  return (
    <div style={s.stepWrap}>
      <div style={s.brandMark}>
        <div style={s.brandName}>KATKAT</div>
        <div style={s.brandSub}>คัตสึ • Katsu</div>
      </div>
      <div style={s.stepCard}>
        <div style={s.stepTitle}>🪑 โต๊ะของคุณ</div>
        <div style={s.stepDesc}>กรอกหมายเลขโต๊ะหรือชื่อเพื่อเริ่มสั่งอาหาร</div>
        <input
          style={s.bigInput}
          placeholder="เช่น A1, B2, ชื่อ..."
          value={table}
          onChange={e => setTable(e.target.value)}
          autoFocus
        />
        <button
          style={{ ...s.primaryBtn, opacity: table.trim() ? 1 : 0.4 }}
          onClick={() => table.trim() && onNext(table.trim())}
          disabled={!table.trim()}
        >
          ถัดไป →
        </button>
      </div>
    </div>
  );
}

function StepMember({ onNext, onSkip }) {
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("idle"); // idle | loading | found | notfound | registering | regdone
  const [member, setMember] = useState(null);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");

  const handleCheck = async () => {
    if (!/^0\d{8,9}$/.test(phone)) { setError("กรอกเบอร์มือถือให้ถูกต้อง"); return; }
    setError(""); setState("loading");
    const m = await fetchMemberByPhone(phone);
    if (m) { setMember(m); setState("found"); }
    else setState("notfound");
  };

  const handleRegister = async () => {
    if (!nickname.trim()) { setError("กรุณากรอกชื่อ"); return; }
    setState("registering");
    const m = await registerMember(phone, nickname.trim());
    setMember(m); setState("regdone");
  };

  if (state === "found" || state === "regdone") return (
    <div style={s.stepWrap}>
      <div style={s.brandMark}>
        <div style={s.brandName}>KATKAT</div>
      </div>
      <div style={s.stepCard}>
        <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>🎉</div>
        <div style={s.stepTitle}>
          {state === "regdone" ? "สมัครสำเร็จ!" : "ยินดีต้อนรับ!"}
        </div>
        <div style={{ ...s.memberBadge }}>
          <div style={s.memberName}>{member?.nickname}</div>
          <div style={s.memberPts}>⭐ {member?.points || 0} แต้ม</div>
        </div>
        <button style={s.primaryBtn} onClick={() => onNext(phone)}>
          เริ่มสั่งอาหาร 🍽️
        </button>
      </div>
    </div>
  );

  return (
    <div style={s.stepWrap}>
      <div style={s.brandMark}>
        <div style={s.brandName}>KATKAT</div>
      </div>
      <div style={s.stepCard}>
        <div style={s.stepTitle}>👤 สมาชิก</div>
        <div style={s.stepDesc}>กรอกเบอร์มือถือเพื่อสะสมแต้ม (ข้ามได้)</div>

        {state !== "notfound" ? (
          <>
            <input
              style={s.bigInput}
              placeholder="0812345678"
              value={phone}
              onChange={e => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
              inputMode="numeric"
            />
            {error && <div style={s.errTxt}>{error}</div>}
            <button
              style={{ ...s.primaryBtn, opacity: phone.length >= 9 && state !== "loading" ? 1 : 0.4 }}
              onClick={handleCheck}
              disabled={phone.length < 9 || state === "loading"}
            >
              {state === "loading" ? "⏳ กำลังตรวจสอบ..." : "ตรวจสอบ"}
            </button>
          </>
        ) : (
          <>
            <div style={s.notFoundBox}>ไม่พบเบอร์นี้ในระบบ — สมัครสมาชิกได้เลย!</div>
            <input
              style={s.bigInput}
              placeholder="ชื่อเล่น"
              value={nickname}
              onChange={e => { setNickname(e.target.value); setError(""); }}
              autoFocus
            />
            {error && <div style={s.errTxt}>{error}</div>}
            <button
              style={{ ...s.primaryBtn, opacity: nickname.trim() && state !== "registering" ? 1 : 0.4 }}
              onClick={handleRegister}
              disabled={!nickname.trim() || state === "registering"}
            >
              {state === "registering" ? "⏳ กำลังสมัคร..." : "สมัครสมาชิก ✨"}
            </button>
          </>
        )}

        <button style={s.skipBtn} onClick={onSkip}>ข้าม ไม่สะสมแต้ม</button>
      </div>
    </div>
  );
}

function MenuScreen({ tableNumber, memberPhone, onDone }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modGroups, setModGroups] = useState([]);
  const [selCat, setSelCat] = useState("All");
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [modModal, setModModal] = useState(null); // {product}
  const [selectedMod, setSelectedMod] = useState(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const catRef = useRef(null);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchCategories(), fetchModifierGroups()]).then(([p, c, m]) => {
      setProducts(p); setCategories(["All", ...c]); setModGroups(m); setLoading(false);
    });
  }, []);

  const filtered = selCat === "All" ? products : products.filter(p => p.category === selCat);

  const addToCart = (product, modifier = null) => {
    setCart(prev => {
      const key = `${product.id}-${modifier?.id || "none"}`;
      const existing = prev.find(i => i.key === key);
      if (existing) return prev.map(i => i.key === key ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, {
        key, id: product.id, name: product.name,
        price: product.price, category: product.category,
        modifier: modifier ? { name: modifier.name, price: modifier.price } : null,
        qty: 1,
      }];
    });
  };

  const handleAddProduct = (product) => {
    const groups = modGroups.filter(g => (product.modifier_group_ids || []).includes(g.id));
    if (groups.length > 0) {
      setSelectedMod(null);
      setModModal({ product, groups });
    } else {
      addToCart(product);
    }
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + (i.price + (i.modifier?.price || 0)) * i.qty, 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitOrder({ tableNumber, memberPhone, items: cart, note });
      setDone(true);
    } catch (e) {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return (
    <div style={{ ...s.stepWrap, justifyContent: "center" }}>
      <div style={s.doneCard}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>สั่งอาหารสำเร็จ!</div>
        <div style={{ color: "#888", fontSize: 14, marginBottom: 4 }}>โต๊ะ {tableNumber}</div>
        <div style={{ color: BRAND, fontSize: 20, fontWeight: 700, marginBottom: 24 }}>฿{cartTotal.toLocaleString()}</div>
        <div style={{ color: "#666", fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>
          พนักงานได้รับออเดอร์แล้ว<br />กรุณารอสักครู่ 🙏
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
      <div style={{ color: BRAND, fontSize: 16 }}>⏳ กำลังโหลดเมนู...</div>
    </div>
  );

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", paddingBottom: 100 }}>
      {/* Header */}
      <div style={s.menuHeader}>
        <div>
          <div style={s.brandName}>KATKAT</div>
          <div style={{ color: "#666", fontSize: 11 }}>โต๊ะ {tableNumber}</div>
        </div>
        <button style={s.cartBtn} onClick={() => setShowCart(true)}>
          🛒
          {cartCount > 0 && <span style={s.cartBadge}>{cartCount}</span>}
        </button>
      </div>

      {/* Category tabs */}
      <div style={s.catBar} ref={catRef}>
        {categories.map(c => (
          <button
            key={c}
            style={{ ...s.catTab, ...(selCat === c ? s.catTabActive : {}) }}
            onClick={() => setSelCat(c)}
          >
            {c === "All" ? "ทั้งหมด" : c}
          </button>
        ))}
      </div>

      {/* Products grid */}
      <div style={s.grid}>
        {filtered.map(p => (
          <div key={p.id} style={s.productCard} onClick={() => handleAddProduct(p)}>
            <div style={s.productImg}>
              {p.image_url
                ? <img src={p.image_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={s.productImgPlaceholder}>🍱</div>
              }
            </div>
            <div style={s.productInfo}>
              <div style={s.productName}>{p.name}</div>
              <div style={s.productCat}>{p.category}</div>
              <div style={s.productPrice}>฿{p.price}</div>
            </div>
            <div style={s.addBtn}>+</div>
          </div>
        ))}
      </div>

      {/* Bottom cart bar */}
      {cartCount > 0 && (
        <div style={s.bottomBar} onClick={() => setShowCart(true)}>
          <div style={s.bottomBarLeft}>
            <span style={s.bottomBarCount}>{cartCount}</span>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>ดูรายการ</span>
          </div>
          <span style={{ color: BRAND, fontWeight: 800, fontSize: 16 }}>฿{cartTotal.toLocaleString()}</span>
        </div>
      )}

      {/* Modifier Modal */}
      {modModal && (
        <div style={s.modalOverlay} onClick={() => setModModal(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>{modModal.product.name}</div>
            <div style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>เลือกตัวเลือก</div>
            {modModal.groups.map(g => (
              <div key={g.id}>
                <div style={s.modGroupLabel}>{g.name}</div>
                {g.options.map(opt => (
                  <div
                    key={opt.id}
                    style={{ ...s.modOption, ...(selectedMod?.id === opt.id ? s.modOptionActive : {}) }}
                    onClick={() => setSelectedMod(opt)}
                  >
                    <span>{opt.name}</span>
                    {opt.price > 0 && <span style={{ color: BRAND }}>+฿{opt.price}</span>}
                  </div>
                ))}
              </div>
            ))}
            <button
              style={{ ...s.primaryBtn, marginTop: 16 }}
              onClick={() => { addToCart(modModal.product, selectedMod); setModModal(null); setSelectedMod(null); }}
            >
              เพิ่มลงตะกร้า
            </button>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div style={s.modalOverlay} onClick={() => setShowCart(false)}>
          <div style={{ ...s.modalBox, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>🛒 รายการสั่ง</div>
            {cart.length === 0
              ? <div style={{ color: "#555", textAlign: "center", padding: "24px 0" }}>ยังไม่มีรายการ</div>
              : cart.map(item => (
                <div key={item.key} style={s.cartRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                    {item.modifier && <div style={{ color: "#888", fontSize: 12 }}>{item.modifier.name}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={s.qtyRow}>
                      <button style={s.qtyBtn} onClick={() => setCart(prev => prev.map(i => i.key === item.key ? { ...i, qty: Math.max(0, i.qty - 1) } : i).filter(i => i.qty > 0))}>−</button>
                      <span style={{ color: "#fff", minWidth: 20, textAlign: "center" }}>{item.qty}</span>
                      <button style={s.qtyBtn} onClick={() => setCart(prev => prev.map(i => i.key === item.key ? { ...i, qty: i.qty + 1 } : i))}>+</button>
                    </div>
                    <span style={{ color: BRAND, fontWeight: 700, minWidth: 55, textAlign: "right" }}>
                      ฿{((item.price + (item.modifier?.price || 0)) * item.qty).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            }

            {cart.length > 0 && (
              <>
                <textarea
                  style={s.noteInput}
                  placeholder="หมายเหตุ เช่น ไม่เผ็ด, แพ้ถั่ว..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                />
                <div style={{ display: "flex", justifyContent: "space-between", margin: "12px 0", color: "#fff" }}>
                  <span style={{ fontWeight: 700 }}>รวม</span>
                  <span style={{ color: BRAND, fontWeight: 800, fontSize: 18 }}>฿{cartTotal.toLocaleString()}</span>
                </div>
                <button
                  style={{ ...s.primaryBtn, opacity: submitting ? 0.5 : 1 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "⏳ กำลังส่งออเดอร์..." : "✅ ยืนยันการสั่ง"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function CustomerOrder() {
  const [step, setStep] = useState("table"); // table | member | menu
  const [tableNumber, setTableNumber] = useState("");
  const [memberPhone, setMemberPhone] = useState(null);

  if (step === "table") return (
    <StepTable onNext={t => { setTableNumber(t); setStep("member"); }} />
  );
  if (step === "member") return (
    <StepMember
      onNext={phone => { setMemberPhone(phone); setStep("menu"); }}
      onSkip={() => { setMemberPhone(null); setStep("menu"); }}
    />
  );
  return <MenuScreen tableNumber={tableNumber} memberPhone={memberPhone} />;
}

// ── Styles ────────────────────────────────────────────────────
const s = {
  stepWrap: {
    minHeight: "100vh", background: "#0a0a0a",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "flex-start",
    padding: "48px 20px 32px",
    fontFamily: "'Noto Sans Thai', sans-serif",
  },
  brandMark: { textAlign: "center", marginBottom: 32 },
  brandName: { fontSize: 28, fontWeight: 900, color: BRAND, letterSpacing: 4 },
  brandSub: { color: "#444", fontSize: 12, letterSpacing: 2, marginTop: 2 },
  stepCard: {
    background: "#141414", border: "1px solid #222",
    borderRadius: 24, padding: "28px 24px",
    width: "100%", maxWidth: 380,
    display: "flex", flexDirection: "column", gap: 14,
  },
  stepTitle: { fontSize: 20, fontWeight: 800, color: "#fff", textAlign: "center" },
  stepDesc: { color: "#666", fontSize: 13, textAlign: "center", lineHeight: 1.6 },
  bigInput: {
    background: "#1e1e1e", border: "1px solid #333",
    borderRadius: 14, padding: "14px 16px",
    color: "#fff", fontSize: 18, fontFamily: "inherit",
    outline: "none", textAlign: "center",
    letterSpacing: 2,
  },
  primaryBtn: {
    background: BRAND, color: "#000", border: "none",
    borderRadius: 14, padding: "15px",
    fontSize: 15, fontWeight: 800, cursor: "pointer",
    fontFamily: "inherit", transition: "opacity 0.2s",
  },
  skipBtn: {
    background: "none", border: "none",
    color: "#555", fontSize: 13, cursor: "pointer",
    fontFamily: "inherit", textDecoration: "underline",
    textAlign: "center",
  },
  memberBadge: {
    background: "#1e1e1e", border: `1px solid ${BRAND}33`,
    borderRadius: 14, padding: "16px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  memberName: { color: "#fff", fontWeight: 700, fontSize: 16 },
  memberPts: { color: BRAND, fontWeight: 700, fontSize: 14 },
  notFoundBox: {
    background: "#1e1e1e", border: "1px solid #333",
    borderRadius: 12, padding: "12px 16px",
    color: "#888", fontSize: 13, textAlign: "center",
  },
  errTxt: { color: "#FF453A", fontSize: 12, textAlign: "center" },
  // menu
  menuHeader: {
    position: "sticky", top: 0, zIndex: 100,
    background: "#0a0a0a", borderBottom: "1px solid #1a1a1a",
    padding: "14px 16px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  cartBtn: {
    background: "#1a1a1a", border: "1px solid #2a2a2a",
    borderRadius: 12, width: 44, height: 44,
    fontSize: 20, cursor: "pointer", position: "relative",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  cartBadge: {
    position: "absolute", top: -6, right: -6,
    background: BRAND, color: "#000",
    borderRadius: 99, width: 18, height: 18,
    fontSize: 10, fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  catBar: {
    display: "flex", gap: 8, padding: "12px 16px",
    overflowX: "auto", scrollbarWidth: "none",
  },
  catTab: {
    background: "#1a1a1a", border: "1px solid #2a2a2a",
    borderRadius: 99, padding: "7px 16px",
    color: "#888", fontSize: 13, fontWeight: 600,
    cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
    flexShrink: 0,
  },
  catTabActive: {
    background: BRAND, border: `1px solid ${BRAND}`,
    color: "#000",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12, padding: "0 12px",
  },
  productCard: {
    background: "#141414", border: "1px solid #1e1e1e",
    borderRadius: 18, overflow: "hidden",
    cursor: "pointer", position: "relative",
    transition: "transform 0.1s",
    WebkitTapHighlightColor: "transparent",
  },
  productImg: {
    width: "100%", aspectRatio: "4/3",
    background: "#1a1a1a", overflow: "hidden",
  },
  productImgPlaceholder: {
    width: "100%", height: "100%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 36,
  },
  productInfo: { padding: "10px 12px 40px" },
  productName: { color: "#fff", fontWeight: 700, fontSize: 13, lineHeight: 1.3, marginBottom: 2 },
  productCat: { color: "#555", fontSize: 10, marginBottom: 6 },
  productPrice: { color: BRAND, fontWeight: 800, fontSize: 16 },
  addBtn: {
    position: "absolute", bottom: 10, right: 10,
    background: BRAND, color: "#000",
    borderRadius: 99, width: 28, height: 28,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, fontWeight: 800,
  },
  bottomBar: {
    position: "fixed", bottom: 16, left: 16, right: 16,
    background: "#1a1a1a", border: `1px solid ${BRAND}44`,
    borderRadius: 16, padding: "14px 20px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    cursor: "pointer", zIndex: 200,
    boxShadow: `0 8px 32px ${BRAND}22`,
  },
  bottomBarLeft: { display: "flex", alignItems: "center", gap: 10 },
  bottomBarCount: {
    background: BRAND, color: "#000",
    borderRadius: 99, width: 24, height: 24,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 800,
  },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    zIndex: 999, padding: "0 0 0 0",
  },
  modalBox: {
    background: "#141414", border: "1px solid #2a2a2a",
    borderRadius: "24px 24px 0 0",
    padding: "24px 20px 40px",
    width: "100%", maxWidth: 480,
  },
  modalTitle: { fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 16 },
  modGroupLabel: { color: "#888", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  modOption: {
    background: "#1e1e1e", border: "1px solid #2a2a2a",
    borderRadius: 12, padding: "12px 16px", marginBottom: 8,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    color: "#fff", fontSize: 14, cursor: "pointer",
  },
  modOptionActive: {
    border: `1px solid ${BRAND}`,
    background: `${BRAND}11`,
  },
  cartRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 0", borderBottom: "1px solid #1e1e1e",
  },
  qtyRow: { display: "flex", alignItems: "center", gap: 8 },
  qtyBtn: {
    background: "#2a2a2a", border: "none", borderRadius: 8,
    width: 28, height: 28, color: "#fff", fontSize: 16,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  noteInput: {
    width: "100%", background: "#1e1e1e",
    border: "1px solid #333", borderRadius: 12,
    padding: "12px 14px", color: "#888",
    fontSize: 13, fontFamily: "inherit",
    resize: "none", outline: "none",
    boxSizing: "border-box", marginTop: 8,
  },
  doneCard: {
    background: "#141414", border: "1px solid #222",
    borderRadius: 24, padding: "40px 32px",
    display: "flex", flexDirection: "column",
    alignItems: "center", maxWidth: 360, width: "100%",
  },
};
