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

// 👥 Broadcast user count
function broadcastUserCount() {
  const count = Object.keys(clients).length;

  Object.values(clients).forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "users-count",
          count,
        })
      );
    }
  });
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

  // 🆕 Notify others
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

  // 👥 Update user count
  broadcastUserCount();

  // 📩 Handle messages
  ws.on("message", (message) => {
    let data;

    try {
      data = JSON.parse(message);
    } catch {
      console.log("❌ Invalid JSON");
      return;
    }

    console.log("📩", data.type, "from", id);

    // 💬 CHAT (FIXED WITH ID)
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
              id: data.id, // ✅ CRITICAL FIX
            })
          );
        }
      });
      return;
    }

    // ✍️ TYPING (NEW)
    if (data.type === "typing") {
      Object.keys(clients).forEach((clientId) => {
        if (
          clientId !== id &&
          clients[clientId]?.readyState === WebSocket.OPEN
        ) {
          clients[clientId].send(
            JSON.stringify({
              type: "typing",
            })
          );
        }
      });
      return;
    }

    // 🔁 WebRTC signaling relay
    if (data.to && clients[data.to]) {
      if (clients[data.to].readyState === WebSocket.OPEN) {
        clients[data.to].send(
          JSON.stringify({
            ...data,
            from: id,
          })
        );
      }
    }
  });

  // 🔴 Disconnect
  ws.on("close", () => {
    console.log("🔴 Disconnected:", id);

    delete clients[id];

    // notify peers
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

    // 👥 update count
    broadcastUserCount();
  });

  ws.on("error", (err) => {
    console.log("❌ Socket error:", err.message);
  });
});

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});