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
  getRoomByHostNickname,
  getAllRooms,
  getRecentActiveRooms,
  deleteRoom,
  destroySession,
  updateUserAvatar,
  addRoomChatMessage,
  getRoomChatHistory,
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
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
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
    user: {
      id: req.user.id,
      nickname: req.user.nickname,
      avatar: req.user.avatar || null,
    },
  });
});

// Logout explícito
app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  try {
    await destroySession(req.token);
    res.json({ success: true, message: "Sessão encerrada com sucesso." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Atualizar avatar / foto de perfil
app.post("/api/auth/profile", authMiddleware, async (req, res) => {
  try {
    const { avatar } = req.body || {};
    if (avatar && typeof avatar === "string") {
      const trimmed = avatar.trim();
      if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("data:image/")) {
        return res.status(400).json({
          success: false,
          error: "Formato de foto inválido. Forneça uma URL (http/https) ou envie um arquivo de imagem.",
        });
      }
      if (trimmed.length > 3.5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: "A imagem selecionada é muito grande. Escolha uma imagem de até 2MB.",
        });
      }
    }

    const updated = await updateUserAvatar(req.user.id, avatar ? avatar.trim() : null);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Usuário não encontrado." });
    }

    req.user.avatar = updated.avatar;

    res.json({
      success: true,
      user: {
        id: updated.id,
        nickname: updated.nickname || req.user.nickname,
        avatar: updated.avatar,
      },
      message: updated.avatar ? "Foto de perfil atualizada com sucesso!" : "Foto de perfil removida.",
    });
  } catch (err) {
    console.error("[Erro ao atualizar perfil]:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
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

async function requestHyperbeamVM(startUrl = "https://vizer.bio/", retries = 2, requestedRegion = null) {
  if (!HYPERBEAM_API_KEY) {
    throw new Error(
      "A chave HYPERBEAM_API_KEY não foi configurada no servidor. Obtenha uma chave em https://hyperbeam.com e adicione nas variáveis de ambiente."
    );
  }

  // Se o link for do YouTube sem parâmetros de idioma, adiciona região Brasil (gl=BR) e português (hl=pt)
  if (startUrl.includes("youtube.com") && !startUrl.includes("gl=") && !startUrl.includes("hl=")) {
    const sep = startUrl.includes("?") ? "&" : "?";
    startUrl = `${startUrl}${sep}gl=BR&hl=pt`;
  }

  // Se for Google e não tiver especificado país ou idioma, direciona para o Google Brasil em português
  if (startUrl === "https://www.google.com" || startUrl === "http://www.google.com") {
    startUrl = "https://www.google.com.br?hl=pt-BR";
  }

  // Configuração de Região e Cluster Hyperbeam:
  // Modo Padrão: Conexão Direta nos Servidores Nativos do Hyperbeam (AWS / UpCloud)
  // - 100% Grátis, SEM LIMITE de internet (unmetered gigabit 1 Gbps - 10 Gbps), latência ultra-baixa (5-15ms)
  // - Cluster "EU" (Europa: Frankfurt, Amsterdã, Londres) para IP Europeu nativo
  const hyperbeamRegion = requestedRegion || process.env.HYPERBEAM_REGION || "EU";

  const proxyConfig = (
    process.env.PROXY_URL ||
    process.env.EU_PROXY ||
    process.env.US_PROXY ||
    process.env.MEXICO_PROXY ||
    process.env.BRAZIL_PROXY ||
    ""
  ).trim();

  const isEurope = !!(
    (requestedRegion && requestedRegion.toUpperCase() === "EU") ||
    hyperbeamRegion === "EU" ||
    process.env.REGION === "EU"
  );

  const isMexico = !isEurope && !!(
    process.env.REGION === "MX" ||
    (proxyConfig && (proxyConfig.includes("190.9.48.193") || proxyConfig.toLowerCase().includes("mexico")))
  );

  const isBrazil = !isEurope && !!(
    process.env.REGION === "BR" ||
    process.env.BRAZIL_PROXY ||
    (proxyConfig && (proxyConfig.includes("201.28.86.18") || proxyConfig.toLowerCase().includes("brazil")))
  );

  const defaultCountry = isEurope ? (process.env.COUNTRY || "PT") : (isMexico ? "MX" : (isBrazil ? "BR" : (process.env.COUNTRY || "US")));
  const defaultLanguage = isEurope
    ? "pt-PT,pt;q=0.9,pt-BR;q=0.8,en;q=0.7"
    : isMexico
    ? "es-MX,es;q=0.9,pt-BR;q=0.8,pt;q=0.7,en-US;q=0.6,en;q=0.5"
    : "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7";

  const vmPayload = {
    start_url: startUrl,
    region: hyperbeamRegion, // Cluster oficial Hyperbeam ("EU" ou "NA")
    kiosk: false,
    ublock: true, // Bloqueio nativo de anúncios, pop-ups invasivos e scripts maliciosos (uBlock Origin)
    webgl: true, // Aceleração gráfica para decodificação de vídeo fluida
    fps: 30, // 30 FPS estável para reprodução de vídeo sem sobrecarga de banda
    width: 1280,
    height: 720,
    locale: {
      language: defaultLanguage,
      country: defaultCountry, // Nativo oficial europeu com idioma português
    },
    timeout: {
      offline: 300, // Desliga 5 minutos após o último sair para economizar recursos
      warning: 60,
    },
  };

  if (process.env.HYPERBEAM_PROXY_PAC) {
    vmPayload.http_proxy = {
      pac: process.env.HYPERBEAM_PROXY_PAC,
      ...(process.env.HYPERBEAM_PROXY_USER ? { username: process.env.HYPERBEAM_PROXY_USER } : {}),
      ...(process.env.HYPERBEAM_PROXY_PASS ? { password: process.env.HYPERBEAM_PROXY_PASS } : {}),
    };
  } else if (proxyConfig) {
    try {
      const raw = proxyConfig;
      const proxies = raw.split(",").map(p => p.trim()).filter(Boolean);
      const pacDirectives = [];
      let defaultUser = process.env.PROXY_USER || process.env.MEXICO_PROXY_USER || process.env.BRAZIL_PROXY_USER;
      let defaultPass = process.env.PROXY_PASS || process.env.MEXICO_PROXY_PASS || process.env.BRAZIL_PROXY_PASS;

      for (const p of proxies) {
        try {
          const parsed = new URL(p.startsWith("http") ? p : `http://${p}`);
          const hostPort = `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? 443 : 80)}`;
          pacDirectives.push(`PROXY ${hostPort}`);
          if (parsed.username && !defaultUser) {
            defaultUser = decodeURIComponent(parsed.username);
          }
          if (parsed.password && !defaultPass) {
            defaultPass = decodeURIComponent(parsed.password);
          }
        } catch (_) {
          const clean = p.replace(/^https?:\/\//, "").trim();
          if (clean) pacDirectives.push(`PROXY ${clean}`);
        }
      }

      // Adiciona DIRECT como failover seguro para garantir que a navegação nunca quebre se o proxy oscilar
      pacDirectives.push("DIRECT");
      const proxyRoute = pacDirectives.join("; ");

      // Roteamento inteligente Smart PAC:
      // - Fast.com, Speedtest e YouTube vão DIRECT para medir banda máxima e economizar recursos do proxy
      // - Vizer e players de filmes passam pelo IP regional (${defaultCountry})
      const smartPacScript = `function FindProxyForURL(url, host) {
  var h = ("" + host).toLowerCase();
  var u = ("" + url).toLowerCase();

  // 1. Rede interna, localhost e WebRTC sempre DIRETO
  if (isPlainHostName(host) || h === "localhost" || h.indexOf(".local") !== -1 || h.indexOf("hyperbeam.com") !== -1) {
    return "DIRECT";
  }

  // 2. Testes de velocidade em banda gigabit
  if (
    h === "fast.com" || h.indexOf("fast.com") !== -1 ||
    h.indexOf("nflxvideo.net") !== -1 || h.indexOf("nflximg.net") !== -1 ||
    h.indexOf("speedtest.net") !== -1 || h.indexOf("speed.cloudflare.com") !== -1 ||
    h.indexOf("testmy.net") !== -1
  ) {
    return "DIRECT";
  }

  // 3. YouTube pode ir direto pela rede gigabit
  if (h.indexOf("googlevideo.com") !== -1 || h.indexOf("ytimg.com") !== -1) {
    return "DIRECT";
  }

  // 4. Sites de filmes e players passam pela rota do proxy regional (${defaultCountry})
  return "${proxyRoute}";
}`;

      vmPayload.http_proxy = {
        pac: smartPacScript,
        ...(defaultUser ? { username: defaultUser } : {}),
        ...(defaultPass ? { password: defaultPass } : {}),
      };
      console.log(`[Proxy Smart PAC]: Ativado (Região: ${defaultCountry}, YouTube/Fast.com -> DIRECT, Sites/Players -> ${proxyRoute})`);
    } catch (proxyParseErr) {
      console.warn(`[Proxy]: Falha ao processar proxy: ${proxyParseErr.message}`);
    }
  } else {
    console.log(`[Hyperbeam Conexão Direta]: Rodando com IP Oficial ${hyperbeamRegion === "EU" ? "Europeu (Frankfurt/Amsterdã - Cluster EU)" : "dos Estados Unidos (AWS/UpCloud - Cluster NA)"} - 1 Gbps sem limite de dados`);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch("https://engine.hyperbeam.com/v0/vm", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HYPERBEAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vmPayload),
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
    let { startUrl, region } = req.body || {};
    startUrl = startUrl?.trim() || "https://vizer.bio/";

    // REGRA: Limite estrito de apenas 1 sala ativa por conta
    const existingRoom = await getRoomByHostNickname(req.user.nickname);
    if (existingRoom) {
      return res.status(400).json({
        success: false,
        error: `Você já possui uma sala ativa (${existingRoom.code}). Cada conta tem permissão para apenas 1 sala por vez. Encerre ou apague sua sala anterior para criar uma nova.`,
        existingCode: existingRoom.code,
      });
    }

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

    const vm = await requestHyperbeamVM(startUrl, 2, region);

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

// Obter histórico de mensagens da sala
app.get("/api/rooms/:code/messages", authMiddleware, async (req, res) => {
  try {
    const code = sanitizeRoomCode(req.params.code);
    if (!code) {
      return res.status(400).json({ success: false, error: "Código da sala não fornecido." });
    }
    const room = await getRoom(code);
    if (!room) {
      return res.status(404).json({ success: false, error: "Sala não encontrada." });
    }
    const messages = await getRoomChatHistory(code);
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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
  room.emptySince = null;
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
    avatar: user.avatar || null,
  };

  room.clients.add(clientInfo);

  // Se ninguém estiver no controle, atribui ao primeiro que entrar (ou host)
  if (!room.currentController) {
    room.currentController = user.id;
    room.controllerName = user.nickname;
  }

  broadcastRoomState(room);

  // Envia histórico de mensagens recente para o participante recém-conectado
  try {
    const history = await getRoomChatHistory(room.code);
    if (history && history.length > 0) {
      ws.send(
        JSON.stringify({
          type: "chat_history",
          messages: history,
        })
      );
    }
  } catch (err) {
    console.error("[Erro ao enviar histórico de mensagens]:", err.message);
  }

  broadcastMessage(room, {
    type: "system",
    text: `${user.nickname} entrou na sala.`,
    timestamp: Date.now(),
  });

  ws.on("message", async (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case "chat":
          if (data.text && typeof data.text === "string" && data.text.trim()) {
            const chatMsg = {
              type: "chat",
              user: user.nickname,
              userId: user.id,
              avatar: user.avatar || null,
              text: data.text.trim().substring(0, 500),
              timestamp: Date.now(),
            };
            await addRoomChatMessage(room.code, chatMsg);
            broadcastMessage(room, chatMsg);
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

      // Se a sala ficou totalmente vazia, marca emptySince e agenda o encerramento em 3 minutos
      if (room.clients.size === 0) {
        room.emptySince = Date.now();
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
  const AUTO_DELETE_MS = 3 * 60 * 1000;
  let secondsLeft = null;
  if (room.clients.size === 0 && room.emptySince) {
    const elapsed = Math.max(0, Date.now() - room.emptySince);
    secondsLeft = Math.max(0, Math.ceil((AUTO_DELETE_MS - elapsed) / 1000));
  }

  const payload = JSON.stringify({
    type: "room_state",
    code: room.code,
    currentController: room.currentController,
    controllerName: room.controllerName,
    onlineCount: room.clients.size,
    emptySince: room.emptySince,
    secondsLeft,
    onlineUsers: Array.from(room.clients).map((c) => ({
      userId: c.userId,
      nickname: c.nickname,
      avatar: c.avatar || null,
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
  res.sendFile("index.html", { root: path.join(__dirname, "public") });
});

// Fallback universal para SPA (compatível com Express 5)
app.use((req, res) => {
  res.sendFile("index.html", { root: path.join(__dirname, "public") });
});

// Job contínuo: monitora e encerra QUALQUER sala que ficar vazia por 3 minutos (180s)
const AUTO_DELETE_MS = 3 * 60 * 1000;
setInterval(async () => {
  try {
    const allRooms = getAllRooms();
    const now = Date.now();

    for (const [code, room] of allRooms.entries()) {
      const activeCount = room.clients ? room.clients.size : 0;
      if (activeCount === 0) {
        if (!room.emptySince) {
          room.emptySince = now;
        }
        const elapsed = now - room.emptySince;
        if (elapsed >= AUTO_DELETE_MS) {
          console.log(`[Auto-Delete 3min]: Encerrando sala ${code} por inatividade (vazia há 3 minutos)...`);
          if (room.sessionId && HYPERBEAM_API_KEY) {
            try {
              await fetch(`https://engine.hyperbeam.com/v0/vm/${room.sessionId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${HYPERBEAM_API_KEY}` },
              });
              console.log(`[Hyperbeam VM Encerrada]: Session ${room.sessionId}`);
            } catch (hbErr) {
              console.warn(`[Hyperbeam VM Delete Warning]: ${hbErr.message}`);
            }
          }
          await deleteRoom(code);
          console.log(`[Sala ${code} apagada permanentemente].`);
        }
      } else {
        room.emptySince = null;
      }
    }
  } catch (err) {
    console.error("[Erro no job de auto-delete das salas]:", err.message);
  }
}, 3000);

server.listen(PORT, async () => {
  await initDatabase();
  console.log(`
  👁️ Omniscient Watch pronto!
  ➜ Local: http://localhost:${PORT}
  ➜ Chave Hyperbeam: ${HYPERBEAM_API_KEY ? "Configurada ✅" : "Pendente (.env) ⚠️"}
  `);
});
