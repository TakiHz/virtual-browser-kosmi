# 🌐 Virtual Browser Co-Browsing (Estilo Kosmi)

Plataforma de navegação web simultânea e colaborativa na nuvem com áudio e vídeo de alta fidelidade em tempo real, inspirada no **Kosmi** e **Rabb.it**, construída com **Node.js**, **WebRTC** e **Hyperbeam API**, pronta para deploy gratuito no **Render.com** via **GitHub**.

---

## ✨ Funcionalidades

- **Autenticação Direta**: Cadastro e Login exigindo **apenas Nickname e Senha** (sem e-mail, sem burocracia).
- **Criação de Salas**: Cria uma máquina virtual com navegador próprio na nuvem sob demanda.
- **Código e Link de Convite Idênticos**: A sala gera um código único de 6 caracteres (ex: `7X9K2M`). O link de convite é exatamente `https://seu-dominio.onrender.com/room/7X9K2M`.
- **Navegação Sincronizada em Tempo Real**: Todos os membros da sala assistem ao mesmo navegador com vídeo a 60 FPS e áudio estéreo.
- **Sistema de Controle de Mouse e Teclado**:
  - Quem está com o controle pode clicar, rolar a página e digitar no navegador.
  - Qualquer participante pode clicar em **"Assumir Controle"** ou o controlador atual pode liberar o mouse para os amigos.
- **Chat ao Vivo & Lista de Participantes**: Bate-papo em tempo real integrado via WebSockets.
- **Controles de Mídia**: Ajuste fino de volume, mudo e modo tela cheia.

---

## 🚀 Como Rodar Localmente

### 1. Pré-requisitos
- Node.js 18+ instalado.
- Uma chave de API da **[Hyperbeam](https://hyperbeam.com)** (gratuita para testes).

### 2. Configurar o ambiente
1. Clone ou acesse a pasta do projeto:
   ```bash
   cd virtual-browser-hyperbeam
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie o arquivo `.env` a partir do exemplo:
   ```bash
   cp .env.example .env
   ```
4. Insira sua chave da Hyperbeam dentro do `.env`:
   ```env
   PORT=3000
   HYPERBEAM_API_KEY=sua_chave_hyperbeam_aqui
   ```
5. Inicie o servidor:
   ```bash
   npm start
   ```
6. Abra no navegador: **`http://localhost:3000`**

---

## 📦 Como Subir no GitHub e Render.com

### Passo 1: Subir o Código no GitHub
1. Inicialize o repositório git na pasta do projeto:
   ```bash
   git init
   git add .
   git commit -m "feat: virtual browser kosmi style"
   ```
2. Crie um repositório no seu GitHub (ex: `virtual-browser-kosmi`).
3. Conecte e envie o código:
   ```bash
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/virtual-browser-kosmi.git
   git push -u origin main
   ```

### Passo 2: Fazer Deploy no Render.com (Gratuito)
1. Acesse o painel do **[Render.com](https://dashboard.render.com/)**.
2. Clique em **"New +"** ➜ **"Web Service"**.
3. Conecte o repositório do GitHub que você acabou de criar.
4. O Render detectará automaticamente as configurações ou preencha:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. Na seção **Environment Variables** (Variáveis de Ambiente), adicione:
   - Nome: `HYPERBEAM_API_KEY`
   - Valor: *(Cole a sua chave de API da Hyperbeam)*
6. Clique em **"Deploy Web Service"**.

Pronto! Em 1 a 2 minutos sua aplicação estará online com link seguro `https://sua-aplicacao.onrender.com`.

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Node.js, Express, WebSockets (`ws`), `node:crypto` (hashing seguro de senhas com `scrypt`).
- **Navegador Virtual & WebRTC:** Hyperbeam API + SDK `@hyperbeam/web`.
- **Frontend:** Vanilla JavaScript moderno (ES Modules), HTML5 e CSS3 com design escuro de alta legibilidade e responsividade.
