import React, { useMemo, useState } from "react";

export default function Dashboard({ orders, setOrders, onCloseDay, onUpdateActual }) {

  const [actualInputs, setActualInputs] = useState({}); // ✅ เก็บค่า input แบบ React state

  const getChannelColor = (ch) => {
    const colors = { pos: "#ffffff", grab: "#00B14F", lineman: "#00A84F", shopee: "#EE4D2D" };
    return colors[ch] || "#888";
  };

  const pendingOrders = orders.filter(o =>
    !o.isSettled && ["grab", "lineman", "shopee"].includes(o.channel)
  );

  const handleUpdateActual = (orderId) => {
    const amount = parseFloat(actualInputs[orderId]) || 0;

    if (onUpdateActual) {
      onUpdateActual(orderId, amount);
    } else if (setOrders) {
      setOrders(orders.map(o =>
        o.id === orderId
          ? { ...o, actualAmount: amount, isSettled: true }
          : o
      ));
    }

    setActualInputs(prev => ({ ...prev, [orderId]: "" }));
  };

  const exportToCSV = (data, fileName) => {
    if (!data || data.length === 0) {
      alert("ไม่มีข้อมูลให้ Export ครับ");
      return;
    }

    const headers = ["วันที่/เวลา", "เลขอ้างอิง", "ช่องทาง", "รายการสินค้า", "ยอดรวมเมนู", "ยอดรับจริง", "ประเภทชำระเงิน"];

    const rows = data.map(o => {
      const itemsSummary = o.items.map(i => `${i.name}x${i.qty}`).join(" | ");
      return [
        new Date(o.time).toLocaleString("th-TH"),
        `"${o.refId || "-"}"`,
        o.channel.toUpperCase(),
        `"${itemsSummary}"`,
        o.total,
        o.actualAmount || 0,
        o.payment === "cash" ? "เงินสด" : "โอน/App"
      ];
    });

    const csvContent =
      "\uFEFF" +
      [headers, ...rows].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `${fileName}_${new Date().toLocaleDateString("th-TH")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    let totalSales = 0,
      cashTotal = 0,
      promptPayTotal = 0,
      actualIncome = 0;

    const channelMap = {};

    orders.forEach(o => {
      totalSales += o.total;
      actualIncome += (o.actualAmount || 0);

      if (!channelMap[o.channel]) {
        channelMap[o.channel] = {
          total: 0,
          actual: 0,
          cash: 0,
          transfer: 0
        };
      }

      channelMap[o.channel].total += o.total;
      channelMap[o.channel].actual += (o.actualAmount || 0);

      if (o.payment === "cash") {
        cashTotal += (o.actualAmount || 0);
        channelMap[o.channel].cash += (o.actualAmount || 0);
      } else {
        promptPayTotal += (o.actualAmount || 0);
        channelMap[o.channel].transfer += (o.actualAmount || 0);
      }
    });

    return {
      totalSales,
      cashTotal,
      promptPayTotal,
      actualIncome,
      channelMap,
      orderCount: orders.length
    };
  }, [orders]);

  return (
    <div style={{ padding: 16, color: "#fff", background: "#121212", minHeight: "100vh" }}>

      <h2>LIVE DASHBOARD</h2>

      {/* Pending Section */}
      <div style={{ marginTop: 20 }}>
        <h4>⚠️ งานค้าง ({pendingOrders.length})</h4>

        {pendingOrders.length === 0 && (
          <div style={{ color: "#555" }}>🎉 เคลียร์ยอดครบแล้ว</div>
        )}

        {pendingOrders.map(o => (
          <div key={o.id} style={{ marginBottom: 10, padding: 10, background: "#1a1a1a" }}>
            <div>
              <b style={{ color: getChannelColor(o.channel) }}>
                {o.channel.toUpperCase()}
              </b>{" "}
              {o.refId && `(${o.refId})`}
            </div>

            <div style={{ fontSize: 12 }}>
              ฿{o.total.toLocaleString()}
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input
                type="number"
                value={actualInputs[o.id] || ""}
                onChange={(e) =>
                  setActualInputs(prev => ({
                    ...prev,
                    [o.id]: e.target.value
                  }))
                }
                placeholder="ยอดจริง"
              />
              <button onClick={() => handleUpdateActual(o.id)}>
                ✓
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}