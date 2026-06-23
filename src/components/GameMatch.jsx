import React, { useState, useEffect, useRef } from "react";
import React, { useState, useEffect, useRef } from "react";
import Confetti from "react-confetti";
import "./gameMatch.css";

export default function GameMatch({ member, onFinish }) {
  const [mode, setMode] = useState(null); // null, 'easy', 'hard'
  const [gameState, setGameState] = useState("idle"); // 'idle', 'running', 'stopped'
  const [time, setTime] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [bestTime, setBestTime] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [reward, setReward] = useState("");
  const [countdown, setCountdown] = useState(null);
  const [stopImpact, setStopImpact] = useState(false);
  const [resultStep, setResultStep] = useState(0);
  const [finalResult, setFinalResult] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const timerRef = useRef(null);
  const startTimeRef = useRef(0);

  const getRank = (finalTime) => {
  const diff = Math.abs(finalTime - 5);

  if (diff === 0) return "GOD";
  if (diff <= 0.03) return "SSS";
  if (diff <= 0.05) return "SS";
  if (diff <= 0.10) return "S";
  if (diff <= 0.20) return "A";
  if (diff <= 0.30) return "B";

  return "C";
};

  const getCombo = (finalTime) => {
  const diff = Math.abs(finalTime - 5);

  if (diff === 0) return "🏆 PERFECT HIT";
  if (diff <= 0.03) return "⚡ PERFECT ZONE";
  if (diff <= 0.10) return "🔥 NEAR MISS";
  if (diff <= 0.20) return "🎯 GREAT TRY";

  return "💪 TRY AGAIN";
};

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

  const startCountdown = () => {
  setCountdown(3);

  let current = 3;

  const interval = setInterval(() => {
    current--;

    if (current > 0) {
      setCountdown(current);
      return;
    }

    if (current === 0) {
      setCountdown("GO!");

      setTimeout(() => {
        setCountdown(null);

        setGameState("running");

        startTimeRef.current = Date.now();

        timerRef.current = setInterval(() => {
          const elapsed =
            (Date.now() - startTimeRef.current) / 1000;

          setTime(elapsed);
        }, 10);
      }, 500);

      clearInterval(interval);
    }
  }, 1000);
};

  const triggerStopImpact = () => {
  setStopImpact(true);

  setTimeout(() => {
    setStopImpact(false);
  }, 350);
};

  // 2. ฟังก์ชันควบคุมการกดปุ่ม (Start / Stop)
  const handleAction = () => {
    if (gameState === "idle") {
  startCountdown();
}
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
      triggerStopImpact();
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
        setFinalResult({
         time: finalTimeResult,
         diff: Math.abs(finalTimeResult - 5),
          rank: getRank(finalTimeResult),
         combo: getCombo(finalTimeResult),
         reward: calculateReward(finalTimeResult),
        });

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

  useEffect(() => {
  if (!showResult) return;

  if (finalResult?.diff === 0) {
    setShowConfetti(true);

    setTimeout(() => {
    setShowConfetti(false);
  }, 2000);
}

  setResultStep(1);

  setTimeout(() => setResultStep(2), 200);
  setTimeout(() => setResultStep(3), 400);
  setTimeout(() => setResultStep(4), 700);
  setTimeout(() => setResultStep(5), 1000);

}, [showResult, finalResult]);

  // หน้าจอสรุปผลรางวัล (หลังเล่นเสร็จตามสิทธิ์)
  if (showResult) {
    return (
      <>
       {showConfetti && (<Confetti recycle={false} numberOfPieces={250} gravity={0.25}/>)}
      <div style={styles.container}>
        <h2 style={styles.title}>🎉 สรุปผลรางวัล 🎉</h2>
        <p style={{ color: "#888" }}>คุณ {member?.nickname} กดเวลาได้</p>
        {resultStep >= 1 && (
        <h1 style={styles.timeDisplay}>
          {finalResult?.time?.toFixed(2)}
        </h1>
        )}

{resultStep >= 2 && (
  <div style={styles.diffBox}>
    พลาดเป้าหมายเพียง
    <br />
    <strong>
      {finalResult?.diff?.toFixed(2)} วินาที
    </strong>
  </div>
)}

{resultStep >= 3 && (
  <div
  style={{
    ...styles.rankBox,
    color:
      finalResult?.rank === "GOD"
        ? "#FF9F0A"
        : "#FFD60A",
  }}
>
    {finalResult?.rank}
  </div>
)}

{resultStep >= 4 && (
  <div
  style={{
    ...styles.comboBox,
    fontSize:
      finalResult?.diff === 0
        ? 32
        : 22,
  }}
>
    {finalResult?.combo}
  </div>
)}

{resultStep >= 5 && (
  <div style={styles.rewardCard}>
    <p style={{ fontSize: 12, color: "#666" }}>
      รางวัลที่ได้รับ
    </p>

    <h2
      style={{
        color: "#FF9F0A",
        margin: 0,
      }}
    >
      {finalResult?.reward}
    </h2>
  </div>
)}

        {/* ระบบป้องกันการแคปหน้าจอด้วยเวลานับถอยหลัง */}
        <CountdownTimer onExpire={() => onFinish()} />

        <button style={styles.btnStaff} onClick={() => onFinish()}>
          [ พนักงานกดเพื่อรับสิทธิ์ ]
        </button>
      </div>
      </>
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
  
  const getTimerColor = () => {
  if (time >= 4.95) return "#ff3b30";
  if (time >= 4.8) return "#ff9f0a";
  if (time >= 4.5) return "#ffd60a";
  return "#ffffff";
};

  if (countdown !== null) {
  return (
    <div style={styles.container}>
      <div style={styles.countdownWrap}>
        <div
          style={{
            ...styles.countdownText,
            color:
              countdown === "GO!"
                ? "#00ff88"
                : "#ffffff",
          }}
        >
          {countdown}
        </div>
      </div>
    </div>
  );
}

return (
  <>
  {stopImpact && (
    <div style={styles.flashOverlay} />
  )}
  
  {/* หน้าจอระหว่างการเล่นเกม (Gameplay) */}
  
    <div style={styles.container}>
      <p style={{ color: "#555", fontSize: 12 }}>
        โหมด: {mode === "easy" ? "Easy" : "Hard"} | สิทธิ์ที่ใช้ไปแล้ว: {attempts}/{mode === "easy" ? 3 : 1}
      </p>

      {/* จุดโฟกัสเวลาดิจิทัล */}
      <h1
  style={{
    ...styles.timer,
    color: getTimerColor(),
    animation:
      stopImpact
        ? "stopPulse .35s ease"
        : "none",
    transition: "all .25s ease",
  }}
>
  {gameState === "running" && mode === "hard" && time >= 3.0
    ? "■■■■"
    : time.toFixed(2)}
</h1>

      {/* ปุ่มหลัก: ควบคุมด้วย gameState */}
      {gameState !== "stopped" ? (
        <button
          style={{
  ...styles.f1Button,
  background:
    gameState === "running"
      ? "linear-gradient(135deg,#ff3b30,#c62828)"
      : "linear-gradient(135deg,#ffb347,#ff9f0a)",
}}
          onClick={handleAction}
        >
          {gameState === "running" ? "STOP!!" : "START"}
        </button>
      ) : (
        
        {/* เมื่อกด Stop แล้ว ต้องกดปุ่ม RESET ก่อน ถึงจะไปต่อได้ */}
        <button style={styles.btnReset} onClick={handleReset}>
          🔄 รีเซ็ตเพื่อเล่นรอบถัดไป
        </button>
      )}
    </div>
    </>
  );


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
  container: {
  color: "#fff",
  padding: 20,
  textAlign: "center",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "#0A0A0A",
  backgroundImage: `
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
  `,
  backgroundSize: "24px 24px",
},
  title: { fontSize: 20, fontWeight: "bold" },
  subtitle: { fontSize: 16, margin: 0, color: "#fff" },
  timer: {
  fontSize: "clamp(90px,20vw,140px)",
  fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 700,
  letterSpacing: "4px",
  margin: "30px 0",
  textShadow: "0 0 25px rgba(255,255,255,0.2)",
  animation: "breathe 1.4s ease-in-out infinite",
},
  timeDisplay: {
  fontSize: "clamp(48px,10vw,72px)",
  fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 700,
},
  modeCard: {
  background: "#121212",
  border: "1px solid #2b2b2b",
  borderRadius: 16,
  padding: 18,
  marginBottom: 14,
  width: "100%",
  maxWidth: 360,
  cursor: "pointer",
  textAlign: "left",
  transition: "all .2s ease",
},
  modeDesc: { color: "#888", fontSize: 12, margin: "6px 0 0 0" },
  circleBtn: { width: 120, height: 120, borderRadius: "50%", border: "none", color: "#fff", fontSize: 18, fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 15px rgba(0,0,0,0.5)" },
  btnReset: { background: "#222", border: "1px solid #333", color: "#fff", padding: "12px 24px", borderRadius: 8, fontSize: 14, cursor: "pointer" },
  rewardCard: { background: "#111", border: "1px solid #FF9F0A33", borderRadius: 12, padding: 20, width: "100%", maxWidth: 280, marginTop: 10 },
  f1Button: {
  width: 240,
  height: 72,
  border: "none",
  borderRadius: 18,
  color: "#fff",
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: "2px",
  cursor: "pointer",
  boxShadow: "0 8px 25px rgba(0,0,0,0.45)",
  textTransform: "uppercase",
},
  countdownWrap: {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
},
  countdownText: {
  fontSize: "clamp(120px,30vw,220px)",
  fontWeight: 800,
  fontFamily: "'Rajdhani', sans-serif",
  textShadow: "0 0 30px rgba(255,255,255,.35)",
  animation: "countPop .9s ease forwards",
},
  flashOverlay: {
  position: "fixed",
  inset: 0,
  background: "#ffffff",
  opacity: 0.18,
  pointerEvents: "none",
  zIndex: 999,
},
  diffBox: {
  marginTop: 12,
  color: "#bbb",
  fontSize: 15,
},
  rankBox: {
  fontSize: 48,
  fontWeight: 800,
  color:finalResult?.rank === "GOD"
    ? "#FF9F0A"
    : "#FFD60A",
  marginTop: 15,
  fontFamily: "'Rajdhani', sans-serif",
},
  comboBox: {
  fontSize: 22,
  marginTop: 10,
  color: "#ffffff",
},
  btnStaff: { background: "#1a1a1a", border: "1px solid #333", color: "#666", padding: "10px 20px", borderRadius: 8, fontSize: 12, cursor: "pointer", marginTop: 10 }
};
          
