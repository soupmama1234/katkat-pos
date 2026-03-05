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

  useEffect(() => {
    async function loadAll() {
      try {
        const [cats, prods, mods, ords, mems] = await Promise.all([
          db.fetchCategories(),
          db.fetchProducts(),
          db.fetchModifierGroups(),
          db.fetchOrders(),
          db.fetchMembers(),
        ]);
        setCategories(cats);
        setProducts(prods);
        setModifierGroups(mods);
        setOrders(ords);
        setMembers(mems);
      } catch (err) {
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

  const decreaseQty = (id, ch, mid = null) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === id && i.channel === ch && (i.selectedModifier?.id || null) === (mid || null));
      if (idx === -1) return prev;
      const n = [...prev];
      if (n[idx].qty > 1) { n[idx].qty -= 1; return n; }
      return n.filter((_, i) => i !== idx);
    });
  };

  const increaseQty = (id, ch, mid = null) => {
    setCart(prev => prev.map(i => (i.id === id && i.channel === ch && (i.selectedModifier?.id || null) === (mid || null)) ? { ...i, qty: i.qty + 1 } : i));
  };

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

      setCart([]); setDiscounts([]); setMemberPhone("");
      showToast("✨ ชำระเงินเรียบร้อย");
    } catch (err) {
      showToast("❌ บันทึกไม่ได้", "error");
    }
  };

  const menuManagerProps = {
    products, setProducts, updateProduct, deleteProduct, addProduct,
    categories, setCategories, addCategory, deleteCategory, modifierGroups,
    clearAllProducts: async () => {
      const ok = await showConfirm("ลบเมนูทั้งหมด?", "คุณแน่ใจหรือไม่?");
      if (!ok) return;
      await db.clearAllProducts();
      setProducts([]);
    },
  };

  const CHANNELS = [
    { key: "pos", label: "POS", color: "#4a4a4a" },
    { key: "grab", label: "Grab", color: "#00B14F" },
    { key: "lineman", label: "Lineman", color: "#00A84F" },
    { key: "shopee", label: "Shopee", color: "#EE4D2D" },
  ];

  if (loading) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>🍖 KATKAT POS...</div>;

  const commonProps = {
    cart, subtotal, discountTotal, total, memberPhone, setMemberPhone, 
    priceChannel, setPriceChannel, discounts,
    onApplyManualDiscount: handleApplyManualDiscount,
    onApplyRewardDiscount: handleApplyRewardDiscount,
    onRemoveDiscount: handleRemoveDiscount,
    onClearDiscounts: handleClearDiscounts,
    onCheckout: handleCheckout, showToast, showConfirm
  };

  return (
    <div style={{ height: "100vh", width: "100vw", backgroundColor: "#000", color: "#fff", overflow: "hidden" }}>
      {isMobile ? (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          {/* Mobile Channel Bar */}
          <div style={{ padding: "10px 15px", background: "#111", borderBottom: "1px solid #222", display: "flex", gap: 8, overflowX: "auto" }}>
            {CHANNELS.map(ch => (
              <button key={ch.key} onClick={() => setPriceChannel(ch.key)}
                style={{ padding: "6px 15px", borderRadius: 20, border: "none", background: priceChannel === ch.key ? ch.color : "#222", color: "#fff", fontSize: 11, fontWeight: "bold" }}>
                {ch.label}
              </button>
            ))}
          </div>
          <main style={{ flex: 1, overflowY: "auto", paddingBottom: "80px" }}>
            {view === "pos" && <MobilePOS {...commonProps} products={products} addToCart={addToCart} increaseQty={increaseQty} decreaseQty={decreaseQty} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} onClearCart={() => { setCart([]); setDiscounts([]); }} modifierGroups={modifierGroups} historyTrigger={historyTrigger} />}
            {view === "dashboard" && <Dashboard orders={orders} setOrders={setOrders} onCloseDay={async () => { await db.closeDayOrders(); setOrders([]); showToast("ปิดยอดแล้ว"); }} onUpdateActual={async (id, v) => { await db.updateOrder(id, { actual_amount: v, is_settled: true }); setHistoryTrigger(t=>t+1); }} />}
            {view === "members" && <Members orders={orders} members={members} onMembersChange={setMembers} showToast={showToast} showConfirm={showConfirm} historyTrigger={historyTrigger} />}
            {view === "menu" && <div style={{ padding: 20 }}><MenuManager {...menuManagerProps} /><hr style={{ margin: "20px 0", borderColor: "#222" }} /><ModifierManager modifierGroups={modifierGroups} addModifierGroup={async n => { const g = await db.addModifierGroup(n); setModifierGroups(prev => [...prev, g]); }} deleteModifierGroup={async id => { await db.deleteModifierGroup(id); setModifierGroups(prev => prev.filter(g => g.id !== id)); }} addOptionToGroup={async (id, n, p) => { const o = await db.addOptionToGroup(id, n, p); setModifierGroups(prev => prev.map(g => g.id === id ? { ...g, options: [...g.options, o] } : g)); }} deleteOption={async (gid, oid) => { await db.deleteOption(gid, oid); setModifierGroups(prev => prev.map(g => g.id === gid ? { ...g, options: g.options.filter(o => o.id !== oid) } : g)); }} /></div>}
          </main>
          <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "70px", background: "#000", borderTop: "1px solid #222", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            {["pos", "dashboard", "members", "menu"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ background: "none", border: "none", color: view === v ? "#fff" : "#444", fontSize: 10 }}>{v.toUpperCase()}</button>
            ))}
          </nav>
        </div>
      ) : (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <header style={{ padding: "15px 25px", background: "#111", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, color: "#f5c518" }}>KATKAT POS</h2>
            <nav style={{ display: "flex", gap: 10 }}>
              {["pos", "dashboard", "members", "menu"].map(v => (
                <button key={v} onClick={() => setView(v)} style={{ padding: "8px 16px", borderRadius: 8, background: view === v ? "#fff" : "transparent", color: view === v ? "#000" : "#fff", border: "none", fontWeight: "bold", cursor: "pointer" }}>{v.toUpperCase()}</button>
              ))}
            </nav>
          </header>
          <div style={{ padding: "10px 25px", background: "#0a0a0a", display: "flex", gap: 10 }}>
            {CHANNELS.map(ch => (
              <button key={ch.key} onClick={() => setPriceChannel(ch.key)} style={{ padding: "6px 15px", borderRadius: 20, border: "none", background: priceChannel === ch.key ? ch.color : "#222", color: "#fff", fontSize: 11, cursor: "pointer" }}>{ch.label}</button>
            ))}
          </div>
          <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {view === "pos" && (
              <>
                <section style={{ flex: 1, overflowY: "auto", padding: 15, borderRight: "1px solid #222" }}>
                  <Products products={products} addToCart={addToCart} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} priceChannel={priceChannel} modifierGroups={modifierGroups} />
                </section>
                <aside style={{ width: 400 }}>
                  <Cart {...commonProps} increaseQty={increaseQty} decreaseQty={decreaseQty} onClearCart={() => { setCart([]); setDiscounts([]); }} />
                </aside>
              </>
            )}
            {view === "dashboard" && <Dashboard orders={orders} setOrders={setOrders} onCloseDay={async () => { await db.closeDayOrders(); setOrders([]); showToast("ปิดยอดแล้ว"); }} />}
            {view === "members" && <Members orders={orders} members={members} onMembersChange={setMembers} showToast={showToast} showConfirm={showConfirm} historyTrigger={historyTrigger} />}
            {view === "menu" && <div style={{ flex: 1, overflowY: "auto", padding: 30 }}><MenuManager {...menuManagerProps} /><hr style={{ margin: "30px 0", borderColor: "#222" }} /><ModifierManager modifierGroups={modifierGroups} addModifierGroup={async n => { const g = await db.addModifierGroup(n); setModifierGroups(prev => [...prev, g]); }} deleteModifierGroup={async id => { await db.deleteModifierGroup(id); setModifierGroups(prev => prev.filter(g => g.id !== id)); }} addOptionToGroup={async (id, n, p) => { const o = await db.addOptionToGroup(id, n, p); setModifierGroups(prev => prev.map(g => g.id === id ? { ...g, options: [...g.options, o] } : g)); }} deleteOption={async (gid, oid) => { await db.deleteOption(gid, oid); setModifierGroups(prev => prev.map(g => g.id === gid ? { ...g, options: g.options.filter(o => o.id !== oid) } : g)); }} /></div>}
          </main>
        </div>
      )}

      {/* Modern Confirm/Toast Dialogs */}
      {confirm && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}><div style={{ background: "#1a1a1a", padding: 25, borderRadius: 20, width: 320, border: "1px solid #333", textAlign: "center" }}><h3>{confirm.title}</h3><p style={{ color: "#888", marginBottom: 20 }}>{confirm.message}</p><div style={{ display: "flex", gap: 10 }}><button onClick={confirm.onCancel} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #333", background: "none", color: "#666" }}>ยกเลิก</button><button onClick={confirm.onConfirm} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: confirm.type === "danger" ? "#ff4444" : "#4caf50", color: "#fff", fontWeight: "bold" }}>ตกลง</button></div></div></div>}
      {toast && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#222", padding: "12px 24px", borderRadius: 12, zIndex: 10000, border: "1px solid #444" }}>{toast.type === "error" ? "❌" : "✅"} {toast.message}</div>}
    </div>
  );
}

export default App;
