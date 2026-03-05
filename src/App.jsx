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
  
  // Modern UI states
  const [toast, setToast] = useState(null); // { message, type }
  const [confirm, setConfirm] = useState(null); // { title, message, onConfirm, onCancel, type }
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

  // โหลดข้อมูลทั้งหมดตอนเปิดแอป
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
      } catch (err) {
        console.error("โหลดข้อมูลไม่ได้:", err);
        showToast("❌ โหลดข้อมูลไม่ได้ กรุณา refresh", "error");
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
    showToast(`ลบหมวดหมู่ ${catName} แล้ว`);
  }, [showConfirm, showToast]);

  const addProduct = useCallback(async (newProductData) => {
    const cat = newProductData.category || "ทั่วไป";
    const saved = await db.addProduct({ ...newProductData, category: cat });
    setProducts(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name, 'th')));
    await addCategory(cat);
  }, [addCategory]);

  const updateProduct = useCallback(async (id, fields) => {
    await db.updateProduct(id, fields);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p));
  }, []);

  const deleteProduct = useCallback(async (id) => {
    const ok = await showConfirm("ลบสินค้า?", "ยืนยันการลบสินค้านี้ออกจากเมนู?");
    if (!ok) return;
    await db.deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
    showToast("ลบสินค้าเรียบร้อย");
  }, [showConfirm, showToast]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + (i.price * i.qty), 0), [cart]);
  const discountTotal = useMemo(() => computeDiscountTotal(subtotal, discounts), [subtotal, discounts]);
  const total = Math.max(0, Math.round(subtotal - discountTotal));

  const handleApplyManualDiscount = useCallback((disc) => setDiscounts(prev => [...prev, { ...disc, id: Date.now() + Math.random(), source: "manual", label: disc.mode === "percent" ? `${disc.value}%` : `฿${disc.value}` }]), []);
  const handleApplyRewardDiscount = useCallback((disc) => setDiscounts(prev => [...prev, { ...disc, id: Date.now() + Math.random() }]), []);
  const handleRemoveDiscount = useCallback((id) => setDiscounts(prev => prev.filter(d => d.id !== id)), []);
  const handleClearDiscounts = useCallback(() => setDiscounts([]), []);

  const addToCart = useCallback((product, channel = priceChannel) => {
    setCart(prev => {
      const modId = product.selectedModifier?.id || null;
      const idx = prev.findIndex(i => i.id === product.id && i.channel === channel && (i.selectedModifier?.id || null) === modId);
      if (idx > -1) { const n = [...prev]; n[idx].qty += 1; return n; }
      const base = Number(product[`${channel}Price`] ?? product.price) || 0;
      const modPrice = Number(product.selectedModifier?.price) || 0;
      return [...prev, { ...product, price: base + modPrice, qty: 1, channel, selectedModifier: product.selectedModifier || null }];
    });
  }, [priceChannel]);

  const decreaseQty = useCallback((id, channel, modId = null) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === id && i.channel === channel && (i.selectedModifier?.id || null) === (modId || null));
      if (idx === -1) return prev;
      const n = [...prev];
      if (n[idx].qty > 1) { n[idx].qty -= 1; return n; }
      return n.filter((_, i) => i !== idx);
    });
  }, []);

  const increaseQty = useCallback((id, channel, modId = null) => {
    setCart(prev => prev.map(i => (i.id === id && i.channel === channel && (i.selectedModifier?.id || null) === (modId || null)) ? { ...i, qty: i.qty + 1 } : i));
  }, []);

  const handleCheckout = async (paymentMethod, refId = "", phone = memberPhone) => {
    if (cart.length === 0) return;
    const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);
    try {
      const saved = await db.addOrder({
        time: new Date().toISOString(),
        items: [...cart],
        total,
        discount: discountTotal || undefined,
        payment: isDelivery ? "transfer" : paymentMethod,
        channel: priceChannel,
        refId,
        isSettled: !isDelivery,
        actualAmount: isDelivery ? 0 : total,
        member_phone: phone || null,
      });
      setOrders(prev => [saved, ...prev]);

      if (phone) {
        try {
          const { rate, tiers } = getPointSettings();
          const pts = calcPoints(total, rate, tiers);
          await sb.rpc("increment_member_points", { p_phone: phone, p_points: pts, p_spent: total });
          setHistoryTrigger(prev => prev + 1);
        } catch (e) { console.warn(e); }
      }

      setCart([]); setDiscounts([]); setMemberPhone("");
      showToast(isDelivery ? `บันทึกออเดอร์ ${priceChannel.toUpperCase()} เรียบร้อย` : "✨ ชำระเงินเรียบร้อยครับ");
    } catch (err) {
      showToast("❌ บันทึกออเดอร์ไม่ได้ กรุณาลองใหม่", "error");
    }
  };

  const handleUpdateActual = async (orderId, value) => {
    const amount = parseFloat(value) || 0;
    await db.updateOrder(orderId, { actualAmount: amount, isSettled: true });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, actualAmount: amount, isSettled: true } : o));
    showToast("อัปเดตยอดรับจริงแล้ว");
  };

  const handleCloseDay = async () => {
    if (orders.length === 0) return showToast("ไม่มีข้อมูลการขายสำหรับวันนี้", "error");
    const totalSales = orders.reduce((sum, o) => sum + (o.actualAmount || 0), 0);
    const ok = await showConfirm("ปิดยอดวัน?", `สรุปยอดขายวันนี้: ฿${totalSales.toLocaleString()}\nยืนยันการปิดยอดวัน?`, null, "primary");
    if (ok) {
      try {
        await db.closeDayOrders();
        setOrders([]);
        showToast("✅ ปิดยอดวันเรียบร้อย");
      } catch {
        showToast("❌ ปิดยอดไม่ได้ กรุณาลองใหม่", "error");
      }
    }
  };

  const commonProps = {
    cart, addToCart, increaseQty, decreaseQty, total, subtotal, discountTotal, discounts,
    memberPhone, setMemberPhone, priceChannel, setPriceChannel,
    onApplyManualDiscount: handleApplyManualDiscount,
    onApplyRewardDiscount: handleApplyRewardDiscount,
    onRemoveDiscount: handleRemoveDiscount,
    onClearDiscounts: handleClearDiscounts,
    onCheckout: handleCheckout, showToast, showConfirm, historyTrigger
  };

  const CHANNELS = [
    { key: "pos", label: "POS", color: "#4a4a4a" },
    { key: "grab", label: "Grab", color: "#00B14F" },
    { key: "lineman", label: "Lineman", color: "#00A84F" },
    { key: "shopee", label: "Shopee", color: "#EE4D2D" },
  ];

  if (loading) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a", color: "#fff" }}>🍖 KATKAT POS...</div>;

  return (
    <div style={{ height: "100vh", width: "100vw", backgroundColor: "#1a1a1a", color: "#fff", overflow: "hidden" }}>
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
            {view === "pos" && <MobilePOS {...commonProps} products={products} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} onClearCart={() => { setCart([]); setDiscounts([]); }} modifierGroups={modifierGroups} />}
            {view === "dashboard" && <Dashboard orders={orders} setOrders={setOrders} onCloseDay={handleCloseDay} onUpdateActual={handleUpdateActual} />}
            {view === "orders" && <Orders orders={orders} onDeleteOrder={async id => { const ok = await showConfirm("ลบออเดอร์?", "ต้องการลบบิลนี้ใช่หรือไม่?"); if (ok) { await db.deleteOrder(id); setOrders(prev => prev.filter(o => o.id !== id)); showToast("ลบออเดอร์แล้ว"); } }} onClearAll={async () => { const ok = await showConfirm("ลบทั้งหมด?", "ต้องการลบออเดอร์ทั้งหมดใช่หรือไม่?"); if (ok) { await db.clearOrders(); setOrders([]); showToast("ล้างข้อมูลแล้ว"); } }} />}
            {view === "menu" && <div style={{ padding: "10px" }}><MenuManager products={products} categories={categories} addProduct={addProduct} deleteProduct={deleteProduct} updateProduct={updateProduct} addCategory={addCategory} deleteCategory={deleteCategory} modifierGroups={modifierGroups} /><hr style={{ margin: "30px 0", borderColor: "#333" }} /><ModifierManager modifierGroups={modifierGroups} addModifierGroup={async n => { await db.addModifierGroup(n); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }} deleteModifierGroup={async id => { const ok = await showConfirm("ลบกลุ่มตัวเลือก?", "ต้องการลบใช่หรือไม่?"); if (ok) { await db.deleteModifierGroup(id); setModifierGroups(prev => prev.filter(g => g.id !== id)); showToast("ลบกลุ่มตัวเลือกแล้ว"); } }} addOptionToGroup={async (id, n, p) => { await db.addOptionToGroup(id, n, p); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }} deleteOption={async (gid, oid) => { await db.deleteOption(gid, oid); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }} /></div>}
            {view === "members" && <Members orders={orders} members={members} onMembersChange={setMembers} showToast={showToast} showConfirm={showConfirm} historyTrigger={historyTrigger} />}
          </main>
          <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "70px", background: "#1a1a1a", borderTop: "1px solid #333", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            {["pos", "dashboard", "members", "menu"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ background: "none", border: "none", color: view === v ? "#fff" : "#666", fontSize: 10 }}>{v.toUpperCase()}</button>
            ))}
          </nav>
        </div>
      ) : (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <header style={{ padding: "15px 25px", background: "#222", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>KATKAT POS</h2>
            <nav style={{ display: "flex", gap: 10 }}>
              {["pos", "dashboard", "members", "menu"].map(v => (
                <button key={v} onClick={() => setView(v)} style={{ padding: "8px 16px", borderRadius: 8, background: view === v ? "#fff" : "transparent", color: view === v ? "#000" : "#fff", border: "1px solid #444", fontWeight: "bold", cursor: "pointer" }}>{v.toUpperCase()}</button>
              ))}
            </nav>
          </header>
          <div style={{ padding: "10px 25px", background: "#111", borderBottom: "1px solid #333", display: "flex", gap: 10 }}>
            {CHANNELS.map(ch => (
              <button key={ch.key} onClick={() => setPriceChannel(ch.key)} style={{ padding: "6px 18px", borderRadius: 20, border: "none", background: priceChannel === ch.key ? ch.color : "#262626", color: "#fff", cursor: "pointer", fontSize: 12 }}>{ch.label}</button>
            ))}
          </div>
          <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {view === "pos" && (
              <>
                <section style={{ flex: 1, overflowY: "auto", padding: 15, borderRight: "1px solid #333" }}>
                  <Products products={products} addToCart={addToCart} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} priceChannel={priceChannel} modifierGroups={modifierGroups} />
                </section>
                <aside style={{ width: 400 }}>
                  <Cart {...commonProps} onClearCart={() => { setCart([]); setDiscounts([]); }} />
                </aside>
              </>
            )}
            {view === "dashboard" && <Dashboard orders={orders} setOrders={setOrders} onCloseDay={handleCloseDay} onUpdateActual={handleUpdateActual} />}
            {view === "members" && <Members orders={orders} members={members} onMembersChange={setMembers} showToast={showToast} showConfirm={showConfirm} historyTrigger={historyTrigger} />}
            {view === "menu" && <div style={{ flex: 1, overflowY: "auto", padding: 30 }}><MenuManager products={products} categories={categories} addProduct={addProduct} deleteProduct={deleteProduct} updateProduct={updateProduct} addCategory={addCategory} deleteCategory={deleteCategory} modifierGroups={modifierGroups} /><hr style={{ margin: "40px 0", borderColor: "#333" }} /><ModifierManager modifierGroups={modifierGroups} addModifierGroup={async n => { await db.addModifierGroup(n); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }} deleteModifierGroup={async id => { const ok = await showConfirm("ลบกลุ่มตัวเลือก?", "ต้องการลบใช่หรือไม่?"); if (ok) { await db.deleteModifierGroup(id); setModifierGroups(prev => prev.filter(g => g.id !== id)); showToast("ลบกลุ่มตัวเลือกแล้ว"); } }} addOptionToGroup={async (id, n, p) => { await db.addOptionToGroup(id, n, p); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }} deleteOption={async (gid, oid) => { await db.deleteOption(gid, oid); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }} /></div>}
          </main>
        </div>
      )}

      {/* Modern Dialogs */}
      {confirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20 }}>
          <div style={{ backgroundColor: "#1a1a1a", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "340px", border: "1px solid #333", textAlign: "center", animation: "modalIn 0.2s ease-out" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>{confirm.type === "danger" ? "⚠️" : "💡"}</div>
            <h3 style={{ margin: "0 0 10px", color: "#fff" }}>{confirm.title}</h3>
            <p style={{ margin: "0 0 24px", color: "#888", fontSize: "14px", lineHeight: "1.5" }}>{confirm.message}</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={confirm.onCancel} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid #333", backgroundColor: "transparent", color: "#888", fontWeight: "bold", cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={confirm.onConfirm} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", backgroundColor: confirm.type === "danger" ? "#ff4444" : "#4D96FF", color: "#fff", fontWeight: "bold", cursor: "pointer" }}>ตกลง</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", top: isMobile ? "20px" : "30px", left: "50%", transform: "translateX(-50%)", backgroundColor: toast.type === "error" ? "#ff4444" : "#222", color: "#fff", padding: "12px 24px", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.3)", zIndex: 9999, display: "flex", alignItems: "center", gap: 10, animation: "toastIn 0.3s ease-out forwards", fontWeight: "bold", border: toast.type === "error" ? "none" : "1px solid #444" }}>
          <span>{toast.type === "error" ? "❌" : "✅"}</span>
          {toast.message}
        </div>
      )}

      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default App;
