import express from "express";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import cors from "cors";
import {
  initDatabase,
  registerUser,
  loginUser,
  getUserByToken,
  createRoomStore,
  getRoom,
  getAllRooms,
  getRecentActiveRooms,
  deleteRoom,
} from "./store.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const PORT = process.env.PORT || 3000;
const HYPERBEAM_API_KEY = process.env.HYPERBEAM_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Servir o SDK do Hyperbeam compilado como ES Module nativo
app.get("/hyperbeam.js", async (req, res) => {
  try {
    const filePath = path.resolve(__dirname, "node_modules", "@hyperbeam", "web", "dist", "index.js");
    const content = await fs.promises.readFile(filePath, "utf-8");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.send(content);
  } catch (err) {
    res.status(500).send("// Error loading hyperbeam SDK: " + err.message);
  }
});

// Middleware de Autenticação
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Token não fornecido." });
  }

  const token = authHeader.split(" ")[1];
  const user = getUserByToken(token);

  if (!user) {
    return res.status(401).json({ success: false, error: "Sessão inválida ou expirada." });
  }

  req.user = user;
  req.token = token;
  next();
}

// ----------------------------------------------------
// ROTAS DE AUTENTICAÇÃO (Apenas Nickname e Senha)
// ----------------------------------------------------

// Cadastro: apenas nickname e senha
app.post("/api/auth/register", async (req, res) => {
  try {
    const { nickname, password } = req.body || {};

    if (!nickname || typeof nickname !== "string" || nickname.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "O Nickname deve ter no mínimo 2 caracteres.",
      });
    }

    if (nickname.trim().length > 24) {
      return res.status(400).json({
        success: false,
        error: "O Nickname deve ter no máximo 24 caracteres.",
      });
    }

    if (!password || typeof password !== "string" || password.length < 4) {
      return res.status(400).json({
        success: false,
        error: "A senha deve ter no mínimo 4 caracteres.",
      });
    }

    const { token, user } = await registerUser(nickname, password);
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Login: apenas nickname e senha
app.post("/api/auth/login", async (req, res) => {
  try {
    const { nickname, password } = req.body || {};

    if (!nickname || !password) {
      return res.status(400).json({
        success: false,
        error: "Informe o nickname e a senha.",
      });
    }

    const { token, user } = await loginUser(nickname, password);
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// Perfil atual
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: { id: req.user.id, nickname: req.user.nickname },
  });
});

// ----------------------------------------------------
// ROTAS DE SALAS VIRTUAIS (Hyperbeam)
// ----------------------------------------------------

function generateRoomCode() {
  // Código limpo e legível de 6 caracteres alfanuméricos em caixa alta (ex: 7X9K2M)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function requestHyperbeamVM(startUrl = "https://www.youtube.com", retries = 2) {
  if (!HYPERBEAM_API_KEY) {
    throw new Error(
      "A chave HYPERBEAM_API_KEY não foi configurada no servidor. Obtenha uma chave em https://hyperbeam.com e adicione nas variáveis de ambiente."
    );
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch("https://engine.hyperbeam.com/v0/vm", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HYPERBEAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start_url: startUrl,
        kiosk: false,
        ublock: true, // Bloqueio nativo de anúncios, pop-ups invasivos e scripts maliciosos (uBlock Origin)
        timeout: {
          offline: 300, // Desliga 5 minutos após o último sair para economizar recursos
          warning: 60,
        },
      }),
    });

    if (response.ok) {
      return await response.json();
    }

    if (response.status === 429) {
      if (attempt < retries) {
        console.warn(`[Hyperbeam 429]: Aguardando 3 segundos antes da tentativa ${attempt + 1}...`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw new Error(
        "Limite temporário atingido: O provedor Hyperbeam limita a criação de muitas máquinas virtuais em sequência no plano gratuito. Aguarde cerca de 1 a 2 minutos para criar outra sala, ou entre em uma das salas já criadas!"
      );
    }

    const errorText = await response.text();
    throw new Error(`Erro na API Hyperbeam (${response.status}): ${errorText}`);
  }
}

// Criar nova sala
app.post("/api/rooms", authMiddleware, async (req, res) => {
  try {
    let { startUrl } = req.body || {};
    startUrl = startUrl?.trim() || "https://www.youtube.com";

    // Se for um link de streaming HLS (.m3u8), envelopa com o player HTML5 interno com hls.js
    if (startUrl.toLowerCase().includes(".m3u8")) {
      const host = req.get("host");
      const protocol =
        req.headers["x-forwarded-proto"] === "https" || req.protocol === "https"
          ? "https"
          : "http";
      startUrl = `${protocol}://${host}/player.html?src=${encodeURIComponent(startUrl)}`;
    }

    let code = generateRoomCode();

    // Garante código único
    while (await getRoom(code)) {
      code = generateRoomCode();
    }

    const vm = await requestHyperbeamVM(startUrl);

    const room = await createRoomStore(code, {
      hostNickname: req.user.nickname,
      sessionId: vm.session_id,
      embedUrl: vm.embed_url,
      adminToken: vm.admin_token,
    });

    console.log(`[Sala Criada] Código: ${code} por ${req.user.nickname}`);

    res.status(201).json({
      success: true,
      code: room.code,
      embedUrl: room.embedUrl,
      hostNickname: room.hostNickname,
    });
  } catch (err) {
    console.error("[Erro ao criar sala]:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

function sanitizeRoomCode(raw) {
  if (!raw) return "";
  let str = String(raw).trim();
  const roomPathMatch = str.match(/room\/([A-Za-z0-9]+)/i);
  if (roomPathMatch && roomPathMatch[1]) {
    return roomPathMatch[1].trim().toUpperCase();
  }
  try {
    const fullUrl = str.includes("://") ? str : "https://" + str;
    const url = new URL(fullUrl);
    const qRoom = url.searchParams.get("room");
    if (qRoom) return qRoom.trim().toUpperCase().replace(/[^A-Za-z0-9]/g, "");
  } catch (e) {}
  return str.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

// Buscar sala pelo código via query param ou URL
app.get("/api/rooms", authMiddleware, async (req, res) => {
  const rawCode = req.query.code;
  if (!rawCode) {
    return res.status(400).json({ success: false, error: "Código da sala não fornecido." });
  }
  return handleRoomLookup(rawCode, req, res);
});

// Buscar sala pelo código
app.get("/api/rooms/:code", authMiddleware, async (req, res) => {
  return handleRoomLookup(req.params.code, req, res);
});

async function handleRoomLookup(rawCode, req, res) {
  const code = sanitizeRoomCode(rawCode);
  if (!code) {
    return res.status(400).json({
      success: false,
      error: "Código de sala inválido. Forneça o código de 6 caracteres ou o link de convite.",
    });
  }

  const room = await getRoom(code);
  if (!room) {
    return res.status(404).json({
      success: false,
      error: `Sala "${code}" não foi encontrada ou foi encerrada. Verifique o código digitado.`,
    });
  }

  res.json({
    success: true,
    code: room.code,
    embedUrl: room.embedUrl,
    hostNickname: room.hostNickname,
    createdAt: room.createdAt,
    controllerName: room.controllerName,
    onlineCount: room.clients ? room.clients.size : 0,
  });
}

// Listar salas ativas recentes
app.get("/api/rooms-recent", authMiddleware, async (req, res) => {
  try {
    const rooms = await getRecentActiveRooms(12);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Apagar / Encerrar Sala
app.delete("/api/rooms/:code", authMiddleware, async (req, res) => {
  try {
    const rawCode = req.params.code;
    const code = sanitizeRoomCode(rawCode);
    if (!code) {
      return res.status(400).json({ success: false, error: "Código da sala não fornecido." });
    }

    const room = await getRoom(code);
    if (!room) {
      return res.status(404).json({ success: false, error: "Sala não encontrada ou já encerrada." });
    }

    const isHost =
      room.hostNickname &&
      req.user &&
      room.hostNickname.toLowerCase() === req.user.nickname.toLowerCase();

    if (!isHost && room.hostNickname) {
      return res.status(403).json({
        success: false,
        error: `Apenas o criador da sala (${room.hostNickname}) pode apagá-la.`,
      });
    }

    // 1. Tentar encerrar a VM no Hyperbeam para liberar cota imediatamente
    if (room.sessionId && HYPERBEAM_API_KEY) {
      try {
        await fetch(`https://engine.hyperbeam.com/v0/vm/${room.sessionId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${HYPERBEAM_API_KEY}` },
        });
        console.log(`[Hyperbeam VM Encerrada]: Session ${room.sessionId}`);
      } catch (hbErr) {
        console.warn("[Hyperbeam VM Delete Warning]:", hbErr.message);
      }
    }

    // 2. Notificar usuários conectados via WebSocket
    if (room.clients && room.clients.size > 0) {
      broadcastMessage(room, {
        type: "room_deleted",
        message: "Esta sala foi encerrada e apagada pelo anfitrião.",
      });

      for (const client of room.clients) {
        try {
          client.ws.close();
        } catch (e) {}
      }
      room.clients.clear();
    }

    // 3. Deletar do banco / memória
    if (emptyRoomTimers.has(code)) {
      clearTimeout(emptyRoomTimers.get(code));
      emptyRoomTimers.delete(code);
    }
    await deleteRoom(code);

    console.log(`[Sala Apagada]: Código ${code} por ${req.user.nickname}`);

    res.json({
      success: true,
      message: `Sala ${code} apagada com sucesso.`,
      code,
    });
  } catch (err) {
    console.error("[Erro ao apagar sala]:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check para Render
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: Boolean(HYPERBEAM_API_KEY),
    timestamp: Date.now(),
  });
});

// ----------------------------------------------------
// WEBSOCKET (Chat, Presença e Passagem de Controle)
// ----------------------------------------------------

// Mapa para agendamento de auto-destruição de salas vazias (3 minutos)
const emptyRoomTimers = new Map();

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = sanitizeRoomCode(url.searchParams.get("room"));
  const token = url.searchParams.get("token");

  const user = getUserByToken(token);
  if (!user) {
    ws.send(JSON.stringify({ type: "error", message: "Não autorizado." }));
    ws.close();
    return;
  }

  const room = await getRoom(code);
  if (!room) {
    ws.send(JSON.stringify({ type: "error", message: "Sala não encontrada." }));
    ws.close();
    return;
  }

  // Se a sala estava vazia e agendada para ser apagada, cancela o timer imediatamente!
  if (emptyRoomTimers.has(room.code)) {
    console.log(`[Auto-Delete Cancelado]: Usuário ${user.nickname} entrou na sala ${room.code}.`);
    clearTimeout(emptyRoomTimers.get(room.code));
    emptyRoomTimers.delete(room.code);
  }

  if (!room.clients) {
    room.clients = new Set();
  }

  const clientInfo = {
    ws,
    userId: user.id,
    nickname: user.nickname,
  };

  room.clients.add(clientInfo);

  // Se ninguém estiver no controle, atribui ao primeiro que entrar (ou host)
  if (!room.currentController) {
    room.currentController = user.id;
    room.controllerName = user.nickname;
  }

  broadcastRoomState(room);
  broadcastMessage(room, {
    type: "system",
    text: `${user.nickname} entrou na sala.`,
    timestamp: Date.now(),
  });

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case "chat":
          if (data.text && typeof data.text === "string" && data.text.trim()) {
            broadcastMessage(room, {
              type: "chat",
              user: user.nickname,
              userId: user.id,
              text: data.text.trim().substring(0, 500),
              timestamp: Date.now(),
            });
          }
          break;

        case "take_control":
          room.currentController = user.id;
          room.controllerName = user.nickname;
          broadcastRoomState(room);
          broadcastMessage(room, {
            type: "system",
            text: `${user.nickname} assumiu o controle do navegador.`,
            timestamp: Date.now(),
          });
          break;

        case "release_control":
          if (room.currentController === user.id) {
            room.currentController = null;
            room.controllerName = null;
            broadcastRoomState(room);
            broadcastMessage(room, {
              type: "system",
              text: `${user.nickname} liberou o controle do navegador.`,
              timestamp: Date.now(),
            });
          }
          break;
      }
    } catch (e) {
      console.error("[WS Msg Error]:", e.message);
    }
  });

  ws.on("close", () => {
    if (room.clients) {
      room.clients.delete(clientInfo);

      if (room.currentController === user.id) {
        const nextClient = room.clients.values().next().value;
        if (nextClient) {
          room.currentController = nextClient.userId;
          room.controllerName = nextClient.nickname;
        } else {
          room.currentController = null;
          room.controllerName = null;
        }
      }

      broadcastRoomState(room);
      broadcastMessage(room, {
        type: "system",
        text: `${user.nickname} saiu da sala.`,
        timestamp: Date.now(),
      });

      // Se a sala ficou totalmente vazia, agenda a exclusão automática em 3 minutos (180s)
      if (room.clients.size === 0) {
        console.log(`[Auto-Delete Agendado]: Sala ${room.code} vazia. Será apagada automaticamente em 3 minutos.`);
        if (emptyRoomTimers.has(room.code)) {
          clearTimeout(emptyRoomTimers.get(room.code));
        }

        const timer = setTimeout(async () => {
          try {
            emptyRoomTimers.delete(room.code);
            const currentRoom = await getRoom(room.code);
            if (!currentRoom) return;

            // Confirma se continuou sem nenhum participante após 3 minutos
            if (!currentRoom.clients || currentRoom.clients.size === 0) {
              console.log(`[Auto-Delete Executado]: Sala ${room.code} vazia há 3 minutos. Encerrando Hyperbeam VM e apagando...`);

              if (currentRoom.sessionId && HYPERBEAM_API_KEY) {
                try {
                  await fetch(`https://engine.hyperbeam.com/v0/vm/${currentRoom.sessionId}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${HYPERBEAM_API_KEY}` },
                  });
                  console.log(`[Hyperbeam VM Encerrada via Auto-Delete]: Session ${currentRoom.sessionId}`);
                } catch (hbErr) {
                  console.warn("[Hyperbeam VM Delete Warning]:", hbErr.message);
                }
              }

              await deleteRoom(room.code);
              console.log(`[Sala ${room.code} apagada automaticamente com sucesso].`);
            }
          } catch (err) {
            console.error(`[Erro no Auto-Delete da sala ${room.code}]:`, err.message);
          }
        }, 3 * 60 * 1000); // 3 minutos

        emptyRoomTimers.set(room.code, timer);
      }
    }
  });
});

function broadcastRoomState(room) {
  if (!room.clients) return;
  const payload = JSON.stringify({
    type: "room_state",
    code: room.code,
    currentController: room.currentController,
    controllerName: room.controllerName,
    onlineUsers: Array.from(room.clients).map((c) => ({
      userId: c.userId,
      nickname: c.nickname,
    })),
  });

  for (const client of room.clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function broadcastMessage(room, messageObj) {
  if (!room.clients) return;
  const payload = JSON.stringify(messageObj);
  for (const client of room.clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// Suporte para rotas de sala como /room/:code
app.get("/room/:code", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Fallback universal para SPA (compatível com Express 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, async () => {
  await initDatabase();
  console.log(`
  👁️ Omniscient Watch pronto!
  ➜ Local: http://localhost:${PORT}
  ➜ Chave Hyperbeam: ${HYPERBEAM_API_KEY ? "Configurada ✅" : "Pendente (.env) ⚠️"}
  `);
});
