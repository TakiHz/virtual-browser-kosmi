import Hyperbeam from "/hyperbeam.js";

// ESTADO GLOBAL DO APLICATIVO
const state = {
  token: localStorage.getItem("hb_token") || null,
  user: null,
  currentRoom: null,
  pendingInviteCode: null,
  hbInstance: null,
  ws: null,
  isControlling: false,
  blockPopups: true, // Bloqueio ativo de pop-ups e abas invasivas
};

// ELEMENTOS DOM
const views = {
  auth: document.getElementById("view-auth"),
  lobby: document.getElementById("view-lobby"),
  room: document.getElementById("view-room"),
};

const authElements = {
  tabLogin: document.getElementById("tab-login"),
  tabRegister: document.getElementById("tab-register"),
  formLogin: document.getElementById("form-login"),
  formRegister: document.getElementById("form-register"),
  inputLoginNick: document.getElementById("login-nickname"),
  inputLoginPass: document.getElementById("login-password"),
  inputRegNick: document.getElementById("register-nickname"),
  inputRegPass: document.getElementById("register-password"),
  inviteNotice: document.getElementById("invite-notice"),
  noticeRoomCode: document.getElementById("notice-room-code"),
};

const lobbyElements = {
  userDisplayName: document.getElementById("user-display-name"),
  userAvatar: document.getElementById("user-avatar"),
  btnLogout: document.getElementById("btn-logout"),
  formCreate: document.getElementById("form-create-room"),
  createStartUrl: document.getElementById("create-start-url"),
  btnCreateRoom: document.getElementById("btn-create-room"),
  btnCreateText: document.getElementById("btn-create-text"),
  formJoin: document.getElementById("form-join-room"),
  joinRoomCode: document.getElementById("join-room-code"),
  sectionRoomsList: document.getElementById("section-rooms-list"),
  roomsListGrid: document.getElementById("rooms-list-grid"),
  roomsEmptyState: document.getElementById("rooms-empty-state"),
  btnRefreshRooms: document.getElementById("btn-refresh-rooms"),
};

const modalElements = {
  overlay: document.getElementById("modal-password"),
  closeBtn: document.getElementById("modal-close-btn"),
  roomTitle: document.getElementById("modal-room-title"),
  roomDesc: document.getElementById("modal-room-desc"),
  form: document.getElementById("form-modal-password"),
  inputPassword: document.getElementById("input-modal-password"),
  btnCancel: document.getElementById("btn-modal-cancel"),
  btnSubmit: document.getElementById("btn-modal-submit"),
};

const roomElements = {
  displayCode: document.getElementById("room-code-display"),
  passDisplay: document.getElementById("room-pass-display"),
  btnCopyCode: document.getElementById("btn-copy-code"),
  btnCopyLink: document.getElementById("btn-copy-link"),
  btnLeave: document.getElementById("btn-leave-room"),
  onlineCount: document.getElementById("room-online-count"),
  browserMount: document.getElementById("browser-mount"),
  controlStatusBadge: document.getElementById("control-status-badge"),
  controlStatusText: document.getElementById("control-status-text"),
  btnToggleControl: document.getElementById("btn-toggle-control"),
  btnTogglePopupBlock: document.getElementById("btn-toggle-popup-block"),
  btnMute: document.getElementById("btn-mute"),
  volumeSlider: document.getElementById("volume-slider"),
  btnFullscreen: document.getElementById("btn-fullscreen"),
  btnToggleSidebar: document.getElementById("btn-toggle-sidebar"),
  sidebar: document.getElementById("room-sidebar"),
  tabChat: document.getElementById("tab-chat"),
  tabUsers: document.getElementById("tab-users"),
  sidebarChat: document.getElementById("sidebar-chat"),
  sidebarUsers: document.getElementById("sidebar-users"),
  tabUsersCount: document.getElementById("tab-users-count"),
  chatMessagesBox: document.getElementById("chat-messages-box"),
  formChat: document.getElementById("form-chat"),
  chatInputText: document.getElementById("chat-input-text"),
  usersListBox: document.getElementById("users-list-box"),
  formNav: document.getElementById("form-room-nav"),
  inputNavUrl: document.getElementById("input-room-nav-url"),
};

// ====================================================
// UTILITÁRIOS: TOASTS & CLIPBOARD
// ====================================================
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    textArea.remove();
    return successful;
  } catch (err) {
    console.error("Erro ao copiar:", err);
    return false;
  }
}

// ====================================================
// NAVEGAÇÃO DE TELAS (SPA)
// ====================================================
function showScreen(screenName) {
  Object.keys(views).forEach((name) => {
    if (name === screenName) {
      views[name].classList.add("active");
    } else {
      views[name].classList.remove("active");
    }
  });
}

// ====================================================
// SANITIZAÇÃO E EXTRAÇÃO DE CÓDIGOS DE SALA
// ====================================================
function extractRoomCode(raw) {
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

// ====================================================
// ROTEAMENTO & EXTRAÇÃO DE CÓDIGO DE CONVITE
// ====================================================
function checkInviteRoute() {
  const path = window.location.pathname;
  let code = extractRoomCode(path);
  if (!code) {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      code = extractRoomCode(roomParam);
    }
  }

  if (code) {
    state.pendingInviteCode = code;
    authElements.inviteNotice.classList.remove("hidden");
    authElements.noticeRoomCode.textContent = code;
    authElements.inputLoginNick.focus();
  }
}

// ====================================================
// INICIALIZAÇÃO & AUTENTICAÇÃO
// ====================================================
async function checkAuth() {
  if (!state.token) {
    showScreen("auth");
    return;
  }

  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (res.ok) {
      const data = await res.json();
      state.user = data.user;
      onAuthSuccess();
    } else {
      // Token expirou
      localStorage.removeItem("hb_token");
      state.token = null;
      showScreen("auth");
    }
  } catch (err) {
    console.error("Erro na verificação de auth:", err);
    showScreen("auth");
  }
}

function onAuthSuccess() {
  lobbyElements.userDisplayName.textContent = state.user.nickname;
  lobbyElements.userAvatar.textContent = state.user.nickname.charAt(0).toUpperCase();

  // Carrega a lista de salas públicas disponíveis
  loadRoomsList();

  // Se o usuário entrou por link de convite, entra direto na sala!
  if (state.pendingInviteCode) {
    const code = state.pendingInviteCode;
    state.pendingInviteCode = null;
    joinRoom(code);
  } else {
    showScreen("lobby");
  }
}

// ====================================================
// LISTA DE SALAS DISPONÍVEIS & ACESSO POR SENHA
// ====================================================
let targetedRoomForModal = null;

function openPasswordModal(room) {
  targetedRoomForModal = room;
  modalElements.roomTitle.textContent = `Sala de ${room.hostNickname}`;
  modalElements.roomDesc.innerHTML = `Para entrar, insira a <strong>senha de convite</strong> da sala (ex: <code>${room.code}</code>):`;
  modalElements.inputPassword.value = "";
  modalElements.overlay.classList.remove("hidden");
  setTimeout(() => modalElements.inputPassword.focus(), 50);
}

function closePasswordModal() {
  modalElements.overlay.classList.add("hidden");
  targetedRoomForModal = null;
  modalElements.inputPassword.value = "";
}

// Eventos do Modal de Senha
if (modalElements.closeBtn) modalElements.closeBtn.addEventListener("click", closePasswordModal);
if (modalElements.btnCancel) modalElements.btnCancel.addEventListener("click", closePasswordModal);
if (modalElements.overlay) {
  modalElements.overlay.addEventListener("click", (e) => {
    if (e.target === modalElements.overlay) closePasswordModal();
  });
}

if (modalElements.form) {
  modalElements.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const pass = extractRoomCode(modalElements.inputPassword.value);
    if (!pass) {
      showToast("Por favor, digite a senha de convite da sala (ex: TUMMJS).", "error");
      return;
    }
    closePasswordModal();
    joinRoom(pass);
  });
}

if (lobbyElements.btnRefreshRooms) {
  lobbyElements.btnRefreshRooms.addEventListener("click", () => {
    loadRoomsList();
    showToast("Lista de salas atualizada!", "info");
  });
}

async function loadRoomsList() {
  if (!state.token || !lobbyElements.roomsListGrid) return;

  try {
    const res = await fetch("/api/rooms-recent", {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!res.ok) return;
    const data = await res.json();
    const rooms = data.rooms || [];

    lobbyElements.roomsListGrid.innerHTML = "";

    if (rooms.length === 0) {
      lobbyElements.roomsEmptyState.classList.remove("hidden");
      return;
    }

    lobbyElements.roomsEmptyState.classList.add("hidden");

    rooms.forEach((r) => {
      const isOwner =
        state.user &&
        r.hostNickname &&
        r.hostNickname.toLowerCase() === state.user.nickname.toLowerCase();

      const card = document.createElement("div");
      card.className = `room-card-item ${isOwner ? "is-own" : ""}`;

      const timeAgo = formatTimeAgo(r.createdAt);

      card.innerHTML = `
        <div class="room-card-top">
          <div class="room-title-area">
            <span class="room-host-title">
              ${isOwner ? "👑" : "🖥️"} Sala de ${escapeHTML(r.hostNickname)}
            </span>
            <span class="room-time-meta">Criada ${timeAgo} • ${r.onlineCount || 0} online</span>
          </div>
          <span class="room-badge-pill ${isOwner ? "owner" : "lock"}">
            ${isOwner ? "👑 Sua Sala" : "🔒 Protegida"}
          </span>
        </div>

        <div class="room-card-body">
          <span class="pass-label">🔑 Senha da Sala:</span>
          ${
            isOwner
              ? `<span class="pass-code">${r.code}</span>`
              : `<span class="pass-hint">Senha necessária (ex: ${r.code})</span>`
          }
        </div>

        <div class="room-card-actions">
          <button class="btn-card-enter" type="button">
            ${isOwner ? "Entrar Direto →" : "🔑 Inserir Senha e Entrar"}
          </button>
          <button class="btn-card-copy" type="button" title="Copiar Senha de Convite">
            📋 Copiar Senha
          </button>
        </div>
      `;

      // Botão Entrar
      card.querySelector(".btn-card-enter").addEventListener("click", () => {
        if (isOwner) {
          joinRoom(r.code);
        } else {
          openPasswordModal(r);
        }
      });

      // Botão Copiar Senha
      card.querySelector(".btn-card-copy").addEventListener("click", async () => {
        const ok = await copyToClipboard(r.code);
        if (ok) {
          showToast(`Senha de convite (${r.code}) copiada!`, "success");
        }
      });

      lobbyElements.roomsListGrid.appendChild(card);
    });
  } catch (err) {
    console.warn("Erro ao listar salas:", err);
  }
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return "recentemente";
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "agora há pouco";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays}d`;
}

// Alternar abas Entrar / Cadastrar
authElements.tabLogin.addEventListener("click", () => {
  authElements.tabLogin.classList.add("active");
  authElements.tabRegister.classList.remove("active");
  authElements.formLogin.classList.remove("hidden");
  authElements.formRegister.classList.add("hidden");
});

authElements.tabRegister.addEventListener("click", () => {
  authElements.tabRegister.classList.add("active");
  authElements.tabLogin.classList.remove("active");
  authElements.formRegister.classList.remove("hidden");
  authElements.formLogin.classList.add("hidden");
});

// SUBMIT CADASTRO (Apenas Nickname e Senha)
authElements.formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nickname = authElements.inputRegNick.value.trim();
  const password = authElements.inputRegPass.value;

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao realizar cadastro.");

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("hb_token", data.token);

    showToast(`Conta criada com sucesso! Bem-vindo, ${data.user.nickname}!`, "success");
    onAuthSuccess();
  } catch (err) {
    showToast(err.message, "error");
  }
});

// SUBMIT LOGIN (Apenas Nickname e Senha)
authElements.formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nickname = authElements.inputLoginNick.value.trim();
  const password = authElements.inputLoginPass.value;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao fazer login.");

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("hb_token", data.token);

    showToast(`Olá novamente, ${data.user.nickname}!`, "success");
    onAuthSuccess();
  } catch (err) {
    showToast(err.message, "error");
  }
});

// LOGOUT
lobbyElements.btnLogout.addEventListener("click", () => {
  localStorage.removeItem("hb_token");
  state.token = null;
  state.user = null;
  showToast("Sessão encerrada.", "info");
  showScreen("auth");
});

// ====================================================
// LOBBY: CRIAR E ENTRAR EM SALAS
// ====================================================

// Criar Nova Sala
lobbyElements.formCreate.addEventListener("submit", async (e) => {
  e.preventDefault();
  const startUrl = lobbyElements.createStartUrl.value.trim() || "https://www.youtube.com";

  try {
    lobbyElements.btnCreateRoom.disabled = true;
    lobbyElements.btnCreateText.textContent = "Iniciando Máquina Virtual...";

    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ startUrl }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao criar sala.");

    showToast(`Sala criada com sucesso! Código: ${data.code}`, "success");
    joinRoom(data.code);
  } catch (err) {
    showToast(err.message, "error");

    // Se bater no limite de taxa temporário, atualiza as salas disponíveis e inicia cooldown visível
    if (err.message.includes("Limite temporário") || err.message.includes("429")) {
      loadRoomsList();
      let cooldown = 60;
      lobbyElements.btnCreateRoom.disabled = true;
      const interval = setInterval(() => {
        cooldown--;
        if (cooldown <= 0) {
          clearInterval(interval);
          lobbyElements.btnCreateRoom.disabled = false;
          lobbyElements.btnCreateText.textContent = "Criar Sala Virtual";
        } else {
          lobbyElements.btnCreateText.textContent = `Aguarde ${cooldown}s (Cooldown)...`;
        }
      }, 1000);
      return;
    }
  } finally {
    if (!lobbyElements.btnCreateRoom.textContent.includes("Cooldown")) {
      lobbyElements.btnCreateRoom.disabled = false;
      lobbyElements.btnCreateText.textContent = "Criar Sala Virtual";
    }
  }
});

// Auto-extração caso o usuário cole o link completo no input de código
lobbyElements.joinRoomCode.addEventListener("input", (e) => {
  const val = e.target.value;
  if (val.includes("/") || val.includes("http") || val.includes("room")) {
    const clean = extractRoomCode(val);
    if (clean) {
      e.target.value = clean;
    }
  }
});

// Entrar com Código ou Link
lobbyElements.formJoin.addEventListener("submit", (e) => {
  e.preventDefault();
  const code = extractRoomCode(lobbyElements.joinRoomCode.value);
  if (!code) {
    showToast("Por favor, digite o código de 6 caracteres ou cole o link de convite.", "error");
    return;
  }
  joinRoom(code);
});

// ====================================================
// SALA VIRTUAL: WEBRTC & WEBSOCKET
// ====================================================

async function joinRoom(rawCode) {
  const code = extractRoomCode(rawCode);
  if (!code) {
    showToast("Código de sala inválido.", "error");
    return;
  }

  const btnSpan = lobbyElements.btnJoinRoom ? lobbyElements.btnJoinRoom.querySelector("span") : null;
  const originalText = btnSpan ? btnSpan.textContent : "Entrar na Sala";

  try {
    if (lobbyElements.btnJoinRoom) lobbyElements.btnJoinRoom.disabled = true;
    if (btnSpan) btnSpan.textContent = "Buscando Sala...";

    // 1. Obter informações da sala
    const res = await fetch(`/api/rooms/${code}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    const room = await res.json();
    if (!res.ok) throw new Error(room.error || "Sala não encontrada ou encerrada.");

    state.currentRoom = room;

    // Atualiza a URL sem recarregar a página garantindo o código correto
    window.history.pushState({}, "", `/room/${room.code}`);

    // Exibe a tela da sala
    showScreen("room");
    roomElements.displayCode.textContent = room.code;
    if (roomElements.passDisplay) {
      roomElements.passDisplay.textContent = room.code;
    }

    // Configura o placeholder de carregamento
    roomElements.browserMount.innerHTML = `
      <div class="browser-placeholder">
        <div class="spinner"></div>
        <p>Conectando ao Navegador Virtual Hyperbeam...</p>
      </div>
    `;

    // 2. Conectar WebSocket para sincronização da sala
    connectRoomWebSocket(room.code);

    // 3. Montar o Navegador Virtual com Hyperbeam SDK
    await mountHyperbeam(room.embedUrl);
  } catch (err) {
    showToast(err.message, "error");
    showScreen("lobby");
  } finally {
    if (lobbyElements.btnJoinRoom) lobbyElements.btnJoinRoom.disabled = false;
    if (btnSpan) btnSpan.textContent = originalText;
  }
}

async function mountHyperbeam(embedUrl) {
  try {
    // Limpa o container antes de montar
    roomElements.browserMount.innerHTML = "";

    // Instancia o cliente WebRTC do Hyperbeam
    state.hbInstance = await Hyperbeam(roomElements.browserMount, embedUrl, {
      disableInput: true, // Inicia como espectador até assumir controle
      delegateKeyboard: true,
      volume: parseFloat(roomElements.volumeSlider.value),
      onDisconnect: () => {
        showToast("Navegador virtual desconectado.", "info");
      },
    });

    // Ativa o protetor anti-popup inteligente na sessão
    setupAntiPopupGuard(state.hbInstance);

    showToast("Navegador virtual carregado com sucesso!", "success");
  } catch (err) {
    console.error("Erro ao inicializar Hyperbeam:", err);
    showToast("Erro ao conectar no stream do Hyperbeam: " + err.message, "error");
  }
}

// ====================================================
// GUARDA ANTI-POPUP E CONTROLE DE ABAS EXTRAS
// ====================================================
function setupAntiPopupGuard(hb) {
  if (!hb || !hb.tabs) return;

  try {
    hb.tabs.onCreated.addListener(async (tab) => {
      if (!state.blockPopups) return;

      try {
        const tabs = await hb.tabs.query({});
        if (tabs && tabs.length > 1) {
          const mainTab = tabs[0];
          // Se for uma aba secundária aberta por script/anúncio/popup
          if (tab.id !== mainTab.id) {
            console.log(`[Anti-Popup] Fechando pop-up/aba secundária indesejada: ${tab.id}`);
            await hb.tabs.remove(tab.id);
            if (mainTab && mainTab.id) {
              await hb.tabs.update(mainTab.id, { active: true });
            }
            showToast("Pop-up ou anúncio bloqueado! 🛡️", "info");
          }
        }
      } catch (err) {
        console.warn("[Anti-Popup error]:", err.message);
      }
    });
    console.log("🛡️ Anti-Popup Guard ativo no navegador virtual.");
  } catch (err) {
    console.warn("Não foi possível registrar o listener de abas do Hyperbeam:", err);
  }
}

function connectRoomWebSocket(code) {
  if (state.ws) {
    state.ws.close();
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws?room=${code}&token=${state.token}`;

  state.ws = new WebSocket(wsUrl);

  state.ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "room_state":
          updateRoomState(data);
          break;

        case "chat":
          appendChatMessage(data);
          break;

        case "system":
          appendSystemMessage(data.text);
          break;

        case "error":
          showToast(data.message, "error");
          break;
      }
    } catch (err) {
      console.error("Erro no processamento WS:", err);
    }
  };

  state.ws.onclose = () => {
    console.log("WebSocket desconectado.");
  };
}

function updateRoomState(data) {
  const { currentController, controllerName, onlineUsers } = data;

  // Atualizar contador online
  const count = onlineUsers.length;
  roomElements.onlineCount.textContent = `${count} ${count === 1 ? "pessoa" : "pessoas"}`;
  roomElements.tabUsersCount.textContent = count;

  // Atualizar lista de usuários
  roomElements.usersListBox.innerHTML = "";
  onlineUsers.forEach((u) => {
    const li = document.createElement("li");
    li.className = "user-row";
    const isMe = u.userId === state.user.id;
    const isCtrl = u.userId === currentController;
    li.innerHTML = `
      <span class="u-name">${u.nickname} ${isMe ? "(Você)" : ""}</span>
      ${isCtrl ? '<span class="u-tag">🎮 No Controle</span>' : ""}
    `;
    roomElements.usersListBox.appendChild(li);
  });

  // Atualizar estado de quem controla
  const isMeControlling = currentController === state.user.id;
  state.isControlling = isMeControlling;

  if (state.hbInstance) {
    // Se sou eu quem controla, libera o input de mouse/teclado!
    // Se for outra pessoa, bloqueia o input local para não haver conflitos
    state.hbInstance.disableInput = !isMeControlling;
  }

  if (isMeControlling) {
    roomElements.controlStatusBadge.className = "control-status controlling";
    roomElements.controlStatusText.textContent = "🎮 Você está no controle";
    roomElements.btnToggleControl.textContent = "Liberar Controle";
    roomElements.btnToggleControl.className = "btn-dock active-control";
  } else {
    roomElements.controlStatusBadge.className = "control-status";
    roomElements.controlStatusText.textContent = controllerName
      ? `👀 ${controllerName} está controlando`
      : "👀 Controle livre";
    roomElements.btnToggleControl.textContent = "🎮 Assumir Controle";
    roomElements.btnToggleControl.className = "btn-dock";
  }
}

// TOGGLE CONTROLE (ASSUMIR / LIBERAR)
roomElements.btnToggleControl.addEventListener("click", () => {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  if (state.isControlling) {
    state.ws.send(JSON.stringify({ type: "release_control" }));
  } else {
    state.ws.send(JSON.stringify({ type: "take_control" }));
  }
});

// COPIAR SENHA DE CONVITE DA SALA (Somente os 6 caracteres)
roomElements.btnCopyCode.addEventListener("click", async () => {
  if (!state.currentRoom) return;
  const ok = await copyToClipboard(state.currentRoom.code);
  if (ok) {
    showToast(`Senha de convite (${state.currentRoom.code}) copiada!`, "success");
  } else {
    showToast("Não foi possível copiar a senha de convite.", "error");
  }
});

// COPIAR LINK DE CONVITE COMPLETO
roomElements.btnCopyLink.addEventListener("click", async () => {
  if (!state.currentRoom) return;
  const inviteLink = `${window.location.origin}/room/${state.currentRoom.code}`;
  const ok = await copyToClipboard(inviteLink);
  if (ok) {
    showToast("Link de convite copiado para a área de transferência!", "success");
  } else {
    showToast("Não foi possível copiar o link.", "error");
  }
});

// SAIR DA SALA
roomElements.btnLeave.addEventListener("click", () => {
  if (state.ws) {
    state.ws.close();
    state.ws = null;
  }
  if (state.hbInstance) {
    state.hbInstance.destroy?.();
    state.hbInstance = null;
  }
  state.currentRoom = null;
  window.history.pushState({}, "", "/");
  loadRoomsList();
  showScreen("lobby");
});

// NAVEGAR / REPRODUZIR STREAM HLS (.m3u8) DENTRO DA SALA
if (roomElements.formNav) {
  roomElements.formNav.addEventListener("submit", async (e) => {
    e.preventDefault();
    let url = roomElements.inputNavUrl.value.trim();
    if (!url) return;

    if (!state.isControlling) {
      showToast("Apenas quem está no controle do mouse pode trocar o vídeo/site.", "error");
      return;
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    // Se for .m3u8, redireciona pelo player HTML5 interno com hls.js
    if (url.toLowerCase().includes(".m3u8")) {
      url = `${window.location.origin}/player.html?src=${encodeURIComponent(url)}`;
    }

    try {
      if (state.hbInstance && state.hbInstance.tabs) {
        const tabs = await state.hbInstance.tabs.query({});
        if (tabs && tabs.length > 0) {
          await state.hbInstance.tabs.update(tabs[0].id, { url });
          showToast("Carregando transmissão...", "success");
          roomElements.inputNavUrl.value = "";
        }
      }
    } catch (err) {
      showToast("Erro ao carregar link: " + err.message, "error");
    }
  });
}

// ====================================================
// CONTROLES DE ÁUDIO & TELA CHEIA
// ====================================================
roomElements.volumeSlider.addEventListener("input", (e) => {
  const vol = parseFloat(e.target.value);
  if (state.hbInstance) {
    state.hbInstance.volume = vol;
  }
  roomElements.btnMute.textContent = vol === 0 ? "🔇" : "🔊";
});

roomElements.btnMute.addEventListener("click", () => {
  if (!state.hbInstance) return;
  if (state.hbInstance.volume > 0) {
    state.hbInstance.volume = 0;
    roomElements.volumeSlider.value = 0;
    roomElements.btnMute.textContent = "🔇";
  } else {
    state.hbInstance.volume = 1;
    roomElements.volumeSlider.value = 1;
    roomElements.btnMute.textContent = "🔊";
  }
});

// ALTERNAR BLOQUEADOR DE POP-UPS
if (roomElements.btnTogglePopupBlock) {
  roomElements.btnTogglePopupBlock.addEventListener("click", () => {
    state.blockPopups = !state.blockPopups;
    if (state.blockPopups) {
      roomElements.btnTogglePopupBlock.className = "btn-dock-pill active";
      roomElements.btnTogglePopupBlock.textContent = "🛡️ Pop-ups: Bloqueados";
      showToast("Bloqueador de pop-ups ATIVADO! 🛡️", "success");
    } else {
      roomElements.btnTogglePopupBlock.className = "btn-dock-pill disabled";
      roomElements.btnTogglePopupBlock.textContent = "⚠️ Pop-ups: Permitidos";
      showToast("Bloqueador de pop-ups DESATIVADO. ⚠️", "warning");
    }
  });
}

roomElements.btnFullscreen.addEventListener("click", () => {
  const wrapper = document.querySelector(".browser-wrapper");
  if (!document.fullscreenElement) {
    wrapper.requestFullscreen().catch((err) => {
      showToast("Erro ao abrir tela cheia: " + err.message, "error");
    });
  } else {
    document.exitFullscreen();
  }
});

// ====================================================
// CHAT & SIDEBAR
// ====================================================
roomElements.btnToggleSidebar.addEventListener("click", () => {
  roomElements.sidebar.classList.toggle("collapsed");
});

roomElements.tabChat.addEventListener("click", () => {
  roomElements.tabChat.classList.add("active");
  roomElements.tabUsers.classList.remove("active");
  roomElements.sidebarChat.classList.remove("hidden");
  roomElements.sidebarUsers.classList.add("hidden");
});

roomElements.tabUsers.addEventListener("click", () => {
  roomElements.tabUsers.classList.add("active");
  roomElements.tabChat.classList.remove("active");
  roomElements.sidebarUsers.classList.remove("hidden");
  roomElements.sidebarChat.classList.add("hidden");
});

roomElements.formChat.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = roomElements.chatInputText.value.trim();
  if (!text || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  state.ws.send(JSON.stringify({ type: "chat", text }));
  roomElements.chatInputText.value = "";
});

function appendChatMessage(msg) {
  const item = document.createElement("div");
  item.className = "chat-item";
  item.innerHTML = `<span class="chat-author">${msg.user}:</span><span class="chat-body">${escapeHTML(msg.text)}</span>`;
  roomElements.chatMessagesBox.appendChild(item);
  roomElements.chatMessagesBox.scrollTop = roomElements.chatMessagesBox.scrollHeight;
}

function appendSystemMessage(text) {
  const item = document.createElement("div");
  item.className = "chat-item system";
  item.innerHTML = `<span>${escapeHTML(text)}</span>`;
  roomElements.chatMessagesBox.appendChild(item);
  roomElements.chatMessagesBox.scrollTop = roomElements.chatMessagesBox.scrollHeight;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, (tag) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[tag] || tag));
}

// ====================================================
// START
// ====================================================
window.addEventListener("DOMContentLoaded", () => {
  checkInviteRoute();
  checkAuth();
});
