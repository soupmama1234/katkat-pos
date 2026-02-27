// storage.js
import { createClient } from "@supabase/supabase-js";

/*
==================================================
 Auto-switch Supabase ↔ localStorage
 ถ้ามี VITE_SUPABASE_URL → ใช้ Supabase
 ถ้าไม่มี → ใช้ localStorage (dev mode)
==================================================
*/

const USE_SUPABASE = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_URL !== "https://xxxxxxxxxxxx.supabase.co"
);

/* ==================================================
   localStorage helpers
================================================== */
const ls = {
  get: (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

/* ==================================================
   Supabase setup
================================================== */
let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );
  }
  return _supabase;
}

/* ==================================================
   MAPPERS
================================================== */

function dbToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    grabPrice: row.grab_price,
    linemanPrice: row.lineman_price,
    shopeePrice: row.shopee_price,
    modifierGroups: row.modifier_group_ids || [],
  };
}

function productToDb(p) {
  return {
    name: p.name,
    category: p.category || "ทั่วไป",
    price: Number(p.price) || 0,
    grab_price: p.grabPrice ? Number(p.grabPrice) : null,
    lineman_price: p.linemanPrice ? Number(p.linemanPrice) : null,
    shopee_price: p.shopeePrice ? Number(p.shopeePrice) : null,
    modifier_group_ids: p.modifierGroups || [],
  };
}

function dbToOrder(row) {
  return {
    id: row.id,
    time: row.created_at,
    channel: row.channel,
    payment: row.payment,
    refId: row.ref_id,
    total: row.total,
    actualAmount: row.actual_amount,
    isSettled: row.is_settled,
    items: row.items || [],
    member_phone: row.member_phone || null,
  };
}

/* ==================================================
   SUPABASE DRIVER
================================================== */

const supabaseDriver = {
  /* ---------- CATEGORIES ---------- */
  async fetchCategories() {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("categories")
      .select("name")
      .order("sort_order");

    if (error) throw error;
    return ["All", ...data.map(c => c.name)];
  },

  async addCategory(name) {
    const sb = getSupabase();
    const { error } = await sb
      .from("categories")
      .insert({ name, sort_order: Date.now() });

    if (error && error.code !== "23505") throw error;
  },

  async deleteCategory(name) {
    const sb = getSupabase();
    const { error } = await sb
      .from("categories")
      .delete()
      .eq("name", name);

    if (error) throw error;
  },

  /* ---------- PRODUCTS ---------- */
  async fetchProducts() {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("products")
      .select("*")
      .order("created_at");

    if (error) throw error;
    return data.map(dbToProduct);
  },

  async addProduct(p) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("products")
      .insert(productToDb(p))
      .select()
      .single();

    if (error) throw error;
    return dbToProduct(data);
  },

  async updateProduct(id, fields) {
    const sb = getSupabase();
    const dbFields = {};

    if (fields.name !== undefined) dbFields.name = fields.name;
    if (fields.category !== undefined) dbFields.category = fields.category;
    if (fields.price !== undefined)
      dbFields.price = Number(fields.price);
    if (fields.grabPrice !== undefined)
      dbFields.grab_price = fields.grabPrice
        ? Number(fields.grabPrice)
        : null;
    if (fields.linemanPrice !== undefined)
      dbFields.lineman_price = fields.linemanPrice
        ? Number(fields.linemanPrice)
        : null;
    if (fields.shopeePrice !== undefined)
      dbFields.shopee_price = fields.shopeePrice
        ? Number(fields.shopeePrice)
        : null;
    if (fields.modifierGroups !== undefined)
      dbFields.modifier_group_ids =
        fields.modifierGroups;

    const { error } = await sb
      .from("products")
      .update(dbFields)
      .eq("id", id);

    if (error) throw error;
  },

  async deleteProduct(id) {
    const sb = getSupabase();
    const { error } = await sb
      .from("products")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async clearAllProducts() {
    const sb = getSupabase();
    const { error } = await sb
      .from("products")
      .delete()
      .neq("id", 0);

    if (error) throw error;
  },
    /* ---------- MODIFIERS ---------- */
  async fetchModifierGroups() {
    const sb = getSupabase();

    const [
      { data: groups, error: gErr },
      { data: options, error: oErr },
    ] = await Promise.all([
      sb.from("modifier_groups")
        .select("*")
        .order("created_at"),
      sb.from("modifier_options")
        .select("*")
        .order("created_at"),
    ]);

    if (gErr) throw gErr;
    if (oErr) throw oErr;

    return groups.map(g => ({
      id: g.id,
      name: g.name,
      options: options
        .filter(o => o.group_id === g.id)
        .map(o => ({
          id: o.id,
          name: o.name,
          price: o.price,
        })),
    }));
  },

  async addModifierGroup(name) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("modifier_groups")
      .insert({ name })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      options: [],
    };
  },

  async deleteModifierGroup(groupId) {
    const sb = getSupabase();
    const { error } = await sb
      .from("modifier_groups")
      .delete()
      .eq("id", groupId);

    if (error) throw error;
  },

  async addOptionToGroup(groupId, name, price) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("modifier_options")
      .insert({
        group_id: groupId,
        name,
        price: Number(price) || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      price: data.price,
    };
  },

  async deleteOption(groupId, optionId) {
    const sb = getSupabase();
    const { error } = await sb
      .from("modifier_options")
      .delete()
      .eq("id", optionId);

    if (error) throw error;
  },

  /* ---------- ORDERS ---------- */
  async fetchOrders() {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("orders")
      .select("*")
      .eq("is_history", false)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data.map(dbToOrder);
  },

  async addOrder(order) {
    const sb = getSupabase();

    const { data, error } = await sb
      .from("orders")
      .insert({
        channel: order.channel,
        payment: order.payment,
        ref_id: order.refId || "",
        total: order.total,
        actual_amount: order.actualAmount || 0,
        is_settled: order.isSettled || false,
        is_history: false,
        items: order.items,
        member_phone: order.member_phone || null,
      })
      .select()
      .single();

    if (error) throw error;
    return dbToOrder(data);
  },

  async updateOrder(id, fields) {
    const sb = getSupabase();
    const dbFields = {};

    if (fields.actualAmount !== undefined)
      dbFields.actual_amount = fields.actualAmount;
    if (fields.isSettled !== undefined)
      dbFields.is_settled = fields.isSettled;

    const { error } = await sb
      .from("orders")
      .update(dbFields)
      .eq("id", id);

    if (error) throw error;
  },

  async deleteOrder(id) {
    const sb = getSupabase();
    const { error } = await sb
      .from("orders")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async clearOrders() {
    const sb = getSupabase();
    const { error } = await sb
      .from("orders")
      .delete()
      .eq("is_history", false);

    if (error) throw error;
  },

  async closeDayOrders() {
    const sb = getSupabase();
    const { error } = await sb
      .from("orders")
      .update({ is_history: true })
      .eq("is_history", false);

    if (error) throw error;
  },

  /* ---------- MEMBERS ---------- */
  async fetchMembers() {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("members")
      .select("*")
      .order("total_spent", { ascending: false });

    if (error) throw error;
    return data;
  },

  async addMember(member) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("members")
      .insert(member)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateMember(phone, fields) {
    const sb = getSupabase();
    const { error } = await sb
      .from("members")
      .update(fields)
      .eq("phone", phone);

    if (error) throw error;
  },

  async deleteMember(phone) {
    const sb = getSupabase();
    const { error } = await sb
      .from("members")
      .delete()
      .eq("phone", phone);

    if (error) throw error;
  },
};
const localDriver = {
  /* ---------- MEMBERS ---------- */
  async fetchMembers() {
    return ls.get("katkat_members", []);
  },

  async addMember(member) {
    const saved = {
      ...member,
      created_at:
        member.created_at ||
        new Date().toISOString(),
    };

    const mems = ls.get("katkat_members", []);
    ls.set("katkat_members", [...mems, saved]);
    return saved;
  },

  async updateMember(phone, fields) {
    const mems = ls.get("katkat_members", []);
    ls.set(
      "katkat_members",
      mems.map(m =>
        m.phone === phone
          ? { ...m, ...fields }
          : m
      )
    );
  },

  async deleteMember(phone) {
    const mems = ls.get("katkat_members", []);
    ls.set(
      "katkat_members",
      mems.filter(m => m.phone !== phone)
    );
  },
};
const db = USE_SUPABASE
  ? supabaseDriver
  : localDriver;

export const supabaseClient =
  USE_SUPABASE ? getSupabase() : null;

export default db;