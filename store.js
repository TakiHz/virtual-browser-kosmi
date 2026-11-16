import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
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

// In-memory cache
const localUsers = new Map(Object.entries(loadJSON(USERS_FILE, {})));
const localRooms = new Map(Object.entries(loadJSON(ROOMS_FILE, {})));
const sessions = new Map(); // token -> user object

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  });
  console.log("🐘 PostgreSQL detectado e configurado para persistência permanente!");
} else {
  console.log("📁 DATABASE_URL não configurada. Usando persistência local em JSON.");
}

// Inicializar tabelas no banco de dados relacional
export async function initDatabase() {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        clean_nick TEXT UNIQUE NOT NULL,
        nickname TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY,
        host_nickname TEXT NOT NULL,
        session_id TEXT NOT NULL,
        embed_url TEXT NOT NULL,
        admin_token TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
    `);
    console.log("✅ Tabelas permanentes 'users' e 'rooms' verificadas no PostgreSQL.");
  } catch (err) {
    console.error("❌ Erro ao criar tabelas no PostgreSQL:", err.message);
  }
}

function saveLocalUsers() {
  saveJSON(USERS_FILE, Object.fromEntries(localUsers));
}

function saveLocalRooms() {
  const serializable = {};
  for (const [code, r] of localRooms.entries()) {
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

export async function registerUser(nickname, password) {
  const cleanNick = nickname.trim().toLowerCase();
  const passwordHash = hashPassword(password);
  const id = crypto.randomUUID();
  const now = Date.now();

  if (pool) {
    try {
      await pool.query(
        "INSERT INTO users (id, clean_nick, nickname, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)",
        [id, cleanNick, nickname.trim(), passwordHash, now]
      );
    } catch (err) {
      if (err.code === "23505") {
        throw new Error("Este nickname já está em uso.");
      }
      throw err;
    }
  } else {
    if (localUsers.has(cleanNick)) {
      throw new Error("Este nickname já está em uso.");
    }
    const user = {
      id,
      nickname: nickname.trim(),
      cleanNick,
      passwordHash,
      createdAt: now,
    };
    localUsers.set(cleanNick, user);
    saveLocalUsers();
  }

  const token = crypto.randomBytes(32).toString("hex");
  const userObj = { id, nickname: nickname.trim() };
  sessions.set(token, userObj);

  return { token, user: userObj };
}

export async function loginUser(nickname, password) {
  const cleanNick = nickname.trim().toLowerCase();
  let user = null;

  if (pool) {
    const res = await pool.query(
      "SELECT id, nickname, password_hash FROM users WHERE clean_nick = $1",
      [cleanNick]
    );
    if (res.rows.length === 0) {
      throw new Error("Nickname ou senha incorretos.");
    }
    user = {
      id: res.rows[0].id,
      nickname: res.rows[0].nickname,
      passwordHash: res.rows[0].password_hash,
    };
  } else {
    user = localUsers.get(cleanNick);
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Nickname ou senha incorretos.");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const userObj = { id: user.id, nickname: user.nickname };
  sessions.set(token, userObj);

  return { token, user: userObj };
}

export function getUserByToken(token) {
  if (!token) return null;
  return sessions.get(token) || null;
}

export async function createRoomStore(code, data) {
  const codeUpper = String(code).trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const now = Date.now();

  const room = {
    code: codeUpper,
    hostNickname: data.hostNickname,
    sessionId: data.sessionId,
    embedUrl: data.embedUrl,
    adminToken: data.adminToken,
    createdAt: now,
    currentController: null,
    controllerName: null,
    clients: new Set(),
  };

  localRooms.set(codeUpper, room);

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO rooms (code, host_nickname, session_id, embed_url, admin_token, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO NOTHING`,
        [codeUpper, data.hostNickname, data.sessionId, data.embedUrl, data.adminToken, now]
      );
    } catch (err) {
      console.error("Erro ao salvar sala no banco:", err.message);
    }
  } else {
    saveLocalRooms();
  }

  return room;
}

export async function getRoom(code) {
  if (!code) return null;
  const codeUpper = String(code).trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!codeUpper) return null;

  if (localRooms.has(codeUpper)) {
    return localRooms.get(codeUpper);
  }

  if (pool) {
    try {
      const res = await pool.query(
        "SELECT * FROM rooms WHERE UPPER(TRIM(code)) = $1",
        [codeUpper]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        const room = {
          code: row.code,
          hostNickname: row.host_nickname,
          sessionId: row.session_id,
          embedUrl: row.embed_url,
          adminToken: row.admin_token,
          createdAt: Number(row.created_at),
          currentController: null,
          controllerName: null,
          clients: new Set(),
        };
        localRooms.set(codeUpper, room);
        return room;
      }
    } catch (err) {
      console.error("Erro ao recuperar sala do PostgreSQL:", err.message);
    }
  }

  return null;
}

export function getAllRooms() {
  return localRooms;
}
