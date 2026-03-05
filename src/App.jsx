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
import { ShoppingCart, LayoutGrid, Clock, Users, UtensilsCrossed } from "lucide-react";

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
        showToast("❌ โหลดข้อมูลไม่ได้", "error");
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

  const handleApplyManualDiscount = useCallback((d) => setDiscounts(prev => [...prev, { ...d, id: Date.now(), source: "manual", label: d.mode === "percent" ? `${d.value}%` : `฿${d.value}` }]), []);
  const handleApplyRewardDiscount = useCallback((d) => setDiscounts(prev => [...prev, { ...d, id: Date.now(), source: "member_storage" }]), []);
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
      const saved = await db.addOrder({
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
      });
      setOrders(prev => [saved, ...prev]);

      if (phone) {
        try {
          const { rate, tiers } = getPointSettings();
          const pts = calcPoints(total, rate, tiers);
          const usedRewardIds = [
            ...cart.filter(item => item.storage_id).map(item => item.storage_id),
            ...discounts.filter(d => d.source === "member_storage").map(d => d.id)
          ];
          if (usedRewardIds.length > 0) {
            const { data: mem } = await sb.from("members").select("redeemed_rewards").eq("phone", phone).single();
            if (mem && mem.redeemed_rewards) {
              const updated = mem.redeemed_rewards.map(r => usedRewardIds.includes(r.id) ? { ...r, used_at: new Date().toISOString() } : r);
              await sb.from("members").update({ redeemed_rewards: updated }).eq("phone", phone);
            }
          }
          await sb.rpc("increment_member_points", { p_phone: phone, p_points: pts, p_spent: total });
          const updatedMems = await db.fetchMembers();
          setMembers(updatedMems);
          setHistoryTrigger(t => t + 1);
        } catch (e) { console.warn(e); }
      }
      setCart([]); setDiscounts([]); setMemberPhone("");
      showToast("✨ ชำระเงินเรียบร้อยครับ");
    } catch (err) {
      showToast("❌ บันทึกไม่ได้", "error");
    }
  };

  const commonProps = {
    cart, addToCart, increaseQty, decreaseQty, total, subtotal, discountTotal, discounts,
    memberPhone, setMemberPhone, priceChannel, setPriceChannel, members,
    onApplyManualDiscount: handleApplyManualDiscount,
    onApplyRewardDiscount: handleApplyRewardDiscount,
    onRemoveDiscount: handleRemoveDiscount,
    onClearDiscounts: handleClearDiscounts,
    onCheckout: handleCheckout, showToast, showConfirm, historyTrigger
  };

  if (loading) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>🍖 KATKAT POS...</div>;

  return (
    <div style={{ height: "100vh", width: "100vw", backgroundColor: "#000", color: "#fff", overflow: "hidden" }}>
      {isMobile ? (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          <main style={{ flex: 1, overflowY: "auto", paddingBottom: "80px" }}>
            {view === "pos" && <MobilePOS {...commonProps} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} onClearCart={() => { setCart([]); setDiscounts([]); }} modifierGroups={modifierGroups} />}
            {view === "dashboard" && <Dashboard orders={orders} setOrders={setOrders} onCloseDay={async () => { await db.closeDayOrders(); setOrders([]); showToast("ปิดยอดแล้ว"); }} />}
            {view === "orders" && <Orders orders={orders} onDeleteOrder={async id => { const ok = await showConfirm("ลบออเดอร์?", "ต้องการลบบิลนี้?"); if (ok) { await db.deleteOrder(id); setOrders(prev => prev.filter(o => o.id !== id)); showToast("ลบออเดอร์แล้ว"); } }} onClearAll={async () => { const ok = await showConfirm("ล้างทั้งหมด?", "ต้องการลบทั้งหมด?"); if (ok) { await db.clearOrders(); setOrders([]); showToast("ล้างข้อมูลแล้ว"); } }} />}
            {view === "members" && <Members orders={orders} members={members} onMembersChange={setMembers} showToast={showToast} showConfirm={showConfirm} historyTrigger={historyTrigger} />}
            {view === "menu" && <div style={{ padding: 20 }}><MenuManager products={products} categories={categories} addProduct={addProduct} deleteProduct={deleteProduct} updateProduct={updateProduct} addCategory={addCategory} deleteCategory={deleteCategory} modifierGroups={modifierGroups} /><hr style={{ margin: "20px 0", borderColor: "#222" }} /><ModifierManager modifierGroups={modifierGroups} addModifierGroup={async n => { await db.addModifierGroup(n); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }} deleteModifierGroup={async id => { const ok = await showConfirm("ลบกลุ่มตัวเลือก?", "ต้องการลบ?"); if (ok) { await db.deleteModifierGroup(id); setModifierGroups(prev => prev.filter(g => g.id !== id)); showToast("ลบกลุ่มตัวเลือกแล้ว"); } }} addOptionToGroup={async (id, n, p) => { await db.addOptionToGroup(id, n, p); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }} deleteOption={async (gid, oid) => { await db.deleteOption(gid, oid); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }} /></div>}
          </main>
          <nav style={styles.bottomNav}>
            <button onClick={() => setView("pos")} style={styles.navBtn(view === "pos")}><ShoppingCart size={20} /> ขาย</button>
            <button onClick={() => setView("dashboard")} style={styles.navBtn(view === "dashboard")}><LayoutGrid size={20} /> สรุป</button>
            <button onClick={() => setView("orders")} style={styles.navBtn(view === "orders")}><Clock size={20} /> บิล</button>
            <button onClick={() => setView("members")} style={styles.navBtn(view === "members")}><Users size={20} /> สมาชิก</button>
            <button onClick={() => setView("menu")} style={styles.navBtn(view === "menu")}><UtensilsCrossed size={20} /> เมนู</button>
          </nav>
        </div>
      ) : (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <header style={styles.desktopHeader}>
            <h2 style={{ margin: 0, color: "#f5c518" }}>KATKAT POS</h2>
            <nav style={{ display: "flex", gap: 10 }}>
              {["pos", "dashboard", "orders", "members", "menu"].map(v => (
                <button key={v} onClick={() => setView(v)} style={styles.desktopNavBtn(view === v)}>
                  {v === "pos" ? "🛍️ ขาย" : v === "dashboard" ? "📊 สรุป" : v === "orders" ? "📜 บิล" : v === "members" ? "👥 สมาชิก" : "🍴 เมนู"}
                </button>
              ))}
            </nav>
          </header>
          <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {view === "pos" && (
              <>
                <section style={{ flex: 1, overflowY: "auto", padding: 15, borderRight: "1px solid #222" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
                    <div style={{ fontWeight: "bold", color: "#888" }}>รายการอาหาร</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["pos", "grab", "lineman", "shopee"].map(ch => (
                        <button key={ch} onClick={() => setPriceChannel(ch)} style={{ padding: "6px 15px", borderRadius: 20, border: "none", background: priceChannel === ch ? "#fff" : "#222", color: priceChannel === ch ? "#000" : "#666", fontSize: 11, fontWeight: "bold", cursor: "pointer" }}>{ch.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                  <Products products={products} addToCart={addToCart} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} priceChannel={priceChannel} modifierGroups={modifierGroups} />
                </section>
                <aside style={{ width: 400 }}>
                  <Cart {...commonProps} onClearCart={() => { setCart([]); setDiscounts([]); }} />
                </aside>
              </>
            )}
            {view === "dashboard" && <Dashboard orders={orders} setOrders={setOrders} onCloseDay={async () => { await db.closeDayOrders(); setOrders([]); showToast("ปิดยอดวันแล้ว"); }} />}
            {view === "orders" && <Orders orders={orders} onDeleteOrder={async id => { const ok = await showConfirm("ลบออเดอร์?", "ต้องการลบบิลนี้?"); if (ok) { await db.deleteOrder(id); setOrders(prev => prev.filter(o => o.id !== id)); showToast("ลบออเดอร์แล้ว"); } }} onClearAll={async () => { const ok = await showConfirm("ล้างทั้งหมด?", "ต้องการลบทั้งหมด?"); if (ok) { await db.clearOrders(); setOrders([]); showToast("ล้างข้อมูลแล้ว"); } }} />}
            {view === "members" && <Members orders={orders} members={members} onMembersChange={setMembers} showToast={showToast} showConfirm={showConfirm} historyTrigger={historyTrigger} />}
            {view === "menu" && <div style={{ flex: 1, overflowY: "auto", padding: 30 }}><MenuManager products={products} categories={categories} addProduct={addProduct} deleteProduct={deleteProduct} updateProduct={updateProduct} addCategory={addCategory} deleteCategory={deleteCategory} modifierGroups={modifierGroups} /><hr style={{ margin: "30px 0", borderColor: "#222" }} /><ModifierManager modifierGroups={modifierGroups} addModifierGroup={async n => { await db.addModifierGroup(n); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }} deleteModifierGroup={async id => { const ok = await showConfirm("ลบกลุ่มตัวเลือก?", "ต้องการลบ?"); if (ok) { await db.deleteModifierGroup(id); setModifierGroups(prev => prev.filter(g => g.id !== id)); showToast("ลบกลุ่มตัวเลือกแล้ว"); } }} addOptionToGroup={async (id, n, p) => { await db.addOptionToGroup(id, n, p); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }} deleteOption={async (gid, oid) => { await db.deleteOption(gid, oid); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }} /></div>}
          </main>
        </div>
      )}

      {/* Modern Dialogs */}
      {confirm && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}><div style={{ background: "#1a1a1a", padding: 25, borderRadius: 20, width: 320, border: "1px solid #333", textAlign: "center" }}><h3>{confirm.title}</h3><p style={{ color: "#888", marginBottom: 20 }}>{confirm.message}</p><div style={{ display: "flex", gap: 10 }}><button onClick={confirm.onCancel} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #333", background: "none", color: "#666", cursor: "pointer" }}>ยกเลิก</button><button onClick={confirm.onConfirm} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: confirm.type === "danger" ? "#ff4444" : "#4caf50", color: "#fff", fontWeight: "bold", cursor: "pointer" }}>ตกลง</button></div></div></div>}
      {toast && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#222", padding: "12px 24px", borderRadius: 12, zIndex: 10000, border: "1px solid #444", animation: "toastIn 0.3s ease-out" }}>{toast.type === "error" ? "❌" : "✅"} {toast.message}</div>}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
    </div>
  );
}

const styles = {
  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: "70px", backgroundColor: "#000", display: "flex", justifyContent: "space-around", alignItems: "center", borderTop: "1px solid #111", zIndex: 1000 },
  navBtn: (isActive) => ({ background: "none", border: "none", color: isActive ? "#fff" : "#444", fontSize: "10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }),
  desktopHeader: { padding: "15px 25px", backgroundColor: "#000", borderBottom: "1px solid #111", display: "flex", alignItems: "center", justifyContent: "space-between" },
  desktopNavBtn: (isActive) => ({ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, background: isActive ? "#fff" : "transparent", color: isActive ? "#000" : "#fff", border: "1px solid #222", fontWeight: "bold", cursor: "pointer" }),
};

export default App;
