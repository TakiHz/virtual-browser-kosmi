import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const ROOMS_FILE = path.join(DATA_DIR, "rooms.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSON(file, fallback = {}) {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Erro ao carregar ${file}:`, err.message);
  }
  return fallback;
}

function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Erro ao salvar ${file}:`, err.message);
  }
}

// In-memory cache synced with disk
const users = new Map(Object.entries(loadJSON(USERS_FILE, {})));
const rooms = new Map(Object.entries(loadJSON(ROOMS_FILE, {})));
const sessions = new Map(); // token -> userId

function saveUsers() {
  saveJSON(USERS_FILE, Object.fromEntries(users));
}

function saveRooms() {
  // Salva apenas os dados serializáveis das salas (sem os WebSockets ativos)
  const serializable = {};
  for (const [code, r] of rooms.entries()) {
    serializable[code] = {
      code: r.code,
      hostNickname: r.hostNickname,
      sessionId: r.sessionId,
      embedUrl: r.embedUrl,
      adminToken: r.adminToken,
      createdAt: r.createdAt,
    };
  }
  saveJSON(ROOMS_FILE, serializable);
}

// Hashing seguro de senhas com node:crypto nativo
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, originalHash] = stored.split(":");
  const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(testHash), Buffer.from(originalHash));
}

export function registerUser(nickname, password) {
  const cleanNick = nickname.trim().toLowerCase();
  if (users.has(cleanNick)) {
    throw new Error("Este nickname já está em uso.");
  }

  const user = {
    id: crypto.randomUUID(),
    nickname: nickname.trim(),
    cleanNick,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
  };

  users.set(cleanNick, user);
  saveUsers();

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, user);

  return { token, user: { id: user.id, nickname: user.nickname } };
}

export function loginUser(nickname, password) {
  const cleanNick = nickname.trim().toLowerCase();
  const user = users.get(cleanNick);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Nickname ou senha incorretos.");
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, user);

  return { token, user: { id: user.id, nickname: user.nickname } };
}

export function getUserByToken(token) {
  if (!token) return null;
  return sessions.get(token) || null;
}

export function createRoomStore(code, data) {
  const room = {
    code: code.toUpperCase(),
    hostNickname: data.hostNickname,
    sessionId: data.sessionId,
    embedUrl: data.embedUrl,
    adminToken: data.adminToken,
    createdAt: Date.now(),
    currentController: null,
    controllerName: null,
    clients: new Set(),
  };
  rooms.set(code.toUpperCase(), room);
  saveRooms();
  return room;
}

export function getRoom(code) {
  if (!code) return null;
  return rooms.get(code.toUpperCase()) || null;
}

export function getAllRooms() {
  return rooms;
}
