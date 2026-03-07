// src/utils/pending.js
// ── Pending Orders — เก็บใน localStorage เท่านั้น ──
// pending ยังไม่ใช่ order จริง ไม่ต้องไป Supabase

const KEY = "katkat_pending_orders";

function getAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch { return []; }
}

function saveAll(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/**
 * บันทึก pending order ใหม่
 * @param {object} snapshot — { cart, discounts, orderType, tableNumber, priceChannel, deliveryRef, memberPhone, label }
 * @returns {object} pending ที่ save แล้ว (มี id + savedAt)
 */
export function savePendingOrder(snapshot) {
  const list = getAll();
  const entry = {
    id: Date.now(),
    savedAt: new Date().toISOString(),
    label: snapshot.label || "",
    cart: snapshot.cart || [],
    discounts: snapshot.discounts || [],
    orderType: snapshot.orderType || "dine_in",
    tableNumber: snapshot.tableNumber || "",
    priceChannel: snapshot.priceChannel || "pos",
    deliveryRef: snapshot.deliveryRef || "",
    memberPhone: snapshot.memberPhone || "",
  };
  saveAll([entry, ...list]);
  return entry;
}

/**
 * ดึง pending ทั้งหมด
 */
export function getPendingOrders() {
  return getAll();
}

/**
 * ลบ pending ตาม id
 */
export function deletePendingOrder(id) {
  saveAll(getAll().filter(p => p.id !== id));
}

/**
 * ล้างทั้งหมด
 */
export function clearPendingOrders() {
  saveAll([]);
}
