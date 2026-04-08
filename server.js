const WebSocket = require("ws");
const http = require("http");

const PORT = process.env.PORT || 3001;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let clients = {};

// 🔑 Generate unique ID
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

wss.on("connection", (ws) => {
  const id = generateId();
  clients[id] = ws;

  console.log("🟢 New client:", id);

  // 🆔 Send own ID
  ws.send(JSON.stringify({ type: "init", id }));

  // 👥 Send existing peers
  ws.send(
    JSON.stringify({
      type: "peers",
      peers: Object.keys(clients).filter((c) => c !== id),
    })
  );

  // 🆕 Notify all other peers
  Object.keys(clients).forEach((clientId) => {
    if (
      clientId !== id &&
      clients[clientId]?.readyState === WebSocket.OPEN
    ) {
      clients[clientId].send(
        JSON.stringify({
          type: "new-peer",
          peerId: id,
        })
      );
    }
  });

  // 📩 Handle incoming messages
  ws.on("message", (message) => {
    let data;

    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log("❌ Invalid JSON received");
      return;
    }

    console.log("📩 Incoming:", data.type, "from", id);

    // 🟢 👉 BROADCAST MODE (NEW)
    if (data.type === "chat") {
      Object.keys(clients).forEach((clientId) => {
        if (
          clientId !== id &&
          clients[clientId]?.readyState === WebSocket.OPEN
        ) {
          clients[clientId].send(
            JSON.stringify({
              type: "chat",
              from: id,
              message: data.message,
            })
          );
        }
      });
      return;
    }

    // 🔁 Peer-to-peer relay (keep this for WebRTC if needed)
    if (data.to && clients[data.to]) {
      if (clients[data.to].readyState === WebSocket.OPEN) {
        clients[data.to].send(
          JSON.stringify({
            ...data,
            from: id,
          })
        );
      }
    } else {
      console.log("⚠️ Target not found:", data.to);
    }
  });

  // 🔴 Handle disconnect
  ws.on("close", () => {
    console.log("🔴 Disconnected:", id);

    delete clients[id];

    Object.keys(clients).forEach((clientId) => {
      if (clients[clientId]?.readyState === WebSocket.OPEN) {
        clients[clientId].send(
          JSON.stringify({
            type: "peer-disconnected",
            peerId: id,
          })
        );
      }
    });
  });

  ws.on("error", (err) => {
    console.log("❌ Socket error:", err.message);
  });
});

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});