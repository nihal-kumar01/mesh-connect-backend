const WebSocket = require("ws");
const http = require("http");

const PORT = process.env.PORT || 3001;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let clients = {};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

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

  ws.send(JSON.stringify({ type: "init", id }));
  broadcastUserCount();

  ws.on("message", (message) => {
    let data;

    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    // 💬 CHAT
    if (data.type === "chat") {
      console.log("📤 Broadcast:", data.message);

      Object.keys(clients).forEach((clientId) => {
        if (
          clientId !== id &&
          clients[clientId]?.readyState === WebSocket.OPEN
        ) {
          clients[clientId].send(
            JSON.stringify({
              type: "chat",
              message: data.message,
              id: data.id,
            })
          );
        }
      });
    }

    // ✍️ TYPING
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
    }
  });

  ws.on("close", () => {
    delete clients[id];
    broadcastUserCount();
  });
});

server.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);
});