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
import { getSession, logout, can } from "./utils/auth";
import LoginScreen from "./components/LoginScreen";
import CustomerOrder from "./components/CustomerOrder";
import StaffManager from "./components/StaffManager";


// ── New Order Alert ───────────────────────────────────────────
function NewOrderAlert({ tableNumber }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none",
    }}>
      <div style={{
        background: "#FF9F0A", color: "#000",
        borderRadius: 24, padding: "28px 40px",
        textAlign: "center", boxShadow: "0 8px 40px rgba(255,159,10,0.5)",
        animation: "orderPop 0.3s ease",
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🔔</div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>ออเดอร์ใหม่!</div>
        {tableNumber && <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>โต๊ะ {tableNumber}</div>}
      </div>
      <style>{`@keyframes orderPop { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}

// ── Audio (unlock on first touch) ────────────────────────────
let _audioCtx = null;
function unlockAudio() {
  if (_audioCtx) return;
  try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
}
function playBeep() {
  try {
    if (!_audioCtx) return;
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    const times = [0, 0.2, 0.4];
    times.forEach(t => {
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.connect(gain); gain.connect(_audioCtx.destination);
      osc.frequency.value = 880; osc.type = "sine";
      gain.gain.setValueAtTime(0, _audioCtx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.5, _audioCtx.currentTime + t + 0.02);
      gain.gain.linearRampToValueAtTime(0, _audioCtx.currentTime + t + 0.15);
      osc.start(_audioCtx.currentTime + t);
      osc.stop(_audioCtx.currentTime + t + 0.2);
    });
  } catch {}
}

function App() {
  const [view, setView] = useState("pos");
  const [priceChannel, setPriceChannel] = useState("pos");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(() => getSession());
  const [newOrderAlert, setNewOrderAlert] = useState(null); // { count, tableNumber }

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

  // ── Pending orders staff (localStorage) ──
  const [pendingOrders, setPendingOrders] = useState(() => getPendingOrders());
  // ── Customer pending orders (Supabase) ──
  const [customerPendingOrders, setCustomerPendingOrders] = useState([]);
  const [acceptedOrders, setAcceptedOrders] = useState([]);

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
        // fetch customer pending orders
        try {
          const [cp, ac] = await Promise.all([db.fetchPendingOrders(), db.fetchAcceptedOrders()]);
          setCustomerPendingOrders(cp);
          setAcceptedOrders(ac);
        } catch {}
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

    const ordersChannel = sb
      .channel("orders-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (payload) => {
        try {
          const [cp, ac] = await Promise.all([db.fetchPendingOrders(), db.fetchAcceptedOrders()]);
          setCustomerPendingOrders(cp);
          setAcceptedOrders(ac);
          const tableNum = payload?.new?.table_number || payload?.new?.table_no || "";
          setNewOrderAlert({ tableNumber: tableNum });
          playBeep();
          setTimeout(() => setNewOrderAlert(null), 4000);
        } catch (e) { console.error("❌ fetch error:", e); }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, async (payload) => {
        try {
          const [cp, ac] = await Promise.all([db.fetchPendingOrders(), db.fetchAcceptedOrders()]);
          setCustomerPendingOrders(cp);
          setAcceptedOrders(ac);
        } catch (e) { console.error("fetch error:", e); }
      })
      .subscribe((status) => {
        console.log("📡 orders realtime status:", status);
      });

    return () => { sb.removeChannel(channel); sb.removeChannel(ordersChannel); };
  }, []);

  // unlock audio on first interaction
  useEffect(() => {
    const unlock = () => { unlockAudio(); window.removeEventListener("touchstart", unlock); window.removeEventListener("mousedown", unlock); };
    window.addEventListener("touchstart", unlock);
    window.addEventListener("mousedown", unlock);
    return () => { window.removeEventListener("touchstart", unlock); window.removeEventListener("mousedown", unlock); };
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
  const handleCheckout = useCallback(async (paymentMethod, customerType = null) => {
    if (cart.length === 0) return;
    const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);
    // validate delivery ref
    if (isDelivery) {
      if (!deliveryRef || deliveryRef === "GF-") return showToast("กรุณาระบุเลขอ้างอิง", "error");
      if (priceChannel === "grab" && deliveryRef.replace("GF-", "").length < 3) return showToast("เลข GrabFood ไม่ครบ", "error");
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
        customerType: memberPhone ? null : (customerType || null),
      });
      setOrders(prev => [saved, ...prev]);

      if (memberPhone) {
  try {
    const { rate, tiers } = getPointSettings();
    const pts = calcPoints(total, rate, tiers);
    const { error: rpcError } = await sb.rpc("increment_member_points", { 
      p_phone: memberPhone, 
      p_points: pts, 
      p_spent: total 
    });
    if (rpcError) throw rpcError;
    setHistoryTrigger(prev => prev + 1);
  } catch (e) { 
    console.warn("Points update error:", e);
    showToast("⚠️ บันทึกแต้มไม่สำเร็จ กรุณาแจ้งแอดมิน", "error");
  }
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

  const handleSettleOrder = async (order, payment, actual) => {
    await db.settleOrder(order.id, payment, actual);
    setAcceptedOrders(prev => prev.filter(o => o.id !== order.id));
    const ords = await db.fetchOrders();
    setOrders(ords);
    showToast(`รับเงินโต๊ะ ${order.tableNumber || ""} เรียบร้อย 💰`);
  };

  const handleCancelPending = async (order) => {
    await db.cancelPendingOrder(order.id);
    setCustomerPendingOrders(prev => prev.filter(o => o.id !== order.id));
    showToast("ยกเลิกออเดอร์แล้ว");
  };

  const handleAcceptPending = async (order) => {
    await db.acceptPendingOrder(order.id);
    setCustomerPendingOrders(prev => prev.filter(o => o.id !== order.id));
    setAcceptedOrders(prev => [...prev, { ...order, status: "accepted" }]);
    showToast(`รับออเดอร์โต๊ะ ${order.tableNumber || ""} แล้ว ✅`);
  };
const handleDeleteOrder = useMemo(() => {
  if (!can(session?.role, "delete_order")) return null;
  return async (id) => {
    const ok = await showConfirm("ลบออเดอร์?", "ต้องการลบบิลนี้ใช่หรือไม่?");
    if (!ok) return;
    await db.deleteOrder(id);
    setOrders(prev => prev.filter(o => o.id !== id));
    showToast("ลบออเดอร์แล้ว");
  };
}, [session?.role, showConfirm, showToast]);

const handleClearAllOrders = useMemo(() => {
  if (!can(session?.role, "delete_order")) return null;
  return async () => {
    const ok = await showConfirm("ล้างทั้งหมด?", "ต้องการลบออเดอร์ทั้งหมดใช่หรือไม่?");
    if (!ok) return;
    await db.clearOrders();
    setOrders([]);
    showToast("ล้างข้อมูลแล้ว");
  };
}, [session?.role, showConfirm, showToast]);
  const handleLogout = () => {
    logout();
    setSession(null);
  };

  // ── Guard: customer mode ──
  const isCustomerMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("customer") === "1";
  if (isCustomerMode) return <CustomerOrder />;

  // ── Guard: ถ้าไม่มี session → โชว์ LoginScreen ──
  if (!session) {
    return <LoginScreen onLogin={(s) => setSession(s)} />;
  }

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
                pendingOrders={customerPendingOrders}
                acceptedOrders={acceptedOrders}
                onAcceptPending={handleAcceptPending}
                onCancelPending={handleCancelPending}
                onSettleOrder={handleSettleOrder}
                onDeleteOrder={handleDeleteOrder}
                onClearAll={handleClearAllOrders}
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
            {view === "staff" && <StaffManager session={session} />}
          </main>
          {/* More Menu Drawer */}
          {showMoreMenu && (
            <div style={{ position: "fixed", inset: 0, zIndex: 2000 }} onClick={() => setShowMoreMenu(false)}>
              <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, background: "#1a1a1a", borderTop: "1px solid #333", borderRadius: "20px 20px 0 0", padding: "12px 16px 8px" }}
                onClick={e => e.stopPropagation()}>
                <div style={{ width: 36, height: 4, background: "#333", borderRadius: 99, margin: "0 auto 16px" }} />
                {can(session.role, "members") && (
                  <button onClick={() => { setView("members"); setShowMoreMenu(false); }} style={styles.drawerBtn(view === "members")}>
                    <span style={styles.drawerIcon}>👥</span> สมาชิก
                  </button>
                )}
                {can(session.role, "menu_manager") && (
                  <button onClick={() => { setView("menu"); setShowMoreMenu(false); }} style={styles.drawerBtn(view === "menu")}>
                    <span style={styles.drawerIcon}>🍴</span> จัดการเมนู
                  </button>
                )}
                {can(session.role, "staff_manager") && (
                  <button onClick={() => { setView("staff"); setShowMoreMenu(false); }} style={styles.drawerBtn(view === "staff")}>
                    <span style={styles.drawerIcon}>👤</span> Staff
                  </button>
                )}
                <button onClick={() => { handleLogout(); setShowMoreMenu(false); }} style={{ ...styles.drawerBtn(false), color: "#FF453A" }}>
                  <span style={styles.drawerIcon}>🚪</span> ออกจากระบบ
                </button>
              </div>
            </div>
          )}

          <nav style={styles.bottomNav}>
            <button onClick={() => setView("pos")} style={styles.navBtn(view === "pos")}><span>🛍️</span> ขาย</button>
            {can(session.role, "dashboard") && <button onClick={() => setView("dashboard")} style={styles.navBtn(view === "dashboard")}><span>📊</span> สรุป</button>}
            {can(session.role, "orders") && (
              <button onClick={() => setView("orders")} style={styles.navBtn(view === "orders")}>
                <span style={{ position: "relative" }}>
                  📜
                  {customerPendingOrders.length > 0 && (
                    <span style={{ position: "absolute", top: -6, right: -8, background: "#FF3B30", color: "#fff", borderRadius: 99, fontSize: 9, fontWeight: 800, padding: "1px 4px", minWidth: 14, textAlign: "center" }}>
                      {customerPendingOrders.length}
                    </span>
                  )}
                </span>
                บิล
              </button>
            )}
            <button
              onClick={() => setShowMoreMenu(p => !p)}
              style={{ ...styles.navBtn(showMoreMenu || ["members","menu","staff"].includes(view)), position: "relative" }}>
              <span>⋯</span>
              {["members","menu","staff"].includes(view) && <span style={{ position: "absolute", top: 0, right: 8, width: 6, height: 6, background: "#FF9F0A", borderRadius: 99 }} />}
              เพิ่มเติม
            </button>
          </nav>
        </div>
      ) : (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <header style={styles.desktopHeader}>
            <h2 style={{ margin: 0 }}>KATKAT POS</h2>
            <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {can(session.role, "pos") && <button onClick={() => setView("pos")} style={styles.desktopNavBtn(view === "pos")}>🛍️ ขาย</button>}
              {can(session.role, "dashboard") && <button onClick={() => setView("dashboard")} style={styles.desktopNavBtn(view === "dashboard")}>📊 สรุป</button>}
              {can(session.role, "orders") && (
                <button onClick={() => setView("orders")} style={{ ...styles.desktopNavBtn(view === "orders"), position: "relative" }}>
                  📜 บิล
                  {customerPendingOrders.length > 0 && (
                    <span style={{ position: "absolute", top: -6, right: -6, background: "#FF3B30", color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 800, padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
                      {customerPendingOrders.length}
                    </span>
                  )}
                </button>
              )}
              <div style={{ width: "1px", height: "20px", background: "#444", margin: "0 4px" }} />
              <span style={{ color: "#888", fontSize: "12px" }}>👤 {session.name}</span>
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowMoreMenu(p => !p)}
                  style={{ ...styles.desktopNavBtn(showMoreMenu || ["members","menu","staff"].includes(view)), display: "flex", alignItems: "center", gap: 6 }}>
                  ☰ จัดการ
                  {["members","menu","staff"].includes(view) && <span style={{ width: 6, height: 6, background: "#FF9F0A", borderRadius: 99, display: "inline-block" }} />}
                </button>
                {showMoreMenu && (
                  <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#1a1a1a", border: "1px solid #333", borderRadius: 14, padding: "8px", minWidth: 180, zIndex: 2000, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}
                    onClick={() => setShowMoreMenu(false)}>
                    {can(session.role, "members") && (
                      <button onClick={() => setView("members")} style={styles.dropdownBtn(view === "members")}>👥 สมาชิก</button>
                    )}
                    {can(session.role, "menu_manager") && (
                      <button onClick={() => setView("menu")} style={styles.dropdownBtn(view === "menu")}>🍴 จัดการเมนู</button>
                    )}
                    {can(session.role, "staff_manager") && (
                      <button onClick={() => setView("staff")} style={styles.dropdownBtn(view === "staff")}>👤 Staff</button>
                    )}
                    <div style={{ borderTop: "1px solid #2a2a2a", margin: "6px 0" }} />
                    <button onClick={handleLogout} style={{ ...styles.dropdownBtn(false), color: "#FF453A" }}>🚪 ออกจากระบบ</button>
                  </div>
                )}
              </div>
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
                  pendingOrders={customerPendingOrders}
                  acceptedOrders={acceptedOrders}
                  onAcceptPending={handleAcceptPending}
                  onCancelPending={handleCancelPending}
                  onSettleOrder={handleSettleOrder}
                  onDeleteOrder={handleDeleteOrder}
                  onClearAll={handleClearAllOrders}
                />
              </div>
            )}
            {view === "staff" && (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <StaffManager session={session} />
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

      {newOrderAlert && <NewOrderAlert tableNumber={newOrderAlert.tableNumber} />}
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
  drawerBtn: (isActive) => ({ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: isActive ? "#FF9F0A22" : "none", border: "none", borderRadius: 12, color: isActive ? "#FF9F0A" : "#ccc", fontSize: 15, fontWeight: isActive ? 700 : 400, cursor: "pointer", textAlign: "left", marginBottom: 2 }),
  drawerIcon: { fontSize: 20, width: 28, textAlign: "center" },
  dropdownBtn: (isActive) => ({ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: isActive ? "#FF9F0A22" : "none", border: "none", borderRadius: 10, color: isActive ? "#FF9F0A" : "#ccc", fontSize: 14, fontWeight: isActive ? 700 : 400, cursor: "pointer", textAlign: "left", marginBottom: 2 }),
};

export default App;
