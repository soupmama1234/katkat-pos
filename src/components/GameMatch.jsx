import React, { useState, useEffect, useRef } from "react";
import Confetti from "react-confetti";
import "./gameMatch.css";

let audioCtx = null; // สร้างตัวแปรรอไว้นอกฟังก์ชัน
let globalAudioCtx = null; // สร้างตัวแปรส่วนกลางสแตนด์บายไว้ข้างนอกสุด

const playSound = (type, isMuted) => {
  if (isMuted || !globalAudioCtx) return; // ถ้าปิดเสียง หรือยังไม่ได้ปลดล็อก จะไม่ทำงาน
  
  try {
    // หากเบราว์เซอร์สั่งพักเสียง ให้ปลุกขึ้นมาทำงานก่อน
    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume();
    }
    
    const ctx = globalAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    switch (type) {
      case 'beep':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
        break;

      case 'go':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
        break;

      case 'stop':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
        break;

      case 'perfect':
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
        break;
    }
  } catch (e) {
    console.error("Audio error:", e);
  }
};


                                      
export default function GameMatch({ member, onFinish }) {
  const [mode, setMode] = useState(null); // null, 'easy', 'hard'
  const [gameState, setGameState] = useState("idle"); // 'idle', 'running', 'stopped'
  const [time, setTime] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [bestTime, setBestTime] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [stopImpact, setStopImpact] = useState(false);
  const [resultStep, setResultStep] = useState(0);
  const [finalResult, setFinalResult] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [isMuted, setIsMuted] = useState(false);
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const unlockAudio = () => {
  if (!globalAudioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      globalAudioCtx = new AudioContext();
    }
  }
};
  
  const isPerfectHit = (time) => {
  return Number(time.toFixed(2)) === 5.00;
  };

  const getRank = (finalTime) => {
    const diff = Math.abs(finalTime - 5);

    if (isPerfectHit(finalTime)) return "GOD";
    if (diff <= 0.03) return "SSS";
    if (diff <= 0.05) return "SS";
    if (diff <= 0.1) return "S";
    if (diff <= 0.2) return "A";
    if (diff <= 0.3) return "B";
    return "C";
  };

  const getCombo = (finalTime) => {
    const diff = Math.abs(finalTime - 5);

    if (isPerfectHit(finalTime)) return "🏆 PERFECT HIT";
    if (diff <= 0.03) return "⚡ PERFECT ZONE";
    if (diff <= 0.1) return "🔥 NEAR MISS";
    if (diff <= 0.2) return "🎯 GREAT TRY";
    return "💪 TRY AGAIN";
  };

  const calculateReward = (finalTime) => {
    const diff = Math.abs(finalTime - 5.0);

    if (mode === "hard") {
      if (isPerfectHit(finalTime)) return "🏆 ข้าวฟรี 1 SET (มูลค่า 70 บาท)";
      return "🥉 ส่วนลด 5 บาท (รางวัลปลอบใจ)";
    }

    if (isPerfectHit(finalTime)) return "🥈 ส่วนลด 20 บาท";
    if (diff <= 0.05) return "🥉 ส่วนลด 10 บาท";
    return "🏷️ ส่วนลด 5 บาท (รางวัลปลอบใจ)";
  };

  const startCountdown = () => {
    setCountdown(3);
    playSound('beep', isMuted);
    let current = 3;

    const interval = setInterval(() => {
      current -= 1;

      if (current > 0) {
        setCountdown(current);
        playSound('beep', isMuted);
        return;
      }

      setCountdown("GO!");
      playSound('go', isMuted);
      
      setTimeout(() => {
        setCountdown(null);
        setGameState("running");
        startTimeRef.current = Date.now();

        timerRef.current = setInterval(() => {
          setTime((Date.now() - startTimeRef.current) / 1000);
        }, 10);
      }, 500);

      clearInterval(interval);
    }, 1000);
  };

  const triggerStopImpact = () => {
    setStopImpact(true);
    setTimeout(() => setStopImpact(false), 350);
  };

  const handleAction = () => {
    if (gameState === "idle") {
      startCountdown();
      return;
    }

    if (gameState === "running") {
      clearInterval(timerRef.current);
      triggerStopImpact();
      setGameState("stopped");
      playSound('stop', isMuted);
      
      const currentAttempt = attempts + 1;
      setAttempts(currentAttempt);

      const nextBestTime =
        bestTime === null || Math.abs(time - 5.0) < Math.abs(bestTime - 5.0)
          ? time
          : bestTime;
      setBestTime(nextBestTime);

      if (mode === "hard" || currentAttempt >= 3) {
        const finalTimeResult = mode === "hard" ? time : nextBestTime;
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

  const handleReset = () => {
    setTime(0);
    setGameState("idle");
  };

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (!showResult) return;

    const timers = [];

    if (finalResult && isPerfectHit(finalResult.time)) {
      playSound('perfect', isMuted);
      timers.push(setTimeout(() => setShowConfetti(true), 0));
      timers.push(setTimeout(() => setShowConfetti(false), 2000));
    }

    timers.push(setTimeout(() => setResultStep(1), 0));
    timers.push(setTimeout(() => setResultStep(2), 200));
    timers.push(setTimeout(() => setResultStep(3), 400));
    timers.push(setTimeout(() => setResultStep(4), 700));
    timers.push(setTimeout(() => setResultStep(5), 1000));

    return () => timers.forEach(clearTimeout);
  }, [showResult, finalResult]);

  // ฟังก์ชัน render ปุ่มเปิด-ปิดเสียง (สไตล์ลอยมุมขวาบน)
  const renderMuteButton = () => (
    <button 
      onClick={() => setIsMuted(!isMuted)} 
      style={styles.muteBtn}
      title={isMuted ? "เปิดเสียง" : "ปิดเสียง"}
    >
      {isMuted ? "🔇" : "🔊"}
    </button>
  );
  
  if (showResult) {
    return (
      <>
        {showConfetti && <Confetti recycle={false} numberOfPieces={250} gravity={0.25} />}
        <div style={styles.container}>
          {renderMuteButton()}
          <h2 style={styles.title}>🎉 สรุปผลรางวัล 🎉</h2>
          <p style={{ color: "#888" }}>คุณ {member?.nickname} กดเวลาได้</p>

          {/* แสดงเวลาผลลัพธ์ทันที */}
          <h1 style={styles.timeDisplay}>{finalResult?.time?.toFixed(2)}</h1>
        
          {/* แสดงจำนวนวินาทีที่พลาดทันที */}
          <div
            style={{
              ...styles.diffBox,
              color: finalResult?.diff?.toFixed(2) === "0.00" ? "#00ff88" : "#bbb",
            }}
          >
            พลาดเป้าหมายเพียง
            <br />
            <strong>
              {finalResult?.diff?.toFixed(2)} วินาที
            </strong>
          </div>

          {/* แสดงเกรด/Rank ทันที */}
          <div
            style={{
              ...styles.rankBox,
              color: finalResult?.rank === "GOD" ? "#FF9F0A" : "#FFD60A",
            }}
          >
            {finalResult?.rank}
          </div>

          {/* แสดงข้อความ Combo ทันที */}
          <div style={styles.comboBox}>
            {finalResult?.combo}
          </div>

          {/* แสดงการ์ดของรางวัลทันที */}
          <div style={styles.rewardCard}>
            <p style={{ fontSize: 12, color: "#666" }}>รางวัลที่ได้รับ</p>
            <h2 style={{ color: "#FF9F0A", margin: 0 }}>{finalResult?.reward}</h2>
          </div>

          <CountdownTimer onExpire={onFinish} />
          <button style={styles.btnStaff} onClick={onFinish}>
            [ พนักงานกดเพื่อรับสิทธิ์ ]
          </button>
        </div>
      </>
    );
  }

  if (!mode) {
    return (
      <div style={styles.container}>
        {renderMuteButton()}
        <h3 style={styles.subtitle}>ยินดีต้อนรับ คุณ {member?.nickname}</h3>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
          กรุณาเลือกโหมดเพื่อเล่นเกม (เลือกได้ครั้งเดียว)
        </p>

                {/* โหมดง่าย (Easy) */}
        <div 
          style={styles.modeCard} 
          className="mode-card-easy" 
          onClick={() => {
            unlockAudio();
            setMode("easy");
          }}
        > 
          <h4 style={{ color: "#4caf50", margin: 0 }}>🟢 โหมดง่าย (Easy)</h4>
          <p style={styles.modeDesc}>เห็นเวลาตลอด / เล่นได้ 3 ครั้ง / รางวัลสูงสุด ลด 20 บาท</p>
        </div>

        {/* โหมดเซียน (Hard) */}
        <div 
          style={styles.modeCard} 
          className="mode-card-hard" 
          onClick={() => {
            unlockAudio();
            setMode("hard");
          }}
        > 
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
        {renderMuteButton()}
        <div style={styles.countdownWrap}>
          {/* เพิ่ม key={countdown} เพื่อให้แอนิเมชัน countPop เล่นใหม่ทุกตัวเลข */}
          <div
            key={countdown} 
            style={{
              ...styles.countdownText,
              color: countdown === "GO!" ? "#FF9F0A" : "#ffffff",
              // เพิ่มขนาดความอลังการตามสเต็ป: เลข 3 เล็กสุด -> GO! ใหญ่สุด
              transform: countdown === "3" ? "scale(0.9)" : countdown === "2" ? "scale(1)" : countdown === "1" ? "scale(1.15)" : "scale(1.3)"
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
      {stopImpact && <div style={styles.flashOverlay} />}
      <div style={styles.container}>
        {renderMuteButton()}
        <p style={{ color: "#555", fontSize: 12 }}>
          โหมด: {mode === "easy" ? "Easy" : "Hard"} | สิทธิ์ที่ใช้ไปแล้ว: {attempts}/{mode === "easy" ? 3 : 1}
        </p>

        <h1
          style={{
            ...styles.timer,
            color: getTimerColor(),
            animation: stopImpact ? "stopPulse .35s ease" : "none",
            transition: "all .25s ease",
          }}
        >
          {gameState === "running" && mode === "hard" && time >= 3.0 ? "■■■■" : time.toFixed(2)}
        </h1>

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
          <button style={styles.btnReset} onClick={handleReset}>
            🔄 รีเซ็ตเพื่อเล่นรอบถัดไป
          </button>
        )}
      </div>
    </>
  );
}

function CountdownTimer({ onExpire }) {
  const [seconds, setSeconds] = useState(300);

  useEffect(() => {
    if (seconds <= 0) {
      onExpire();
      return;
    }

    const t = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, onExpire]);

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
  muteBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    background: "rgba(255,255,255,0.05)",
    borderRadius: "50%",
    width: 44,
    height: 44,
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  },
  title: { fontSize: 20, fontWeight: "bold" },
  subtitle: { fontSize: 16, margin: 0, color: "#fff" },
      timer: {
    fontSize: "clamp(90px, 20vw, 140px)",
    // เพิ่ม monospace สำรองไว้ และบังคับใช้ตัวเลขกว้างเท่ากัน (tabular-nums)
    fontFamily: "'Rajdhani', monospace, sans-serif",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "2px",
    margin: "30px 0",
    textShadow: "0 0 25px rgba(255,255,255,0.2)",
    animation: "breathe 1.4s ease-in-out infinite",
  },
  timeDisplay: {
    fontSize: "clamp(48px, 10vw, 72px)",
    fontFamily: "'Rajdhani', monospace, sans-serif",
    fontVariantNumeric: "tabular-nums",
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
  btnReset: {
    background: "#222",
    border: "1px solid #333",
    color: "#fff",
    padding: "12px 24px",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  },
  rewardCard: {
    background: "#111",
    border: "1px solid #FF9F0A33",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 280,
    marginTop: 10,
  },
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
    marginTop: 15,
    fontFamily: "'Rajdhani', sans-serif",
  },
  comboBox: {
    fontSize: 22,
    marginTop: 10,
    color: "#ffffff",
  },
  btnStaff: {
    background: "#1a1a1a",
    border: "1px solid #333",
    color: "#666",
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 12,
    cursor: "pointer",
    marginTop: 10,
  },
};
