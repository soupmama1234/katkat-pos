import React, { useState, useEffect, useRef } from "react";

export default function GameMatch({ member, onFinish }) {
  const [mode, setMode] = useState(null); // null, 'easy', 'hard'
  const [gameState, setGameState] = useState("idle"); // 'idle', 'running', 'stopped'
  const [time, setTime] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [bestTime, setBestTime] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [reward, setReward] = useState("");

  const timerRef = useRef(null);
  const startTimeRef = useRef(0);

  // 1. คำนวณเกณฑ์รางวัลตาม Fact ที่กำหนด
  const calculateReward = (finalTime) => {
    const diff = Math.abs(finalTime - 5.0);
    
    if (mode === "hard") {
      if (finalTime === 5.0) return "🏆 ข้าวฟรี 1 SET (มูลค่า 70 บาท)";
      return "🥉 ส่วนลด 5 บาท (รางวัลปลอบใจ)";
    } else {
      if (finalTime === 5.0) return "🥈 ส่วนลด 20 บาท";
      if (diff <= 0.05) return "🥉 ส่วนลด 10 บาท";
      return "🏷️ ส่วนลด 5 บาท (รางวัลปลอบใจ)";
    }
  };

  // 2. ฟังก์ชันควบคุมการกดปุ่ม (Start / Stop)
  const handleAction = () => {
    if (gameState === "idle") {
      // กด START ครั้งแรกของรอบ
      setGameState("running");
      startTimeRef.current = Date.now() - time * 1000;
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setTime(elapsed);
      }, 10);
    } else if (gameState === "running") {
      // กด STOP (ได้รอบเดียวเท่านั้น)
      clearInterval(timerRef.current);
      setGameState("stopped");
      
      const currentAttempt = attempts + 1;
      setAttempts(currentAttempt);

      // บันทึกเวลาที่ดีที่สุด (สำหรับ Easy mode ที่เล่นได้ 3 ครั้ง)
      if (bestTime === null || Math.abs(time - 5.0) < Math.abs(bestTime - 5.0)) {
        setBestTime(time);
      }

      // ตรวจสอบเงื่อนไขการจบเกม
      if (mode === "hard" || currentAttempt >= 3) {
        const finalTimeResult = mode === "hard" ? time : (Math.abs(time - 5.0) < Math.abs(bestTime - 5.0) ? time : bestTime);
        setReward(calculateReward(finalTimeResult));
        setShowResult(true);
      }
    }
  };

  // 3. ฟังก์ชัน Reset สำหรับเริ่มรอบต่อไป (ใช้ใน Easy Mode)
  const handleReset = () => {
    setTime(0);
    setGameState("idle");
  };

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  // หน้าจอสรุปผลรางวัล (หลังเล่นเสร็จตามสิทธิ์)
  if (showResult) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>🎉 สรุปผลรางวัล 🎉</h2>
        <p style={{ color: "#888" }}>คุณ {member?.nickname} กดเวลาได้</p>
        <h1 style={styles.timeDisplay}>{(mode === 'hard' ? time : bestTime).toFixed(2)} วินาที</h1>
        
        <div style={styles.rewardCard}>
          <p style={{ fontSize: 12, color: "#666", margin: 0 }}>รางวัลที่ได้รับ</p>
          <h3 style={{ color: "#FF9F0A", margin: "8px 0 0 0" }}>{reward}</h3>
        </div>

        {/* ระบบป้องกันการแคปหน้าจอด้วยเวลานับถอยหลัง */}
        <CountdownTimer onExpire={() => onFinish()} />

        <button style={styles.btnStaff} onClick={() => onFinish()}>
          [ พนักงานกดเพื่อรับสิทธิ์ ]
        </button>
      </div>
    );
  }

  // หน้าจอเลือกโหมดเริ่มต้น
  if (!mode) {
    return (
      <div style={styles.container}>
        <h3 style={styles.subtitle}>ยินดีต้อนรับ คุณ {member?.nickname}</h3>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>กรุณาเลือกโหมดเพื่อเล่นเกม (เลือกได้ครั้งเดียว)</p>
        
        <div style={styles.modeCard} onClick={() => setMode("easy")}>
          <h4 style={{ color: "#4caf50", margin: 0 }}>🟢 โหมดง่าย (Easy)</h4>
          <p style={styles.modeDesc}>เห็นเวลาตลอด / เล่นได้ 3 ครั้ง / รางวัลสูงสุด ลด 20 บาท</p>
        </div>

        <div style={styles.modeCard} onClick={() => setMode("hard")}>
          <h4 style={{ color: "#FF9F0A", margin: 0 }}>🔴 โหมดเซียน (Hard)</h4>
          <p style={styles.modeDesc}>ซ่อนเวลาวินาทีที่ 3 / เล่นได้ครั้งเดียว / รางวัลสูงสุด ข้าวฟรี 1 เซ็ต!</p>
        </div>
      </div>
    );
  }

  // หน้าจอระหว่างการเล่นเกม (Gameplay)
  return (
    <div style={styles.container}>
      <p style={{ color: "#555", fontSize: 12 }}>
        โหมด: {mode === "easy" ? "Easy" : "Hard"} | สิทธิ์ที่ใช้ไปแล้ว: {attempts}/{mode === "easy" ? 3 : 1}
      </p>

      {/* จุดโฟกัสเวลาดิจิทัล */}
      <h1 style={styles.timer}>
        {gameState === "running" && mode === "hard" && time >= 3.0
          ? "?.??"
          : time.toFixed(2)}
      </h1>

      {/* ปุ่มหลัก: ควบคุมด้วย gameState */}
      {gameState !== "stopped" ? (
        <button
          style={{
            ...styles.circleBtn,
            background: gameState === "running" ? "#f44336" : "#FF9F0A",
          }}
          onClick={handleAction}
        >
          {gameState === "running" ? "STOP!!" : "START"}
        </button>
      ) : (
        // เมื่อกด Stop แล้ว ต้องกดปุ่ม RESET ก่อน ถึงจะไปต่อได้
        <button style={styles.btnReset} onClick={handleReset}>
          🔄 รีเซ็ตเพื่อเล่นรอบถัดไป
        </button>
      )}
    </div>
  );
}

// ส่วนประกอบนับถอยหลัง 5 นาทีป้องกันสิทธิ์เวียนเทียน
function CountdownTimer({ onExpire }) {
  const [seconds, setSeconds] = useState(300);
  useEffect(() => {
    if (seconds <= 0) { onExpire(); return; }
    const t = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <p style={{ color: "#ef5350", fontSize: 12, marginTop: 20 }}>
      ⚠️ กรุณายื่นให้พนักงานภายใน {m}:{s < 10 ? `0${s}` : s} นาที
    </p>
  );
}

const styles = {
  container: { background: "#0A0A0A", color: "#fff", padding: 20, textAlign: "center", minHeight: "80vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "bold" },
  subtitle: { fontSize: 16, margin: 0, color: "#fff" },
  timer: { fontSize: 64, fontFamily: "monospace", color: "#fff", margin: "40px 0" },
  timeDisplay: { fontSize: 36, color: "#fff", margin: "10px 0" },
  modeCard: { background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16, marginBottom: 12, width: "100%", maxWidth: 320, cursor: "pointer", textAlign: "left" },
  modeDesc: { color: "#888", fontSize: 12, margin: "6px 0 0 0" },
  circleBtn: { width: 120, height: 120, borderRadius: "50%", border: "none", color: "#fff", fontSize: 18, fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 15px rgba(0,0,0,0.5)" },
  btnReset: { background: "#222", border: "1px solid #333", color: "#fff", padding: "12px 24px", borderRadius: 8, fontSize: 14, cursor: "pointer" },
  rewardCard: { background: "#111", border: "1px solid #FF9F0A33", borderRadius: 12, padding: 20, width: "100%", maxWidth: 280, marginTop: 10 },
  btnStaff: { background: "#1a1a1a", border: "1px solid #333", color: "#666", padding: "10px 20px", borderRadius: 8, fontSize: 12, cursor: "pointer", marginTop: 10 }
};
          
