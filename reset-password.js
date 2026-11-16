import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { hashPassword } from "./store.js";

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, "data", "users.json");

async function main() {
  const nickname = process.argv[2];
  const newPassword = process.argv[3];

  if (!nickname || !newPassword) {
    console.log(`
=============================================================
🛠️  OMNISCIENT WATCH - REDEFINIÇÃO DE SENHA ADMINISTRATIVA
=============================================================
Uso:
  node reset-password.js <nickname> <nova_senha>

Exemplo:
  node reset-password.js mizael MinhaNovaSenha123
=============================================================
`);
    process.exit(1);
  }

  if (newPassword.length < 4) {
    console.error("❌ A senha deve conter no mínimo 4 caracteres.");
    process.exit(1);
  }

  const cleanNick = nickname.trim().toLowerCase();
  const newHash = hashPassword(newPassword);

  let updatedInPostgres = false;
  let updatedInLocal = false;

  // 1. Atualiza no PostgreSQL se DATABASE_URL estiver configurada
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });

    try {
      const res = await pool.query(
        "UPDATE users SET password_hash = $1 WHERE clean_nick = $2 RETURNING id, nickname",
        [newHash, cleanNick]
      );

      if (res.rowCount > 0) {
        console.log(`🐘 PostgreSQL: Senha do usuário "${res.rows[0].nickname}" atualizada com sucesso!`);
        updatedInPostgres = true;
      } else {
        console.warn(`⚠️ PostgreSQL: Usuário com nickname "${nickname}" não foi encontrado na tabela 'users'.`);
      }
    } catch (err) {
      console.error("❌ Erro ao conectar ao PostgreSQL:", err.message);
    } finally {
      await pool.end();
    }
  }

  // 2. Atualiza no arquivo local data/users.json
  if (fs.existsSync(USERS_FILE)) {
    try {
      const raw = fs.readFileSync(USERS_FILE, "utf-8");
      const usersData = JSON.parse(raw);

      if (usersData[cleanNick]) {
        usersData[cleanNick].passwordHash = newHash;
        fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2), "utf-8");
        console.log(`📁 Arquivo local: Senha do usuário "${usersData[cleanNick].nickname}" atualizada em data/users.json!`);
        updatedInLocal = true;
      } else {
        // Procura ignorando maiúsculas/minúsculas
        let foundKey = null;
        for (const key of Object.keys(usersData)) {
          if (key.toLowerCase() === cleanNick) {
            foundKey = key;
            break;
          }
        }
        if (foundKey) {
          usersData[foundKey].passwordHash = newHash;
          fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2), "utf-8");
          console.log(`📁 Arquivo local: Senha do usuário "${usersData[foundKey].nickname}" atualizada em data/users.json!`);
          updatedInLocal = true;
        }
      }
    } catch (err) {
      console.error("❌ Erro ao atualizar arquivo local data/users.json:", err.message);
    }
  }

  if (updatedInPostgres || updatedInLocal) {
    console.log(`
✅ Sucesso! A nova senha para o usuário "${nickname}" foi redefinida com êxito.
Você já pode entrar na plataforma usando seu nickname e a nova senha.
`);
  } else {
    console.error(`
❌ Não foi possível encontrar o usuário "${nickname}".
Verifique se o nickname digitado está correto.
`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erro inesperado:", err);
  process.exit(1);
});
