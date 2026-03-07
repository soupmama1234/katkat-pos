import React, { useState, useEffect, useMemo, useCallback } from "react";

import Products from "./components/Products";
import Cart from "./components/Cart";
import MenuManager from "./components/MenuManager";
import Dashboard from "./components/Dashboard";
import Orders from "./components/Orders";
import ModifierManager from "./components/ModifierManager";
import MobilePOS from "./components/MobilePOS";
import Members from "./components/Members";
import ChannelBar from "./components/pos/ChannelBar.jsx";
import { computeDiscountTotal } from "./utils/discounts";
import { calcPoints, getPointSettings } from "./utils/points";
import { supabase as sb } from "./supabase";

import db, { isUsingSupabase } from "./storage";
import { savePendingOrder, getPendingOrders, deletePendingOrder } from "./utils/pending";

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
  const [memberStatus, setMemberStatus] = useState("idle");
  const [discounts, setDiscounts] = useState([]);

  // ── POS order meta (lifted — single source of truth) ──
  const [orderType, setOrderType] = useState("dine_in"); // "dine_in" | "takeaway"
  const [tableNumber, setTableNumber] = useState("");
  const [deliveryRef, setDeliveryRef] = useState("");   // เลข ref grab/lineman/shopee

  // ── Member input state (lifted — ใช้ร่วมกัน Cart + MobilePOS) ──
  const [memberInput, setMemberInput] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [regNickname, setRegNickname] = useState("");

  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [historyTrigger, setHistoryTrigger] = useState(0);

  // ── Pending orders (พักออเดอร์) ──
  const [pendingOrders, setPendingOrders] = useState(() => getPendingOrders());

  // memberInfo derived จาก members array + memberPhone → realtime อัปเดตอัตโนมัติ
  const memberInfo = useMemo(
    () => members.find(m => m.phone === memberPhone) || null,
    [members, memberPhone]
  );

  const setMemberInfo = useCallback((updatedMember) => {
    if (!updatedMember) return;
    setMembers(prev => prev.map(m => m.phone === updatedMember.phone ? updatedMember : m));
  }, []);

  const onMemberUpdate = useCallback((updatedMember) => {
    setMembers(prev => prev.map(m => m.phone === updatedMember.phone ? updatedMember : m));
  }, []);

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

        const dbCats = new Set(cats.filter(c => c !== "All"));
        const prodCats = new Set(prods.map(p => p.category).filter(Boolean));
        const merged = ["All", ...[...new Set([...dbCats, ...prodCats])].sort((a, b) => a.localeCompare(b, 'th'))];

        setCategories(merged);
        setProducts(prods.sort((a, b) => a.name.localeCompare(b.name, 'th')));
        setModifierGroups(mods);
        setOrders(ords);
        setMembers(mems);
      } catch (err) {
        showToast("❌ โหลดข้อมูลไม่ได้ กรุณา refresh", "error");
      } finally {
        setLoading(false);
      }
    }
    loadAll();

    const channel = sb
      .channel("members-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, (payload) => {
        if (payload.eventType === "INSERT") setMembers(prev => [...prev, payload.new]);
        else if (payload.eventType === "UPDATE") setMembers(prev => prev.map(m => m.phone === payload.new.phone ? payload.new : m));
        else if (payload.eventType === "DELETE") setMembers(prev => prev.filter(m => m.phone !== payload.old.phone));
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const addCategory = useCallback(async (name) => {
    if (!name || categories.includes(name)) return;
    await db.addCategory(name);
    setCategories(prev => ["All", ...[...new Set([...prev, name])].filter(c => c !== "All").sort((a, b) => a.localeCompare(b, 'th'))]);
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
  const handleClearDiscounts = useCallback(() => setDiscounts([]), []);

  // ── คืนคูปองให้สมาชิกเมื่อลบออกจากตะกร้า ──
  const unmarkCouponUsed = useCallback(async (couponId) => {
    setMembers(prev => prev.map(m => {
      if (m.phone !== memberPhone) return m;
      return { ...m, redeemed_rewards: (m.redeemed_rewards || []).map(r => r.id === couponId ? { ...r, used_at: null } : r) };
    }));
    try {
      const member = members.find(m => m.phone === memberPhone);
      if (!member) return;
      const updated = (member.redeemed_rewards || []).map(r => r.id === couponId ? { ...r, used_at: null } : r);
      await sb.from("members").update({ redeemed_rewards: updated }).eq("phone", memberPhone);
    } catch (e) { console.warn("unmarkCouponUsed error:", e); }
  }, [memberPhone, members]);

  // ── ลบ discount — ถ้ามี couponId ให้คืนคูปองด้วย ──
  const handleRemoveDiscount = useCallback((id) => {
    setDiscounts(prev => {
      const disc = prev.find(d => d.id === id);
      if (disc?.couponId) unmarkCouponUsed(disc.couponId);
      return prev.filter(d => d.id !== id);
    });
  }, [unmarkCouponUsed]);

  const clearCart = useCallback(() => {
    setCart(prev => {
      prev.forEach(item => { if (item.couponId) unmarkCouponUsed(item.couponId); });
      return [];
    });
    setDiscounts(prev => {
      prev.forEach(d => { if (d.couponId) unmarkCouponUsed(d.couponId); });
      return [];
    });
  }, [unmarkCouponUsed]);

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
      if (n[idx].couponId) unmarkCouponUsed(n[idx].couponId);
      return n.filter((_, i) => i !== idx);
    });
  }, [unmarkCouponUsed]);

  const increaseQty = useCallback((id, channel, modId = null) => {
    setCart(prev => prev.map(i => (i.id === id && i.channel === channel && (i.selectedModifier?.id || null) === (modId || null)) ? { ...i, qty: i.qty + 1 } : i));
  }, []);

  // ── Member actions (lifted — single source of truth) ──
  const lookupMember = useCallback(async (phone) => {
    if (!phone || phone.length < 9) return;
    setMemberStatus("loading");
    try {
      const { data } = await sb.from("members").select("*").eq("phone", phone).single();
      if (data) {
        setMembers(prev => prev.some(m => m.phone === data.phone) ? prev.map(m => m.phone === data.phone ? data : m) : [...prev, data]);
        setMemberPhone(phone);
        setMemberStatus("found");
      } else {
        setMemberPhone("");
        setMemberStatus("notfound");
      }
    } catch {
      setMemberPhone("");
      setMemberStatus("notfound");
    }
  }, []);

  const registerMember = useCallback(async () => {
    if (!memberInput || !regNickname) return;
    try {
      const { data } = await sb.from("members").insert({ phone: memberInput, nickname: regNickname }).select().single();
      setMembers(prev => [...prev, data]);
      setMemberPhone(memberInput);
      setMemberStatus("found");
      setShowRegister(false);
      setRegNickname("");
      showToast("สมัครสมาชิกเรียบร้อย ✨");
    } catch (e) {
      showToast("สมัครไม่สำเร็จ: " + e.message, "error");
    }
  }, [memberInput, regNickname, showToast]);

  const clearMember = useCallback(() => {
    setMemberInput("");
    setMemberPhone("");
    setMemberStatus("idle");
    setShowRegister(false);
    setRegNickname("");
  }, []);

  // ── Pending order handlers ──
  const handleSavePending = useCallback((label = "") => {
    if (cart.length === 0) return showToast("ตะกร้าว่างอยู่ครับ", "error");
    const entry = savePendingOrder({
      cart, discounts, orderType, tableNumber,
      priceChannel, deliveryRef, memberPhone, label,
    });
    setPendingOrders(getPendingOrders());
    // reset cart หลัง save
    setCart([]);
    setDiscounts([]);
    setOrderType("dine_in");
    setTableNumber("");
    setDeliveryRef("");
    clearMember();
    showToast(`พักออเดอร์ "${entry.label || "ออเดอร์ใหม่"}" แล้ว ✅`);
  }, [cart, discounts, orderType, tableNumber, priceChannel, deliveryRef, memberPhone, clearMember, showToast]);

  const handleRestorePending = useCallback((pending) => {
    if (cart.length > 0) {
      showToast("กรุณาล้างตะกร้าก่อนดึงออเดอร์กลับ", "error");
      return;
    }
    setCart(pending.cart);
    setDiscounts(pending.discounts);
    setOrderType(pending.orderType);
    setTableNumber(pending.tableNumber);
    setDeliveryRef(pending.deliveryRef);
    if (pending.memberPhone) {
      setMemberInput(pending.memberPhone);
      // trigger lookup
      setTimeout(() => lookupMember(pending.memberPhone), 100);
    }
    deletePendingOrder(pending.id);
    setPendingOrders(getPendingOrders());
    showToast(`ดึงออเดอร์ "${pending.label || "ออเดอร์"}" กลับมาแล้ว`);
  }, [cart.length, lookupMember, showToast]);

  const handleDeletePending = useCallback((id) => {
    deletePendingOrder(id);
    setPendingOrders(getPendingOrders());
    showToast("ลบออเดอร์ที่พักไว้แล้ว");
  }, [showToast]);

  // ── เปลี่ยน channel → reset deliveryRef ──
  const handleSetPriceChannel = useCallback((ch) => {
    setPriceChannel(ch);
    setDeliveryRef("");
  }, []);

  // ── handleCheckout อ่าน state โดยตรงทั้งหมด ──
  const handleCheckout = useCallback(async (paymentMethod) => {
    if (cart.length === 0) return;
    const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);
    // validate delivery ref
    if (isDelivery) {
      if (!deliveryRef || deliveryRef === "GF-") return showToast("กรุณาระบุเลขอ้างอิง", "error");
      if (priceChannel === "grab" && deliveryRef.length < 7) return showToast("เลข GrabFood ไม่ครบ", "error");
      if (priceChannel === "lineman" && deliveryRef.replace("GF-","").length < 4) return showToast("เลข LINE MAN ไม่ครบ", "error");
    }
    try {
      const saved = await db.addOrder({
        time: new Date().toISOString(),
        items: [...cart],
        total,
        discount: discountTotal || undefined,
        payment: isDelivery ? "transfer" : paymentMethod,
        channel: priceChannel,
        refId: isDelivery ? deliveryRef : "",
        isSettled: !isDelivery,
        actualAmount: isDelivery ? 0 : total,
        member_phone: memberPhone || null,
        orderType: isDelivery ? "delivery" : orderType,
        tableNumber: (!isDelivery && orderType === "dine_in") ? (tableNumber.trim() || null) : null,
      });
      setOrders(prev => [saved, ...prev]);

      if (memberPhone) {
        try {
          const { rate, tiers } = getPointSettings();
          const pts = calcPoints(total, rate, tiers);
          await sb.rpc("increment_member_points", { p_phone: memberPhone, p_points: pts, p_spent: total });
          setHistoryTrigger(prev => prev + 1);
        } catch (e) { console.warn("Points update error:", e); }
      }

      // ── reset ทุกอย่างหลัง checkout ──
      setCart([]);
      setDiscounts([]);
      setOrderType("dine_in");
      setTableNumber("");
      setDeliveryRef("");
      clearMember();
      showToast(isDelivery ? `บันทึกออเดอร์ ${priceChannel.toUpperCase()} เรียบร้อย` : "✨ ชำระเงินเรียบร้อยครับ");
    } catch (err) {
      showToast("❌ บันทึกออเดอร์ไม่ได้ กรุณาลองใหม่", "error");
    }
  }, [cart, total, discountTotal, priceChannel, deliveryRef, memberPhone, orderType, tableNumber, clearMember, showToast]);

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
    cart, addToCart, increaseQty, decreaseQty,
    total, subtotal, discountTotal, discounts,
    onApplyManualDiscount: handleApplyManualDiscount,
    onApplyRewardDiscount: handleApplyRewardDiscount,
    onRemoveDiscount: handleRemoveDiscount,
    onClearDiscounts: handleClearDiscounts,
    onCheckout: handleCheckout,
    priceChannel, setPriceChannel: handleSetPriceChannel,
    orderType, setOrderType,
    tableNumber, setTableNumber,
    deliveryRef, setDeliveryRef,
    memberPhone,
    memberInfo, onMemberUpdate,
    memberStatus, setMemberStatus,
    memberInput, setMemberInput,
    showRegister, setShowRegister,
    regNickname, setRegNickname,
    lookupMember, registerMember, clearMember,
    showToast, showConfirm, historyTrigger,
    // ── pending ──
    pendingOrders,
    onSavePending: handleSavePending,
    onRestorePending: handleRestorePending,
    onDeletePending: handleDeletePending,
  };

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a", color: "#fff" }}>
      🍖 KATKAT POS...
    </div>
  );

  return (
    <div style={{ height: "100vh", width: "100vw", backgroundColor: "#1a1a1a", color: "#fff", overflow: "hidden" }}>
      {isMobile ? (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          <main style={{ flex: 1, overflowY: "auto", paddingBottom: "80px" }}>
            {view === "pos" && (
              <MobilePOS
                {...commonProps}
                products={products}
                categories={categories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                onClearCart={clearCart}
                modifierGroups={modifierGroups}
              />
            )}
            {view === "dashboard" && <Dashboard orders={orders} setOrders={setOrders} onCloseDay={handleCloseDay} onUpdateActual={handleUpdateActual} />}
            {view === "orders" && (
              <Orders
                orders={orders}
                onDeleteOrder={async id => { const ok = await showConfirm("ลบออเดอร์?", "ต้องการลบบิลนี้ใช่หรือไม่?"); if (ok) { await db.deleteOrder(id); setOrders(prev => prev.filter(o => o.id !== id)); showToast("ลบออเดอร์แล้ว"); } }}
                onClearAll={async () => { const ok = await showConfirm("ลบทั้งหมด?", "ต้องการลบออเดอร์ทั้งหมดใช่หรือไม่?"); if (ok) { await db.clearOrders(); setOrders([]); showToast("ล้างข้อมูลแล้ว"); } }}
              />
            )}
            {view === "menu" && (
              <div style={{ padding: "10px" }}>
                <MenuManager products={products} categories={categories} addProduct={addProduct} deleteProduct={deleteProduct} updateProduct={updateProduct} addCategory={addCategory} deleteCategory={deleteCategory} modifierGroups={modifierGroups} />
                <hr style={{ margin: "30px 0", borderColor: "#333" }} />
                <ModifierManager
                  modifierGroups={modifierGroups}
                  addModifierGroup={async n => { await db.addModifierGroup(n); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }}
                  deleteModifierGroup={async id => { const ok = await showConfirm("ลบกลุ่มตัวเลือก?", "ต้องการลบใช่หรือไม่?"); if (ok) { await db.deleteModifierGroup(id); setModifierGroups(prev => prev.filter(g => g.id !== id)); showToast("ลบกลุ่มตัวเลือกแล้ว"); } }}
                  addOptionToGroup={async (id, n, p) => { await db.addOptionToGroup(id, n, p); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }}
                  deleteOption={async (gid, oid) => { await db.deleteOption(gid, oid); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }}
                />
              </div>
            )}
            {view === "members" && <Members orders={orders} members={members} onMembersChange={setMembers} showToast={showToast} showConfirm={showConfirm} historyTrigger={historyTrigger} />}
          </main>
          <nav style={styles.bottomNav}>
            <button onClick={() => setView("pos")} style={styles.navBtn(view === "pos")}><span>🛍️</span> ขาย</button>
            <button onClick={() => setView("dashboard")} style={styles.navBtn(view === "dashboard")}><span>📊</span> สรุป</button>
            <button onClick={() => setView("orders")} style={styles.navBtn(view === "orders")}><span>📜</span> บิล</button>
            <button onClick={() => setView("members")} style={styles.navBtn(view === "members")}><span>👥</span> สมาชิก</button>
            <button onClick={() => setView("menu")} style={styles.navBtn(view === "menu")}><span>🍴</span> เมนู</button>
          </nav>
        </div>
      ) : (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <header style={styles.desktopHeader}>
            <h2 style={{ margin: 0 }}>KATKAT POS</h2>
            <nav style={{ display: "flex", gap: 10 }}>
              {["pos", "dashboard", "orders", "members", "menu"].map(v => (
                <button key={v} onClick={() => setView(v)} style={styles.desktopNavBtn(view === v)}>
                  {v === "pos" ? "🛍️ ขาย" : v === "dashboard" ? "📊 สรุป" : v === "orders" ? "📜 บิล" : v === "members" ? "👥 สมาชิก" : "🍴 เมนู"}
                </button>
              ))}
            </nav>
          </header>

          {view === "pos" && (
            <div style={styles.desktopChannelBar}>
              <span style={{ fontSize: "12px", color: "#888", fontWeight: "bold" }}>ช่องทางราคา:</span>
              <ChannelBar priceChannel={priceChannel} setPriceChannel={handleSetPriceChannel} variant="light" />
            </div>
          )}

          <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {view === "pos" && (
              <>
                <section style={{ flex: 1, overflowY: "auto", padding: 15, borderRight: "1px solid #333" }}>
                  <Products products={products} addToCart={addToCart} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} priceChannel={priceChannel} setPriceChannel={setPriceChannel} modifierGroups={modifierGroups} />
                </section>
                <aside style={{ width: 400 }}>
                  <Cart {...commonProps} onClearCart={clearCart} />
                </aside>
              </>
            )}
            {view === "dashboard" && <Dashboard orders={orders} setOrders={setOrders} onCloseDay={handleCloseDay} onUpdateActual={handleUpdateActual} />}
            {view === "members" && <Members orders={orders} members={members} onMembersChange={setMembers} showToast={showToast} showConfirm={showConfirm} historyTrigger={historyTrigger} />}
            {view === "menu" && (
              <div style={{ flex: 1, overflowY: "auto", padding: 30 }}>
                <MenuManager products={products} categories={categories} addProduct={addProduct} deleteProduct={deleteProduct} updateProduct={updateProduct} addCategory={addCategory} deleteCategory={deleteCategory} modifierGroups={modifierGroups} />
                <hr style={{ margin: "40px 0", borderColor: "#333" }} />
                <ModifierManager
                  modifierGroups={modifierGroups}
                  addModifierGroup={async n => { await db.addModifierGroup(n); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }}
                  deleteModifierGroup={async id => { const ok = await showConfirm("ลบกลุ่มตัวเลือก?", "ต้องการลบใช่หรือไม่?"); if (ok) { await db.deleteModifierGroup(id); setModifierGroups(prev => prev.filter(g => g.id !== id)); showToast("ลบกลุ่มตัวเลือกแล้ว"); } }}
                  addOptionToGroup={async (id, n, p) => { await db.addOptionToGroup(id, n, p); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }}
                  deleteOption={async (gid, oid) => { await db.deleteOption(gid, oid); const mods = await db.fetchModifierGroups(); setModifierGroups(mods); }}
                />
              </div>
            )}
            {view === "orders" && (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <Orders
                  orders={orders}
                  onDeleteOrder={async id => { const ok = await showConfirm("ลบออเดอร์?", "ต้องการลบบิลนี้?"); if (ok) { await db.deleteOrder(id); setOrders(prev => prev.filter(o => o.id !== id)); showToast("ลบออเดอร์แล้ว"); } }}
                  onClearAll={async () => { const ok = await showConfirm("ล้างทั้งหมด?", "ต้องการลบทั้งหมด?"); if (ok) { await db.clearOrders(); setOrders([]); showToast("ล้างข้อมูลแล้ว"); } }}
                />
              </div>
            )}
          </main>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20 }}>
          <div style={{ backgroundColor: "#1a1a1a", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "340px", border: "1px solid #333", textAlign: "center" }}>
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

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: isMobile ? "20px" : "30px", left: "50%", transform: "translateX(-50%)", backgroundColor: toast.type === "error" ? "#ff4444" : "#222", color: "#fff", padding: "12px 24px", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.3)", zIndex: 9999, display: "flex", alignItems: "center", gap: 10, fontWeight: "bold", border: toast.type === "error" ? "none" : "1px solid #444" }}>
          <span>{toast.type === "error" ? "❌" : "✅"}</span>
          {toast.message}
        </div>
      )}

      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

const styles = {
  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: "70px", backgroundColor: "#1a1a1a", display: "flex", justifyContent: "space-around", alignItems: "center", borderTop: "1px solid #333", zIndex: 1000 },
  navBtn: (isActive) => ({ background: "none", border: "none", color: isActive ? "#fff" : "#666", fontSize: "10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", fontWeight: isActive ? "bold" : "normal", cursor: "pointer", padding: "0 4px" }),
  desktopHeader: { padding: "15px 25px", backgroundColor: "#222", borderBottom: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "space-between" },
  desktopNavBtn: (isActive) => ({ padding: "8px 16px", borderRadius: "8px", background: isActive ? "#fff" : "transparent", color: isActive ? "#000" : "#fff", border: "1px solid #444", fontWeight: "bold", cursor: "pointer" }),
  desktopChannelBar: { padding: "10px 25px", backgroundColor: "#111", borderBottom: "1px solid #333", display: "flex", gap: 10, alignItems: "center" },
};

export default App;
