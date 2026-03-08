// src/components/LoginScreen.jsx
import React, { useState, useEffect, useRef } from "react";
import { login, getRateLockRemaining } from "../utils/auth";

const LOGO_COLOR = "#FF9F0A";

export default function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockSec, setLockSec] = useState(0);
  const pinRef = useRef(null);
  const timerRef = useRef(null);

  // countdown timer สำหรับ lockout
  useEffect(() => {
    if (lockSec <= 0) return;
    timerRef.current = setInterval(() => {
      const rem = getRateLockRemaining();
      setLockSec(rem);
      if (rem <= 0) {
        clearInterval(timerRef.current);
        setError("");
      }
    }, 500);
    return () => clearInterval(timerRef.current);
  }, [lockSec]);

  const handlePinKey = (digit) => {
    if (pin.length >= 6) return;
    setPin(prev => prev + digit);
    setError("");
  };

  const handleDelete = () => setPin(prev => prev.slice(0, -1));

  const handleSubmit = async () => {
    if (!name.trim()) { setError("กรุณากรอกชื่อ"); return; }
    if (pin.length !== 6) { setError("PIN ต้องครบ 6 หลัก"); return; }
    setLoading(true);
    setError("");
    const result = await login(name, pin);
    setLoading(false);
    if (result.ok) {
      onLogin(result.session);
    } else {
      setPin("");
      setError(result.error);
      const rem = getRateLockRemaining();
      if (rem > 0) setLockSec(rem);
    }
  };

  // กด Enter บน keyboard
  useEffect(() => {
    if (pin.length === 6) handleSubmit();
  }, [pin]);

  const isLocked = lockSec > 0;

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <div style={s.logoText}>KATKAT</div>
          <div style={s.logoSub}>POS System</div>
        </div>

        {/* Name input */}
        <div style={s.fieldWrap}>
          <label style={s.label}>ชื่อ</label>
          <input
            style={s.input}
            placeholder="กรอกชื่อของคุณ"
            value={name}
            onChange={e => { setName(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && pinRef.current?.focus()}
            autoComplete="off"
            autoCapitalize="off"
          />
        </div>

        {/* PIN dots */}
        <div style={s.fieldWrap}>
          <label style={s.label}>PIN 6 หลัก</label>
          <div style={s.pinDots}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  ...s.dot,
                  background: i < pin.length ? LOGO_COLOR : "#2a2a2a",
                  border: `2px solid ${i < pin.length ? LOGO_COLOR : "#444"}`,
                  transform: i < pin.length ? "scale(1.15)" : "scale(1)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Numpad */}
        <div style={s.numpad}>
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => {
            if (k === "") return <div key={i} />;
            const isDel = k === "⌫";
            return (
              <button
                key={i}
                style={{
                  ...s.numBtn,
                  ...(isDel ? s.numBtnDel : {}),
                  opacity: isLocked ? 0.4 : 1,
                }}
                onClick={() => isDel ? handleDelete() : handlePinKey(k)}
                disabled={isLocked || loading}
              >
                {k}
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error ? (
          <div style={s.error}>
            {isLocked ? `🔒 ${error}` : `⚠️ ${error}`}
          </div>
        ) : null}

        {/* Submit */}
        <button
          style={{
            ...s.submitBtn,
            opacity: (isLocked || loading || pin.length < 6 || !name.trim()) ? 0.5 : 1,
          }}
          onClick={handleSubmit}
          disabled={isLocked || loading || pin.length < 6 || !name.trim()}
        >
          {loading ? "⏳ กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed", inset: 0,
    background: "#0a0a0a",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999,
    padding: "16px",
  },
  card: {
    background: "#141414",
    border: "1px solid #2a2a2a",
    borderRadius: "24px",
    padding: "32px 24px",
    width: "100%",
    maxWidth: "360px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  logoWrap: { textAlign: "center", marginBottom: "4px" },
  logoText: {
    fontFamily: "'Inter', sans-serif",
    fontSize: "28px", fontWeight: 800,
    color: LOGO_COLOR, letterSpacing: "4px",
  },
  logoSub: { color: "#555", fontSize: "11px", letterSpacing: "2px", marginTop: "2px" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { color: "#888", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" },
  input: {
    background: "#1e1e1e", border: "1px solid #333",
    borderRadius: "12px", padding: "12px 14px",
    color: "#fff", fontSize: "15px",
    outline: "none", fontFamily: "inherit",
  },
  pinDots: {
    display: "flex", gap: "12px", justifyContent: "center",
    padding: "8px 0",
  },
  dot: {
    width: "16px", height: "16px",
    borderRadius: "50%",
    transition: "all 0.15s ease",
  },
  numpad: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
  },
  numBtn: {
    background: "#1e1e1e",
    border: "1px solid #2a2a2a",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "20px",
    fontWeight: 600,
    padding: "16px",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    transition: "background 0.1s",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
  },
  numBtnDel: {
    background: "#1e1e1e",
    color: "#888",
    fontSize: "18px",
  },
  error: {
    background: "rgba(255,69,58,0.1)",
    border: "1px solid rgba(255,69,58,0.3)",
    borderRadius: "10px",
    padding: "10px 14px",
    color: "#FF453A",
    fontSize: "13px",
    textAlign: "center",
  },
  submitBtn: {
    background: LOGO_COLOR,
    color: "#000",
    border: "none",
    borderRadius: "14px",
    padding: "16px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "opacity 0.2s",
  },
};
            
