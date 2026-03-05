import React, { useState, useEffect, useMemo, useCallback } from "react";

import Products from "./components/Products";
import Cart from "./components/Cart";
import MenuManager from "./components/MenuManager";
import Dashboard from "./components/Dashboard";
import Orders from "./components/Orders";
import ModifierManager from "./components/ModifierManager";
import MobilePOS from "./components/MobilePOS";
import Members from "./components/Members";
import { computeDiscountTotal } from "./utils/discounts";
import { calcPoints, getPointSettings } from "./utils/points";
import { supabase as sb } from "./supabase";
import { Trash2, ShoppingCart, Clock, LayoutGrid } from "lucide-react";

// storage.js จะ auto-switch ระหว่าง Supabase และ localStorage
import db, { isUsingSupabase } from "./storage";

function App() {
  const [view, setView] = useState("pos");
  const [priceChannel, setPriceChannel] = useState("pos");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [modifierGroups, setModifierGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberPhone, setMemberPhone] = useState(""); 
  const [discounts, setDiscounts] = useState([]); 
  const [toast, setToast] = useState(null); 
  const [confirm, setConfirm] = useState(null); 
  const [historyTrigger, setHistoryTrigger] = useState(0); 
  
  // Pending Orders States
  const [orderType, setOrderType] = useState("dine_in");
  const [tableNo, setTableNo] = useState("");
  const [pendingOrders, setPendingOrders] = useState([]);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const showConfirm = useCallback((title, message, onConfirm, type = "danger") => {
    return new Promise((resolve) => {
      setConfirm({
        title, message, type,
        onConfirm: () => { setConfirm(null); onConfirm?.(); resolve(true); },
        onCancel: () => { setConfirm(null); resolve(false); }
      });
    });
  }, []);

  // โหลดข้อมูลทั้งหมดตอนเปิดแอป
  useEffect(() => {
    async function loadAll() {
      try {
        const [cats, prods, mods, ords, mems, pends] = await Promise.all([
          db.fetchCategories(),
          db.fetchProducts(),
          db.fetchModifierGroups(),
          db.fetchOrders(),
          db.fetchMembers(),
          isUsingSupabase ? sb.from("orders").select("*").eq("status", "pending").order("time", { ascending: false }).then(r => r.data || []) : []
        ]);

        const dbCats = new Set(cats.filter(c => c !== "All"));
        const prodCats = new Set(prods.map(p => p.category).filter(Boolean));
        const merged = ["All", ...[...new Set([...dbCats, ...prodCats])].sort((a, b) => a.localeCompare(b, 'th'))];

        for (const cat of prodCats) {
          if (!dbCats.has(cat)) {
            try { await db.addCategory(cat); } catch (e) { console.warn("auto-repair failed", e); }
          }
        }

        setCategories(merged);
        setProducts(prods.sort((a, b) => a.name.localeCompare(b.name, 'th')));
        setModifierGroups(mods);
        setOrders(ords);
        setMembers(mems);
        setPendingOrders(pends);
      } catch (err) {
        console.error(err);
        alert("❌ โหลดข้อมูลไม่ได้");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // CATEGORIES & PRODUCTS Logic (ใช้ db. methods)
  const addCategory = useCallback(async (name) => {
    if (!name || categories.includes(name)) return;
    await db.addCategory(name);
    setCategories(prev => ["All", ...[...new Set([...prev, name])].filter(c=>c!=="All").sort((a,b)=>a.localeCompare(b,'th'))]);
  }, [categories]);

  const deleteCategory = useCallback(async (catName) => {
    const ok = await showConfirm("ลบหมวดหมู่?", `ยืนยันการลบ "${catName}"?`);
    if (!ok) return;
    await db.deleteCategory(catName);
    setCategories(prev => prev.filter(c => c !== catName));
    showToast(`ลบ ${catName} แล้ว`);
  }, [showConfirm, showToast]);

  const addProduct = useCallback(async (data) => {
    const saved = await db.addProduct({ ...data, category: data.category || "ทั่วไป" });
    setProducts(prev => [...prev, saved].sort((a,b)=>a.name.localeCompare(b.name,'th')));
    await addCategory(data.category);
  }, [addCategory]);

  const updateProduct = useCallback(async (id, f) => { await db.updateProduct(id, f); setProducts(prev => prev.map(p => p.id === id ? { ...p, ...f } : p)); }, []);
  const deleteProduct = useCallback(async (id) => {
    const ok = await showConfirm("ลบสินค้า?", "ยืนยันการลบ?");
    if (!ok) return;
    await db.deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
    showToast("ลบสำเร็จ");
  }, [showConfirm, showToast]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + (i.price * i.qty), 0), [cart]);
  const discountTotal = useMemo(() => computeDiscountTotal(subtotal, discounts), [subtotal, discounts]);
  const total = Math.max(0, Math.round(subtotal - discountTotal));

  const handleApplyManualDiscount = useCallback((d) => setDiscounts(prev => [...prev, { ...d, id: Date.now(), source: "manual" }]), []);
  const handleApplyRewardDiscount = useCallback((d) => setDiscounts(prev => [...prev, { ...d, id: Date.now() }]), []);
  const handleRemoveDiscount = useCallback((id) => setDiscounts(prev => prev.filter(d => d.id !== id)), []);
  const handleClearDiscounts = useCallback(() => setDiscounts([]), []);

  const addToCart = useCallback((p, channel = priceChannel) => {
    setCart(prev => {
      const modId = p.selectedModifier?.id || null;
      const idx = prev.findIndex(i => i.id === p.id && i.channel === channel && (i.selectedModifier?.id || null) === modId);
      if (idx > -1) { const n = [...prev]; n[idx].qty += 1; return n; }
      const base = Number(p[`${channel}Price`] ?? p.price) || 0;
      const modPrice = Number(p.selectedModifier?.price) || 0;
      return [...prev, { ...p, price: base + modPrice, qty: 1, channel, selectedModifier: p.selectedModifier || null }];
    });
  }, [priceChannel]);

  const decreaseQty = (id, ch, mid) => setCart(prev => prev.map(i => (i.id === id && i.channel === ch && (i.selectedModifier?.id || null) === mid) ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0));
  const increaseQty = (id, ch, mid) => setCart(prev => prev.map(i => (i.id === id && i.channel === ch && (i.selectedModifier?.id || null) === mid) ? { ...i, qty: i.qty + 1 } : i));

  const handleCheckout = async (paymentMethod, refId = "", phone = memberPhone) => {
    if (cart.length === 0) return;
    try {
      const orderData = {
        time: new Date().toISOString(),
        items: [...cart],
        total,
        discount: discountTotal || 0,
        payment: paymentMethod,
        channel: priceChannel,
        refId,
        isSettled: true,
        actualAmount: total,
        member_phone: phone || null,
        status: "settled",
        order_type: orderType,
        table_no: orderType === "dine_in" ? tableNo : null
      };
      const saved = await db.addOrder(orderData);
      setOrders(prev => [saved, ...prev]);

      if (phone) {
        try {
          const { rate, tiers } = getPointSettings();
          const pts = calcPoints(total, rate, tiers);
          await sb.rpc("increment_member_points", { p_phone: phone, p_points: pts, p_spent: total });
          setHistoryTrigger(t => t + 1);
        } catch (e) { console.warn(e); }
      }

      setCart([]); setDiscounts([]); setMemberPhone(""); setTableNo("");
      showToast("✨ ชำระเงินเรียบร้อย");
    } catch (err) {
      showToast("❌ บันทึกไม่ได้", "error");
    }
  };

  const handleSavePending = async () => {
    if (cart.length === 0) return;
    if (orderType === "dine_in" && !tableNo) return showToast("กรุณาระบุเลขโต๊ะ", "error");
    try {
      const orderData = {
        time: new Date().toISOString(),
        items: [...cart],
        total,
        discount: discountTotal || 0,
        payment: "pending",
        channel: priceChannel,
        status: "pending",
        order_type: orderType,
        table_no: orderType === "dine_in" ? tableNo : null,
        member_phone: memberPhone || null
      };
      const { data, error } = await sb.from("orders").insert(orderData).select().single();
      if (error) throw error;
      setPendingOrders(prev => [data, ...prev]);
      setCart([]); setDiscounts([]); setMemberPhone(""); setTableNo("");
      showToast("⏸️ พักบิลเรียบร้อย");
    } catch (e) { showToast("❌ พักบิลไม่สำเร็จ", "error"); }
  };

  const handleResumeOrder = async (order) => {
    if (cart.length > 0) {
      const ok = await showConfirm("ทับรายการเดิม?", "มีสินค้าในตะกร้าอยู่ จะให้ทับด้วยบิลที่เลือกหรือไม่?");
      if (!ok) return;
    }
    setCart(order.items);
    setMemberPhone(order.member_phone || "");
    setOrderType(order.order_type || "dine_in");
    setTableNo(order.table_no || "");
    await sb.from("orders").delete().eq("id", order.id);
    setPendingOrders(prev => prev.filter(o => o.id !== order.id));
    setView("pos");
    showToast("ดึงออเดอร์กลับมาแล้ว");
  };

  const commonProps = {
    cart, subtotal, discountTotal, total, memberPhone, setMemberPhone, 
    priceChannel, setPriceChannel, discounts, orderType, setOrderType, tableNo, setTableNo,
    onApplyManualDiscount, onApplyRewardDiscount, onRemoveDiscount, onClearDiscounts,
    onCheckout: handleCheckout, onSavePending: handleSavePending, showToast, showConfirm
  };

  return (
    <div style={{ height: "100vh", width: "100vw", backgroundColor: "#000", color: "#fff", overflow: "hidden" }}>
      {loading ? (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 40 }}>🍖</div>
          <div>KATKAT POS</div>
        </div>
      ) : (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          {/* ── Pending Indicator (Mobile) ── */}
          {isMobile && pendingOrders.length > 0 && view === "pos" && (
            <button onClick={() => setView("pending")} style={{ background: "#f5c518", color: "#000", border: "none", padding: "6px", fontSize: 11, fontWeight: "bold" }}>
              ⚠️ มีบิลค้าง {pendingOrders.length} รายการ (แตะเพื่อดู)
            </button>
          )}

          <main style={{ flex: 1, overflowY: "auto", paddingBottom: isMobile ? "75px" : 0 }}>
            {view === "pos" && (
              isMobile ? (
                <MobilePOS {...commonProps} products={products} addToCart={addToCart} increaseQty={increaseQty} decreaseQty={decreaseQty} 
                  categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} 
                  onClearCart={() => { setCart([]); setDiscounts([]); }} />
              ) : (
                <div style={{ display: "flex", height: "100%" }}>
                  <section style={{ flex: 1, overflowY: "auto", padding: "15px", borderRight: "1px solid #222" }}>
                    {/* Desktop Table Map / Quick Actions */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
                       <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => setView("pending")} style={{ background: "#222", border: "1px solid #333", color: "#f5c518", padding: "8px 15px", borderRadius: 8, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            <Clock size={16} /> บิลค้าง ({pendingOrders.length})
                          </button>
                       </div>
                       <div style={{ display: "flex", gap: 8 }}>
                          {["pos", "grab", "lineman", "shopee"].map(ch => (
                            <button key={ch} onClick={() => setPriceChannel(ch)} style={{ padding: "6px 12px", borderRadius: 20, border: "none", background: priceChannel === ch ? "#fff" : "#222", color: priceChannel === ch ? "#000" : "#666", fontSize: 11, fontWeight: "bold", cursor: "pointer" }}>
                              {ch.toUpperCase()}
                            </button>
                          ))}
                       </div>
                    </div>
                    <Products products={products} addToCart={addToCart} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} priceChannel={priceChannel} />
                  </section>
                  <aside style={{ width: "400px" }}>
                    <Cart {...commonProps} addToCart={addToCart} increaseQty={increaseQty} decreaseQty={decreaseQty} onClearCart={() => { setCart([]); setDiscounts([]); }} />
                  </aside>
                </div>
              )
            )}

            {view === "pending" && (
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h2 style={{ margin: 0 }}>📋 รายการบิลค้าง</h2>
                  <button onClick={() => setView("pos")} style={{ background: "#fff", color: "#000", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: "bold" }}>กลับหน้าขาย</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 15 }}>
                  {pendingOrders.map(o => (
                    <div key={o.id} style={{ background: "#111", border: "1px solid #333", borderRadius: 12, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ color: "#f5c518", fontWeight: "bold" }}>{o.order_type === "dine_in" ? `🪑 โต๊ะ ${o.table_no || '?'}` : '🥡 กลับบ้าน'}</span>
                        <span style={{ fontSize: 12, color: "#555" }}>{new Date(o.time).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ fontSize: 14, color: "#ccc", marginBottom: 15, maxHeight: 80, overflow: "hidden" }}>
                        {o.items.map(i => `${i.name} x${i.qty}`).join(", ")}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "bold", fontSize: 18 }}>฿{o.total.toLocaleString()}</span>
                        <button onClick={() => handleResumeOrder(o)} style={{ background: "#4caf50", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: "bold", cursor: "pointer" }}>คิดเงิน / แก้ไข</button>
                      </div>
                    </div>
                  ))}
                  {pendingOrders.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 50, color: "#444" }}>ไม่มีบิลค้าง</div>}
                </div>
              </div>
            )}

            {view === "dashboard" && <Dashboard orders={orders} setOrders={setOrders} onCloseDay={async () => { await db.closeDayOrders(); setOrders([]); showToast("ปิดยอดวันแล้ว"); }} />}
            {view === "orders" && <Orders orders={orders} onDeleteOrder={async id => { await db.deleteOrder(id); setOrders(prev => prev.filter(o => o.id !== id)); }} onClearAll={async () => { await db.clearOrders(); setOrders([]); }} />}
            {view === "menu" && <div style={{ padding: 20 }}><MenuManager products={products} categories={categories} addProduct={addProduct} deleteProduct={deleteProduct} updateProduct={updateProduct} addCategory={addCategory} deleteCategory={deleteCategory} /><ModifierManager {...modifierGroups} /></div>}
            {view === "members" && <Members orders={orders} members={members} onMembersChange={setMembers} showToast={showToast} showConfirm={showConfirm} historyTrigger={historyTrigger} />}
          </main>

          {isMobile && (
            <nav style={styles.bottomNav}>
              <button onClick={() => setView("pos")} style={styles.navBtn(view === "pos")}><ShoppingCart size={20} /> ขาย</button>
              <button onClick={() => setView("pending")} style={styles.navBtn(view === "pending")}><Clock size={20} /> บิลค้าง</button>
              <button onClick={() => setView("dashboard")} style={styles.navBtn(view === "dashboard")}><LayoutGrid size={20} /> สรุป</button>
              <button onClick={() => setView("members")} style={styles.navBtn(view === "members")}><span>👥</span> สมาชิก</button>
              <button onClick={() => setView("menu")} style={styles.navBtn(view === "menu")}><span>🍴</span> เมนู</button>
            </nav>
          )}
        </div>
      )}

      {/* Modern Dialogs (Toast & Confirm) */}
      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: "#1a1a1a", padding: 25, borderRadius: 20, width: 320, border: "1px solid #333", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 10px" }}>{confirm.title}</h3>
            <p style={{ color: "#888", marginBottom: 20 }}>{confirm.message}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={confirm.onCancel} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #333", background: "none", color: "#666" }}>ยกเลิก</button>
              <button onClick={confirm.onConfirm} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: confirm.type === "danger" ? "#ff4444" : "#4caf50", color: "#fff", fontWeight: "bold" }}>ตกลง</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#222", padding: "12px 24px", borderRadius: 12, zIndex: 10000, border: "1px solid #444", display: "flex", alignItems: "center", gap: 10 }}>
          {toast.type === "error" ? "❌" : "✅"} {toast.message}
        </div>
      )}
    </div>
  );
}

const styles = {
  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: "70px", backgroundColor: "#000", display: "flex", justifyContent: "space-around", alignItems: "center", borderTop: "1px solid #111", zIndex: 1000 },
  navBtn: (isActive) => ({ background: "none", border: "none", color: isActive ? "#fff" : "#444", fontSize: "10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }),
  desktopHeader: { padding: "15px 25px", backgroundColor: "#000", borderBottom: "1px solid #111", display: "flex", alignItems: "center", justifyContent: "space-between" },
  desktopNavBtn: (isActive) => ({ padding: "8px 16px", borderRadius: 8, background: isActive ? "#fff" : "transparent", color: isActive ? "#000" : "#fff", border: "1px solid #222", fontWeight: "bold", cursor: "pointer" }),
};

export default App;
