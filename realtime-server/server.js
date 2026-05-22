import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "gamezone-realtime" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

function roomSnapshot(roomId) {
  const room = rooms.get(roomId) || { players: new Map(), teamName: "" };
  return {
    roomId,
    teamName: room.teamName,
    players: [...room.players.values()]
  };
}

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ roomId, player }) => {
    if (!roomId || !player?.uid) return;
    if (!rooms.has(roomId)) rooms.set(roomId, { players: new Map(), teamName: "" });

    const room = rooms.get(roomId);
    room.players.set(socket.id, {
      uid: player.uid,
      name: player.name || "Player",
      team: player.team || "",
      joinedAt: Date.now()
    });
    socket.join(roomId);
    io.to(roomId).emit("roomState", roomSnapshot(roomId));
  });

  socket.on("playerState", ({ roomId, state }) => {
    if (!roomId) return;
    socket.to(roomId).emit("playerState", {
      socketId: socket.id,
      state,
      at: Date.now()
    });
  });

  socket.on("gameEvent", ({ roomId, event }) => {
    if (!roomId) return;
    socket.to(roomId).emit("gameEvent", {
      socketId: socket.id,
      event,
      at: Date.now()
    });
  });

  socket.on("teamChat", ({ roomId, message, player }) => {
    if (!roomId || !message) return;
    io.to(roomId).emit("teamChat", {
      from: player?.name || "Player",
      message: String(message).slice(0, 500),
      at: Date.now()
    });
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id || !rooms.has(roomId)) continue;
      const room = rooms.get(roomId);
      room.players.delete(socket.id);
      socket.to(roomId).emit("roomState", roomSnapshot(roomId));
      if (!room.players.size) rooms.delete(roomId);
    }
  });
});

const port = process.env.PORT || 4000;
server.listen(port, () => {
  console.log(`GameZone realtime server listening on ${port}`);
});
