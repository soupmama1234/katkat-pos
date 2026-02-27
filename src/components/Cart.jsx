import React, { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "../supabase"; // ✅ แก้ import

export default function Cart({
  cart = [],
  decreaseQty,
  increaseQty,
  total = 0,
  onCheckout,
  onClearCart,
  priceChannel = "pos",
  memberPhone = "",
  setMemberPhone,
}) {
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [deliveryRef, setDeliveryRef] = useState("");

  // Member state
  const [memberInput, setMemberInput] = useState("");
  const [memberInfo, setMemberInfo] = useState(null);
  const [memberStatus, setMemberStatus] = useState("idle");
  const [showRegister, setShowRegister] = useState(false);
  const [regNickname, setRegNickname] = useState("");

  const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);
  const receivedNumber = Number(cashReceived) || 0;
  const change = receivedNumber - total;

  useEffect(() => {
    if (showPayment) {
      setDeliveryRef(priceChannel === "grab" ? "GF-" : "");
      setCashReceived("");
    }
  }, [showPayment, priceChannel]);

  /* =======================
      MEMBER LOOKUP (SAFE)
  ======================== */

  const lookupMember = async (phone) => {
    if (phone.length < 9) return;

    setMemberStatus("loading");

    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("phone", phone)
      .maybeSingle(); // ✅ safer กว่า single()

    if (data) {
      setMemberInfo(data);
      setMemberStatus("found");
      setMemberPhone(phone);
    } else {
      setMemberInfo(null);
      setMemberStatus("notfound");
      setMemberPhone("");
    }
  };

  const registerMember = async () => {
    if (!memberInput || !regNickname) return;

    const { data, error } = await supabase
      .from("members")
      .insert({
        phone: memberInput,
        nickname: regNickname,
        points: 0,
        tier: "Bronze",
      })
      .select()
      .single();

    if (error) {
      alert("สมัครไม่สำเร็จ: " + error.message);
      return;
    }

    setMemberInfo(data);
    setMemberStatus("found");
    setMemberPhone(memberInput);
    setShowRegister(false);
    setRegNickname("");
  };

  const clearMember = () => {
    setMemberInput("");
    setMemberInfo(null);
    setMemberStatus("idle");
    setMemberPhone("");
    setShowRegister(false);
    setRegNickname("");
  };

  /* =======================
      DELIVERY REF CONTROL
  ======================== */

  const handleRefChange = (val) => {
    if (priceChannel === "grab") {
      if (val.startsWith("GF-")) setDeliveryRef(val.toUpperCase());
    } else if (priceChannel === "lineman") {
      if (val.length <= 4) setDeliveryRef(val);
    } else {
      setDeliveryRef(val);
    }
  };

  const handleFinalConfirm = () => {
    if (isDelivery) {
      onCheckout("transfer", deliveryRef);
    } else {
      onCheckout(paymentMethod);
    }

    setShowPayment(false);
    setCashReceived("");
    setDeliveryRef("");
  };

  const isConfirmDisabled =
    (!isDelivery &&
      paymentMethod === "cash" &&
      (cashReceived === "" || change < 0)) ||
    (isDelivery &&
      (!deliveryRef ||
        (priceChannel === "grab" &&
          (deliveryRef === "GF-" || deliveryRef.length < 4)) ||
        (priceChannel === "lineman" && deliveryRef.length < 4)));

  /* =======================
        UI
  ======================== */

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>รายการขาย</h2>
        <button
          onClick={() => cart.length > 0 && onClearCart()}
          style={styles.btnClear}
        >
          ล้างตะกร้า
        </button>
      </div>

      <div style={styles.cartList}>
        {cart.length === 0 && (
          <div style={styles.emptyText}>ไม่มีสินค้าในตะกร้า</div>
        )}

        {cart.map((item, index) => (
          <div key={`${item.id}-${index}`} style={styles.cartItem}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "bold" }}>{item.name}</div>
              <div>
                ฿{item.price} × {item.qty} ={" "}
                <strong>฿{item.qty * item.price}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: 5 }}>
              <button
                onClick={() =>
                  decreaseQty(
                    item.id,
                    item.channel,
                    item.selectedModifier?.id
                  )
                }
              >
                −
              </button>
              <span>{item.qty}</span>
              <button
                onClick={() =>
                  increaseQty(
                    item.id,
                    item.channel,
                    item.selectedModifier?.id
                  )
                }
              >
                +
              </button>
              <button
                onClick={() => {
                  for (let i = 0; i < item.qty; i++) {
                    decreaseQty(
                      item.id,
                      item.channel,
                      item.selectedModifier?.id
                    );
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <div style={styles.totalRow}>
          รวมทั้งหมด: ฿{total.toLocaleString()}
        </div>

        <button
          disabled={cart.length === 0}
          onClick={() => setShowPayment(true)}
        >
          {isDelivery ? "บันทึกออเดอร์" : "ชำระเงิน"}
        </button>
      </div>

      {showPayment && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3>ยอดชำระ ฿{total.toLocaleString()}</h3>

            {!isDelivery && (
              <>
                <button onClick={() => setPaymentMethod("cash")}>
                  เงินสด
                </button>
                <button onClick={() => setPaymentMethod("promptpay")}>
                  สแกนจ่าย
                </button>

                {paymentMethod === "cash" && (
                  <>
                    <input
                      type="number"
                      placeholder="รับเงิน"
                      value={cashReceived}
                      onChange={(e) =>
                        setCashReceived(e.target.value)
                      }
                    />
                    <div>เงินทอน: ฿{change}</div>
                  </>
                )}
              </>
            )}

            {isDelivery && (
              <input
                placeholder="เลขอ้างอิง"
                value={deliveryRef}
                onChange={(e) =>
                  handleRefChange(e.target.value)
                }
              />
            )}

            <button
              disabled={isConfirmDisabled}
              onClick={handleFinalConfirm}
            >
              ยืนยัน
            </button>
            <button onClick={() => setShowPayment(false)}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== styles ย่อเพื่อไม่ให้รก ===== */

const styles = {
  container: { padding: 15 },
  header: { display: "flex", justifyContent: "space-between" },
  cartList: { margin: "15px 0" },
  cartItem: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  emptyText: { textAlign: "center", opacity: 0.5 },
  footer: { marginTop: 10 },
  totalRow: { fontWeight: "bold", marginBottom: 10 },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    background: "#fff",
    padding: 20,
    margin: "100px auto",
    width: 300,
  },
};