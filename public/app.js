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
  userProfileBtn: document.getElementById("user-profile-btn"),
  btnLogout: document.getElementById("btn-logout"),
  formCreate: document.getElementById("form-create-room"),
  createStartUrl: document.getElementById("create-start-url"),
  btnToggleQuickAlt: document.getElementById("btn-toggle-quick-alt"),
  chipUrlYoutube: document.getElementById("chip-url-youtube"),
  chipUrlVizer: document.getElementById("chip-url-vizer"),
  btnCreateRoom: document.getElementById("btn-create-room"),
  btnCreateText: document.getElementById("btn-create-text"),
  formJoin: document.getElementById("form-join-room"),
  joinRoomCode: document.getElementById("join-room-code"),
  sectionRoomsList: document.getElementById("section-rooms-list"),
  roomsListGrid: document.getElementById("rooms-list-grid"),
  roomsEmptyState: document.getElementById("rooms-empty-state"),
  btnRefreshRooms: document.getElementById("btn-refresh-rooms"),
};

const profileModalElements = {
  overlay: document.getElementById("modal-profile"),
  closeBtn: document.getElementById("modal-profile-close-btn"),
  previewCircle: document.getElementById("avatar-preview"),
  previewInitial: document.getElementById("avatar-preview-initial"),
  previewImg: document.getElementById("avatar-preview-img"),
  previewNick: document.getElementById("avatar-preview-nick"),
  tabFile: document.getElementById("tab-avatar-file"),
  tabUrl: document.getElementById("tab-avatar-url"),
  sectionFile: document.getElementById("section-avatar-file"),
  sectionUrl: document.getElementById("section-avatar-url"),
  dropzone: document.getElementById("avatar-dropzone"),
  inputFile: document.getElementById("input-avatar-file"),
  inputUrl: document.getElementById("input-avatar-url"),
  form: document.getElementById("form-modal-profile"),
  btnCancel: document.getElementById("btn-modal-profile-cancel"),
  btnRemove: document.getElementById("btn-remove-avatar"),
  btnSave: document.getElementById("btn-save-avatar"),
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
  roomDock: document.getElementById("room-dock"),
  mobileTypingBar: document.getElementById("mobile-typing-bar"),
  mobileKeyboardProxy: document.getElementById("mobile-keyboard-proxy"),
  btnSendTypedText: document.getElementById("btn-send-typed-text"),
  btnCloseTypingBar: document.getElementById("btn-close-typing-bar"),
  btnDeleteRoom: document.getElementById("btn-delete-room"),
  displayCode: document.getElementById("room-code-display"),
  passDisplay: document.getElementById("room-pass-display"),
  btnCopyCode: document.getElementById("btn-copy-code"),
  btnCopyLink: document.getElementById("btn-copy-link"),
  btnLeave: document.getElementById("btn-leave-room"),
  onlineCount: document.getElementById("room-online-count"),
  timerBadge: document.getElementById("room-timer-badge"),
  timerText: document.getElementById("room-timer-text"),
  browserMount: document.getElementById("browser-mount"),
  controlStatusBadge: document.getElementById("control-status-badge"),
  controlStatusText: document.getElementById("control-status-text"),
  btnToggleControl: document.getElementById("btn-toggle-control"),
  btnTogglePopupBlock: document.getElementById("btn-toggle-popup-block"),
  btnMute: document.getElementById("btn-mute"),
  volumeSlider: document.getElementById("volume-slider"),
  btnFullscreen: document.getElementById("btn-fullscreen"),
  btnFullscreenExit: document.getElementById("btn-fullscreen-exit"),
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
  btnRoomNavYoutube: document.getElementById("btn-room-nav-youtube"),
  btnRoomNavVizer: document.getElementById("btn-room-nav-vizer"),
  btnFullscreenFloating: document.getElementById("btn-fullscreen-floating"),
  fullscreenActionBar: document.getElementById("fullscreen-action-bar"),
  btnFullscreenChatToggle: document.getElementById("btn-fullscreen-chat-toggle"),
  fsChatBadge: document.getElementById("fs-chat-badge"),
  fullscreenChatOverlay: document.getElementById("fullscreen-chat-overlay"),
  fsChatMessages: document.getElementById("fs-chat-messages"),
  formFsChat: document.getElementById("form-fs-chat"),
  fsChatInput: document.getElementById("fs-chat-input"),
  btnFsChatOpacity: document.getElementById("btn-fs-chat-opacity"),
  btnFsChatClose: document.getElementById("btn-fs-chat-close"),
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
    } else if (res.status === 401) {
      // Somente remove do localStorage se o servidor rejeitar explicitamente
      localStorage.removeItem("hb_token");
      state.token = null;
      showScreen("auth");
    } else {
      showScreen("auth");
    }
  } catch (err) {
    console.warn("Aviso de rede na verificação de auth:", err.message);
    // Erro transitório de rede: preserva o token para não deslogar o usuário
    showScreen("auth");
  }
}

function renderUserAvatar(user) {
  if (!user || !lobbyElements.userAvatar) return;
  if (user.avatar) {
    lobbyElements.userAvatar.innerHTML = `<img src="${escapeHTML(user.avatar)}" class="user-avatar-img" alt="${escapeHTML(user.nickname)}" />`;
  } else {
    lobbyElements.userAvatar.textContent = user.nickname ? user.nickname.charAt(0).toUpperCase() : "U";
  }
}

function onAuthSuccess() {
  lobbyElements.userDisplayName.textContent = state.user.nickname;
  renderUserAvatar(state.user);

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
  modalElements.roomTitle.textContent = `Sala de ${escapeHTML(room.hostNickname)}`;
  modalElements.roomDesc.innerHTML = `Para acessar esta sala, digite a <strong>senha de convite</strong> (6 caracteres) fornecida pelo anfitrião:`;
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
      showToast("Por favor, digite a senha de convite de 6 caracteres.", "error");
      return;
    }
    // Confere se a senha digitada confere com a sala selecionada
    if (targetedRoomForModal && pass.toUpperCase() !== targetedRoomForModal.code.toUpperCase()) {
      showToast("Senha de convite incorreta para esta sala. Solicite ao anfitrião.", "error");
      return;
    }
    const targetCode = targetedRoomForModal ? targetedRoomForModal.code : pass;
    closePasswordModal();
    joinRoom(targetCode);
  });
}

if (lobbyElements.btnRefreshRooms) {
  lobbyElements.btnRefreshRooms.addEventListener("click", () => {
    loadRoomsList();
    showToast("Lista de salas atualizada!", "info");
  });
}

// ====================================================
// PERFIL DO USUÁRIO & FOTO DE PERFIL (LINK OU ARQUIVO)
// ====================================================

let pendingAvatarData = null; // Guarda a URL ou Base64 temporário para prévia

function resizeImageFile(file, maxWidth = 256, maxHeight = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      return reject(new Error("O arquivo selecionado não é uma imagem válida."));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;

        const targetSize = Math.min(size, maxWidth);
        canvas.width = targetSize;
        canvas.height = targetSize;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, startX, startY, size, size, 0, 0, targetSize, targetSize);

        const dataUrl = canvas.toDataURL("image/webp", 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Erro ao processar imagem."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo do dispositivo."));
    reader.readAsDataURL(file);
  });
}

function updateProfilePreview(avatarUrlOrData) {
  pendingAvatarData = avatarUrlOrData;
  if (!profileModalElements.previewImg || !profileModalElements.previewInitial) return;

  if (avatarUrlOrData) {
    profileModalElements.previewImg.src = avatarUrlOrData;
    profileModalElements.previewImg.classList.remove("hidden");
    profileModalElements.previewInitial.classList.add("hidden");
  } else {
    profileModalElements.previewImg.src = "";
    profileModalElements.previewImg.classList.add("hidden");
    profileModalElements.previewInitial.classList.remove("hidden");
  }
}

function openProfileModal() {
  if (!state.user || !profileModalElements.overlay) return;

  const nick = state.user.nickname || "Usuário";
  if (profileModalElements.previewNick) profileModalElements.previewNick.textContent = nick;
  if (profileModalElements.previewInitial) profileModalElements.previewInitial.textContent = nick.charAt(0).toUpperCase();

  // Define a foto atual
  updateProfilePreview(state.user.avatar || null);

  // Reseta inputs
  if (profileModalElements.inputUrl) {
    profileModalElements.inputUrl.value =
      state.user.avatar && state.user.avatar.startsWith("http") ? state.user.avatar : "";
  }
  if (profileModalElements.inputFile) {
    profileModalElements.inputFile.value = "";
  }

  // Abre na aba de arquivo por padrão
  switchProfileTab("file");

  profileModalElements.overlay.classList.remove("hidden");
}

function closeProfileModal() {
  if (profileModalElements.overlay) {
    profileModalElements.overlay.classList.add("hidden");
  }
  pendingAvatarData = null;
}

function switchProfileTab(tab) {
  if (!profileModalElements.tabFile || !profileModalElements.tabUrl) return;

  if (tab === "file") {
    profileModalElements.tabFile.classList.add("active");
    profileModalElements.tabUrl.classList.remove("active");
    profileModalElements.sectionFile.classList.remove("hidden");
    profileModalElements.sectionUrl.classList.add("hidden");
  } else {
    profileModalElements.tabUrl.classList.add("active");
    profileModalElements.tabFile.classList.remove("active");
    profileModalElements.sectionUrl.classList.remove("hidden");
    profileModalElements.sectionFile.classList.add("hidden");
    if (profileModalElements.inputUrl) {
      setTimeout(() => profileModalElements.inputUrl.focus(), 50);
    }
  }
}

// Configura listeners do modal de perfil
if (lobbyElements.userProfileBtn) {
  lobbyElements.userProfileBtn.addEventListener("click", () => {
    openProfileModal();
  });
}

if (profileModalElements.closeBtn) {
  profileModalElements.closeBtn.addEventListener("click", closeProfileModal);
}
if (profileModalElements.btnCancel) {
  profileModalElements.btnCancel.addEventListener("click", closeProfileModal);
}

if (profileModalElements.tabFile) {
  profileModalElements.tabFile.addEventListener("click", () => switchProfileTab("file"));
}
if (profileModalElements.tabUrl) {
  profileModalElements.tabUrl.addEventListener("click", () => switchProfileTab("url"));
}

// Arquivo selecionado no input
if (profileModalElements.inputFile) {
  profileModalElements.inputFile.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      showToast("Otimizando imagem...", "info");
      const dataUrl = await resizeImageFile(file, 256, 256);
      updateProfilePreview(dataUrl);
      showToast("Foto pronta na prévia! Clique em 'Salvar Foto' para confirmar.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// Link digitado no input
if (profileModalElements.inputUrl) {
  profileModalElements.inputUrl.addEventListener("input", (e) => {
    const url = e.target.value.trim();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      updateProfilePreview(url);
    } else if (!url) {
      updateProfilePreview(state.user?.avatar || null);
    }
  });
}

// Submissão do formulário para salvar a foto
if (profileModalElements.form) {
  profileModalElements.form.addEventListener("submit", async (e) => {
    e.preventDefault();

    let avatarToSave = pendingAvatarData;
    if (profileModalElements.tabUrl.classList.contains("active")) {
      const urlVal = profileModalElements.inputUrl ? profileModalElements.inputUrl.value.trim() : "";
      if (urlVal) avatarToSave = urlVal;
    }

    if (!avatarToSave) {
      showToast("Escolha um arquivo de imagem ou informe um link antes de salvar.", "warning");
      return;
    }

    try {
      const btnSpan = profileModalElements.btnSave ? profileModalElements.btnSave.querySelector("span") : null;
      if (profileModalElements.btnSave) profileModalElements.btnSave.disabled = true;
      if (btnSpan) btnSpan.textContent = "Salvando...";

      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({ avatar: avatarToSave }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar foto de perfil.");

      state.user = data.user;
      renderUserAvatar(state.user);
      closeProfileModal();
      showToast(data.message || "Foto de perfil atualizada com sucesso! 📸", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      if (profileModalElements.btnSave) profileModalElements.btnSave.disabled = false;
      const btnSpan = profileModalElements.btnSave ? profileModalElements.btnSave.querySelector("span") : null;
      if (btnSpan) btnSpan.textContent = "Salvar Foto";
    }
  });
}

// Botão Remover Foto
if (profileModalElements.btnRemove) {
  profileModalElements.btnRemove.addEventListener("click", async () => {
    const confirmRemove = confirm("Deseja remover sua foto de perfil e voltar a usar a letra inicial?");
    if (!confirmRemove) return;

    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({ avatar: null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao remover foto de perfil.");

      state.user = data.user;
      renderUserAvatar(state.user);
      closeProfileModal();
      showToast("Foto de perfil removida com sucesso.", "info");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// ====================================================
// APAGAR / ENCERRAR SALA VIA API
// ====================================================
async function deleteRoomApi(code) {
  if (!code || !state.token) return;

  try {
    const res = await fetch(`/api/rooms/${code}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao apagar sala.");

    showToast(`Sala ${code} apagada com sucesso! 🗑️`, "success");

    // Se estivermos dentro da sala apagada, encerra WebRTC/WebSocket e volta ao lobby
    if (state.currentRoom && state.currentRoom.code === code) {
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
      showScreen("lobby");
    }

    loadRoomsList();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function updateOwnRoomStatus(ownRoom) {
  const ownNotice = document.getElementById("own-room-notice");
  const ownCodeTag = document.getElementById("own-room-code-tag");
  const btnGoOwn = document.getElementById("btn-go-own-room");
  const btnDelOwn = document.getElementById("btn-del-own-room");

  if (ownRoom) {
    if (ownNotice) ownNotice.classList.remove("hidden");
    if (ownCodeTag) ownCodeTag.textContent = ownRoom.code;
    if (lobbyElements.btnCreateRoom) {
      lobbyElements.btnCreateRoom.disabled = true;
      lobbyElements.btnCreateRoom.classList.add("disabled");
    }
    if (lobbyElements.btnCreateText) {
      lobbyElements.btnCreateText.textContent = "Limite Atingido (1 Sala por Conta)";
    }

    if (btnGoOwn) {
      btnGoOwn.onclick = () => joinRoom(ownRoom.code);
    }
    if (btnDelOwn) {
      btnDelOwn.onclick = async () => {
        const ok = confirm(`Deseja realmente apagar sua sala "${ownRoom.code}" para poder criar uma nova?`);
        if (!ok) return;
        await deleteRoomApi(ownRoom.code);
      };
    }
  } else {
    if (ownNotice) ownNotice.classList.add("hidden");
    if (lobbyElements.btnCreateRoom && !lobbyElements.btnCreateText?.textContent?.includes("Cooldown")) {
      lobbyElements.btnCreateRoom.disabled = false;
      lobbyElements.btnCreateRoom.classList.remove("disabled");
    }
    if (lobbyElements.btnCreateText && !lobbyElements.btnCreateText?.textContent?.includes("Cooldown")) {
      lobbyElements.btnCreateText.textContent = "Criar Sala Virtual";
    }
  }
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

    // Verifica se o usuário logado já possui uma sala ativa
    const ownRoom = rooms.find(
      (r) =>
        state.user &&
        r.hostNickname &&
        r.hostNickname.toLowerCase() === state.user.nickname.toLowerCase()
    );
    updateOwnRoomStatus(ownRoom);

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
      const isOnline = (r.onlineCount || 0) > 0;
      const secondsLeft = typeof r.secondsLeft === "number" ? r.secondsLeft : 180;

      card.innerHTML = `
        <div class="room-card-top">
          <div class="room-title-area">
            <span class="room-host-title">
              ${isOwner ? "👑" : "🖥️"} Sala de ${escapeHTML(r.hostNickname)}
            </span>
            <span class="room-time-meta">Criada ${timeAgo} • ${isOnline ? `${r.onlineCount} online` : "Vazia"}</span>
          </div>
          <div class="room-card-badges">
            ${
              isOnline
                ? `<span class="room-badge-pill active">🟢 ${r.onlineCount} online</span>`
                : `<span class="room-badge-pill countdown timer-countdown" data-seconds="${secondsLeft}">⏳ Fecha em ${formatMinutesSeconds(secondsLeft)}</span>`
            }
            <span class="room-badge-pill ${isOwner ? "owner" : "lock"}">
              ${isOwner ? "👑 Sua Sala" : "🔒 Protegida"}
            </span>
          </div>
        </div>

        <div class="room-card-body">
          <span class="pass-label">🔑 Senha da Sala:</span>
          ${
            isOwner
              ? `<span class="pass-code">${r.code}</span>`
              : `<span class="pass-hint">🔒 Senha privada requerida</span>`
          }
        </div>

        <div class="room-card-actions">
          <button class="btn-card-enter" type="button">
            ${isOwner ? "Entrar Direto →" : "🔑 Inserir Senha e Entrar"}
          </button>
          ${
            isOwner
              ? `<button class="btn-card-delete" type="button" title="Apagar e encerrar esta sala">🗑️ Apagar</button>`
              : ""
          }
        </div>
      `;

      // Botão Entrar / Inserir Senha
      card.querySelector(".btn-card-enter").addEventListener("click", () => {
        if (isOwner) {
          joinRoom(r.code);
        } else {
          openPasswordModal(r);
        }
      });

      // Botão Apagar Sala (Aparece se for dono da sala)
      const btnDelete = card.querySelector(".btn-card-delete");
      if (btnDelete) {
        btnDelete.addEventListener("click", async (e) => {
          e.stopPropagation();
          const confirmDel = confirm(
            `Tem certeza que deseja apagar a sala "${r.code}"?\n\nEla será encerrada para todos os participantes.`
          );
          if (!confirmDel) return;
          await deleteRoomApi(r.code);
        });
      }

      lobbyElements.roomsListGrid.appendChild(card);
    });

    startRoomsCountdownTicker();
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

function formatMinutesSeconds(totalSec) {
  if (!totalSec || totalSec <= 0) return "00:00";
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Ticker contínuo de contagem regressiva para exibição em tempo real
let roomCountdownInterval = null;
function startRoomsCountdownTicker() {
  if (roomCountdownInterval) clearInterval(roomCountdownInterval);
  roomCountdownInterval = setInterval(() => {
    // 1. Atualiza os cards no lobby
    const badges = document.querySelectorAll(".timer-countdown[data-seconds]");
    badges.forEach((el) => {
      let sec = parseInt(el.getAttribute("data-seconds"), 10);
      if (isNaN(sec)) return;
      sec--;
      if (sec <= 0) {
        el.setAttribute("data-seconds", "0");
        el.textContent = "⏳ Encerrando...";
      } else {
        el.setAttribute("data-seconds", String(sec));
        el.textContent = `⏳ Fecha em ${formatMinutesSeconds(sec)}`;
      }
    });

    // 2. Atualiza badge de fechamento da sala aberta
    if (roomElements.timerBadge && roomElements.timerText && state.currentRoom) {
      const activeTimer = roomElements.timerBadge.getAttribute("data-seconds");
      if (activeTimer) {
        let sec = parseInt(activeTimer, 10);
        if (!isNaN(sec) && sec > 0) {
          sec--;
          roomElements.timerBadge.setAttribute("data-seconds", String(sec));
          roomElements.timerText.textContent = `⏳ Fecha em ${formatMinutesSeconds(sec)}`;
          if (sec <= 0) {
            showToast("A sala foi encerrada automaticamente por inatividade.", "info");
            leaveRoom();
          }
        }
      }
    }
  }, 1000);
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
lobbyElements.btnLogout.addEventListener("click", async () => {
  try {
    if (state.token) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${state.token}` },
      });
    }
  } catch (e) {}
  localStorage.removeItem("hb_token");
  state.token = null;
  state.user = null;
  showToast("Sessão encerrada com sucesso.", "info");
  showScreen("auth");
});

// ====================================================
// ATALHOS & ALTERNATIVAS DE STREAMING (VIZER & YOUTUBE)
// ====================================================
const PRESET_URLS = {
  VIZER: "https://vizer.bio/",
  YOUTUBE: "https://www.youtube.com?gl=BR&hl=pt",
};

// ====================================================
// LOBBY: CRIAR E ENTRAR EM SALAS
// ====================================================

// Criar Nova Sala
lobbyElements.formCreate.addEventListener("submit", async (e) => {
  e.preventDefault();
  const startUrl = lobbyElements.createStartUrl.value.trim() || PRESET_URLS.VIZER;

  try {
    lobbyElements.btnCreateRoom.disabled = true;
    lobbyElements.btnCreateText.textContent = "Iniciando Máquina Virtual...";

    const hiddenRegionInput = document.getElementById("create-room-region");
    const region = hiddenRegionInput ? hiddenRegionInput.value : "AUTO";

    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ startUrl, region }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao criar sala.");

    showToast(`Sala criada com sucesso! Código: ${data.code}`, "success");
    joinRoom(data.code);
  } catch (err) {
    showToast(err.message, "error");

    // Se o erro foi limite de sala por conta atingido, atualiza a lista de salas
    if (err.message.includes("já possui uma sala ativa") || err.message.includes("1 sala")) {
      loadRoomsList();
    }

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
    if (
      !lobbyElements.btnCreateRoom.textContent.includes("Cooldown") &&
      !lobbyElements.btnCreateRoom.textContent.includes("Limite Atingido")
    ) {
      lobbyElements.btnCreateRoom.disabled = false;
      lobbyElements.btnCreateText.textContent = "Criar Sala Virtual";
    }
  }
});

function syncUrlPresets(currentUrl) {
  const norm = (currentUrl || "").trim().toLowerCase();
  const isVizer = norm.includes("vizer");
  const isYt = norm.includes("youtube.com") || norm.includes("youtu.be");

  if (lobbyElements.chipUrlVizer) {
    lobbyElements.chipUrlVizer.classList.toggle("active", isVizer);
  }
  if (lobbyElements.chipUrlYoutube) {
    lobbyElements.chipUrlYoutube.classList.toggle("active", isYt);
  }

  // O botão do lado funciona como alternador direto
  if (lobbyElements.btnToggleQuickAlt) {
    if (isVizer) {
      lobbyElements.btnToggleQuickAlt.innerHTML = "▶️ YouTube";
      lobbyElements.btnToggleQuickAlt.title = "Alternar para YouTube (alternativa ao Vizer)";
    } else {
      lobbyElements.btnToggleQuickAlt.innerHTML = "🎬 Vizer";
      lobbyElements.btnToggleQuickAlt.title = "Alternar para Vizer (primeira opção)";
    }
  }
}

if (lobbyElements.createStartUrl) {
  lobbyElements.createStartUrl.addEventListener("input", () => {
    syncUrlPresets(lobbyElements.createStartUrl.value);
  });
  // Sincroniza estado inicial (Vizer ativo por padrão)
  syncUrlPresets(lobbyElements.createStartUrl.value || PRESET_URLS.VIZER);
}

if (lobbyElements.btnToggleQuickAlt) {
  lobbyElements.btnToggleQuickAlt.addEventListener("click", () => {
    const current = (lobbyElements.createStartUrl.value || "").trim().toLowerCase();
    if (current.includes("vizer")) {
      lobbyElements.createStartUrl.value = PRESET_URLS.YOUTUBE;
    } else {
      lobbyElements.createStartUrl.value = PRESET_URLS.VIZER;
    }
    syncUrlPresets(lobbyElements.createStartUrl.value);
    showToast(`URL definida: ${lobbyElements.createStartUrl.value}`, "info");
  });
}

if (lobbyElements.chipUrlYoutube) {
  lobbyElements.chipUrlYoutube.addEventListener("click", () => {
    lobbyElements.createStartUrl.value = PRESET_URLS.YOUTUBE;
    syncUrlPresets(PRESET_URLS.YOUTUBE);
  });
}

if (lobbyElements.chipUrlVizer) {
  lobbyElements.chipUrlVizer.addEventListener("click", () => {
    lobbyElements.createStartUrl.value = PRESET_URLS.VIZER;
    syncUrlPresets(PRESET_URLS.VIZER);
  });
}

// Alternador de Região do Servidor Hyperbeam
const regionChips = document.querySelectorAll(".choice-chip-region");
const hiddenRegionInput = document.getElementById("create-room-region");
regionChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    regionChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    if (hiddenRegionInput) {
      hiddenRegionInput.value = chip.getAttribute("data-region") || "AUTO";
    }
  });
});

function updateRoomRegionBadge(region) {
  const badge = document.getElementById("room-nav-region-badge");
  if (!badge) return;
  const r = (region || "").toUpperCase();
  if (r === "NA") {
    badge.innerHTML = "🇺🇸 EUA (Cluster NA)";
    badge.title = "Servidor nos Estados Unidos (AWS) - Alta capacidade & sem bloqueios";
  } else if (r === "EU") {
    badge.innerHTML = "🇪🇺 Europa (Cluster EU)";
    badge.title = "Servidor na Europa (Frankfurt/Amsterdã) - IP Europeu";
  } else {
    badge.innerHTML = "⚡ Auto (Menos Tráfego)";
    badge.title = "Cluster dinâmico com menor tráfego e latência rápida";
  }
}

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
    if (room.region) {
      updateRoomRegionBadge(room.region);
    }

    // Se o usuário atual for o criador da sala, exibe o botão de apagar sala
    const isOwner =
      state.user &&
      room.hostNickname &&
      room.hostNickname.toLowerCase() === state.user.nickname.toLowerCase();

    if (roomElements.btnDeleteRoom) {
      if (isOwner) {
        roomElements.btnDeleteRoom.classList.remove("hidden");
      } else {
        roomElements.btnDeleteRoom.classList.add("hidden");
      }
    }

    // Atualiza a URL sem recarregar a página garantindo o código correto
    window.history.pushState({}, "", `/room/${room.code}`);

    // Exibe a tela da sala
    showScreen("room");
    roomElements.displayCode.textContent = room.code;
    if (roomElements.passDisplay) {
      roomElements.passDisplay.textContent = room.code;
    }

    // Inicializa a caixa de chat com mensagem padrão de boas-vindas
    if (roomElements.chatMessagesBox) {
      roomElements.chatMessagesBox.innerHTML = `
        <div class="chat-item system">
          <span>Bem-vindo à sala! Envie o link ou senha para seus amigos.</span>
        </div>
      `;
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
      playoutDelay: true, // Suaviza o vídeo eliminando frame drops e travamentos de WebRTC
      volume: parseFloat(roomElements.volumeSlider ? roomElements.volumeSlider.value : "1"),
      onDisconnect: () => {
        showToast("Navegador virtual desconectado.", "info");
      },
    });

    // Trava resolução da VM Hyperbeam estritamente no padrão HD 16:9 (1280x720)
    // Previne distorções na transmissão para quem assiste no PC
    if (state.hbInstance && typeof state.hbInstance.resize === "function") {
      try {
        state.hbInstance.resize(1280, 720);
      } catch (_) {}
    }

    // Permissões completas de tela cheia, autoplay e mídia no iframe do Hyperbeam
    const ensureIframePermissions = () => {
      const iframes = roomElements.browserMount.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        iframe.setAttribute(
          "allow",
          "fullscreen; accelerometer; autoplay; clipboard-read; clipboard-write; display-capture; encrypted-media; gyroscope; picture-in-picture; web-share"
        );
        iframe.setAttribute("allowfullscreen", "true");
        iframe.setAttribute("webkitallowfullscreen", "true");
        iframe.setAttribute("mozallowfullscreen", "true");
      });
    };
    ensureIframePermissions();

    // Observa alterações no DOM do browserMount para reaplicar atributos caso o iframe seja recriado
    if (window.MutationObserver) {
      const observer = new MutationObserver(ensureIframePermissions);
      observer.observe(roomElements.browserMount, { childList: true, subtree: true });
    }

    // Ativa o protetor anti-popup inteligente na sessão
    setupAntiPopupGuard(state.hbInstance);

    // Ativa suporte touch para celular com alinhamento pixel-perfect
    setupMobileTouchAndGestures();

    // Aplica zoom padrão de 110% no navegador virtual conforme solicitado
    setTimeout(() => {
      applyVirtualBrowserZoom(1.10);
    }, 1200);
    setTimeout(() => {
      applyVirtualBrowserZoom(1.10);
    }, 3000);

    showToast("Navegador virtual carregado com sucesso!", "success");
  } catch (err) {
    console.error("Erro ao inicializar Hyperbeam:", err);
    showToast("Erro ao conectar no stream do Hyperbeam: " + err.message, "error");
  }
}

// ====================================================
// ZOOM DO NAVEGADOR VIRTUAL (110%)
// ====================================================
async function applyVirtualBrowserZoom(factor = 1.10) {
  if (!state.hbInstance || !state.hbInstance.tabs) return;
  try {
    const tabs = await state.hbInstance.tabs.query({});
    if (tabs && tabs.length > 0) {
      for (const t of tabs) {
        if (t.id) {
          await state.hbInstance.tabs.setZoom(t.id, factor).catch(() => {});
        }
      }
    } else {
      await state.hbInstance.tabs.setZoom(factor).catch(() => {});
    }
    console.log(`[Hyperbeam Zoom]: Zoom de ${Math.round(factor * 100)}% aplicado no navegador virtual.`);
  } catch (err) {
    console.warn("[Hyperbeam Zoom error]:", err.message);
  }
}

// ====================================================
// GUARDA ANTI-POPUP E CONTROLE DE ABAS EXTRAS
// ====================================================
function setupAntiPopupGuard(hb) {
  if (!hb || !hb.tabs) return;

  try {
    hb.tabs.onCreated.addListener(async (tab) => {
      if (tab && tab.id) {
        setTimeout(() => {
          try {
            hb.tabs.setZoom(tab.id, 1.10);
          } catch (_) {}
        }, 800);
      }

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

    if (hb.tabs.onUpdated) {
      hb.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
        if (changeInfo.status === "complete") {
          try {
            await hb.tabs.setZoom(tabId, 1.10);
          } catch (_) {}
        }
      });
    }

    console.log("🛡️ Anti-Popup Guard ativo no navegador virtual.");
  } catch (err) {
    console.warn("Não foi possível registrar o listener de abas do Hyperbeam:", err);
  }
}

// ====================================================
// NAVEGAÇÃO TOUCH MOBILE (MEXER O MOUSE PELO CELULAR)
// ====================================================
function setupMobileTouchAndGestures() {
  const mount = roomElements.browserMount;
  if (!mount) return;

  if (mount.dataset.touchBound === "true") return;
  mount.dataset.touchBound = "true";

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isMoving = false;
  let lastTwoFingerCenterY = null;

  function getNormalizedCoords(touch) {
    // Busca elemento de vídeo/canvas/iframe interno do Hyperbeam para precisão exata
    const target = mount.querySelector("video") || mount.querySelector("canvas") || mount.querySelector("iframe") || mount;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0.5, y: 0.5 };

    // Proporção nativa da transmissão da VM Hyperbeam (16:9 = 1.777778)
    let naturalAspect = 16 / 9;
    if (target.videoWidth && target.videoHeight && target.videoHeight > 0) {
      naturalAspect = target.videoWidth / target.videoHeight;
    }

    const containerAspect = rect.width / rect.height;
    const computedFit = (window.getComputedStyle(target).objectFit || "contain").toLowerCase();

    let renderedWidth = rect.width;
    let renderedHeight = rect.height;
    let renderedLeft = rect.left;
    let renderedTop = rect.top;

    if (computedFit === "fill") {
      renderedWidth = rect.width;
      renderedHeight = rect.height;
      renderedLeft = rect.left;
      renderedTop = rect.top;
    } else {
      // Modo "contain" (padrão em tela cheia com barras pretas)
      if (containerAspect > naturalAspect) {
        // Barras pretas nas laterais (pillarbox) - típico em celulares na horizontal (19.5:9 ou 20:9)
        renderedHeight = rect.height;
        renderedWidth = rect.height * naturalAspect;
        renderedLeft = rect.left + (rect.width - renderedWidth) / 2;
        renderedTop = rect.top;
      } else {
        // Barras pretas no topo e embaixo (letterbox) - típico em celulares na vertical
        renderedWidth = rect.width;
        renderedHeight = rect.width / naturalAspect;
        renderedLeft = rect.left;
        renderedTop = rect.top + (rect.height - renderedHeight) / 2;
      }
    }

    // Calcula coordenadas normalizadas (0 a 1) estritamente sobre a área visível do vídeo
    const rawX = touch.clientX - renderedLeft;
    const rawY = touch.clientY - renderedTop;
    const x = Math.max(0, Math.min(1, rawX / renderedWidth));
    const y = Math.max(0, Math.min(1, rawY / renderedHeight));

    return { x, y };
  }

  // Toque inicial (touchstart)
  mount.addEventListener("touchstart", (e) => {
    if (!state.hbInstance) return;

    if (!state.isControlling) {
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      isMoving = false;

      const coords = getNormalizedCoords(touch);
      try {
        state.hbInstance.sendEvent({
          type: "mousemove",
          x: coords.x,
          y: coords.y,
        });
      } catch (err) {
        console.warn("Touchstart sendEvent error:", err);
      }
    } else if (e.touches.length === 2) {
      lastTwoFingerCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }
  }, { passive: true });

  // Mover o dedo (touchmove): mexe o cursor suavemente
  mount.addEventListener("touchmove", (e) => {
    if (!state.hbInstance || !state.isControlling) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const dist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
      if (dist > 8) {
        isMoving = true;
      }
      const coords = getNormalizedCoords(touch);
      try {
        state.hbInstance.sendEvent({
          type: "mousemove",
          x: coords.x,
          y: coords.y,
        });
      } catch (err) {
        console.warn("Touchmove sendEvent error:", err);
      }
      if (e.cancelable) e.preventDefault();
    } else if (e.touches.length === 2) {
      // Rolagem com 2 dedos (scroll wheel)
      const currentCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      if (lastTwoFingerCenterY !== null) {
        const deltaY = (lastTwoFingerCenterY - currentCenterY) * 2;
        try {
          state.hbInstance.sendEvent({
            type: "wheel",
            deltaY: deltaY,
            deltaX: 0,
          });
        } catch (err) {
          console.warn("Wheel sendEvent error:", err);
        }
      }
      lastTwoFingerCenterY = currentCenterY;
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });

  // Soltar o dedo (touchend): clique onde o usuário tocou
  mount.addEventListener("touchend", (e) => {
    if (!state.hbInstance) return;

    if (!state.isControlling) {
      if (e.changedTouches.length > 0) {
        showToast("Toque em '🎮 Controle' abaixo para mexer no virtual!", "info");
      }
      return;
    }

    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const dist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
      const duration = Date.now() - touchStartTime;

      // Se soltou em menos de 450ms e o arrasto foi mínimo (< 14px), considera TAP CLICK direto e preciso
      if (dist < 14 && duration < 450) {
        const coords = getNormalizedCoords(touch);
        try {
          state.hbInstance.sendEvent({
            type: "mousemove",
            x: coords.x,
            y: coords.y,
          });
          state.hbInstance.sendEvent({
            type: "mousedown",
            x: coords.x,
            y: coords.y,
            button: 0,
          });
          setTimeout(() => {
            if (state.hbInstance) {
              state.hbInstance.sendEvent({
                type: "mouseup",
                x: coords.x,
                y: coords.y,
                button: 0,
              });
            }
          }, 40);
        } catch (err) {
          console.warn("Tap click sendEvent error:", err);
        }
      }
    }

    if (e.touches.length === 0) {
      lastTwoFingerCenterY = null;
      isMoving = false;
    }
  }, { passive: true });
}

// ====================================================
// TECLADO NA TELA & BARRA DE DIGITAÇÃO MOBILE
// ====================================================
function setupKeyboardProxy() {
  const toggleBtn = roomElements.btnToggleKeyboard;
  const typingBar = roomElements.mobileTypingBar;
  const inputProxy = roomElements.mobileKeyboardProxy;
  const sendBtn = roomElements.btnSendTypedText;
  const closeBtn = roomElements.btnCloseTypingBar;

  if (!toggleBtn || !typingBar || !inputProxy) return;

  function openKeyboard() {
    typingBar.classList.remove("hidden");
    inputProxy.focus();
  }

  function closeKeyboard() {
    typingBar.classList.add("hidden");
    inputProxy.blur();
  }

  toggleBtn.addEventListener("click", () => {
    if (!state.isControlling) {
      showToast("Toque em '🎮 Controle' primeiro para poder digitar no virtual.", "info");
      return;
    }
    if (typingBar.classList.contains("hidden")) {
      openKeyboard();
    } else {
      closeKeyboard();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", closeKeyboard);
  }

  function sendTextToVirtual(text) {
    if (!state.hbInstance || !state.isControlling) return;
    if (text) {
      for (const char of text) {
        state.hbInstance.sendEvent({ type: "keydown", key: char });
        state.hbInstance.sendEvent({ type: "keyup", key: char });
      }
    }
  }

  function sendEnterKey() {
    if (!state.hbInstance || !state.isControlling) return;
    state.hbInstance.sendEvent({ type: "keydown", key: "Enter" });
    state.hbInstance.sendEvent({ type: "keyup", key: "Enter" });
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      const val = inputProxy.value;
      if (val) {
        sendTextToVirtual(val);
        sendEnterKey();
        showToast("Texto enviado! ↵", "info");
      } else {
        sendEnterKey();
      }
      inputProxy.value = "";
      inputProxy.focus();
    });
  }

  // Teclas especiais e Enter no teclado móvel
  inputProxy.addEventListener("keydown", (e) => {
    if (!state.hbInstance || !state.isControlling) return;

    if (e.key === "Enter") {
      e.preventDefault();
      const val = inputProxy.value;
      if (val) {
        sendTextToVirtual(val);
      }
      sendEnterKey();
      inputProxy.value = "";
      return;
    }

    if (e.key === "Backspace") {
      if (inputProxy.value.length === 0) {
        state.hbInstance.sendEvent({ type: "keydown", key: "Backspace" });
        state.hbInstance.sendEvent({ type: "keyup", key: "Backspace" });
      }
      return;
    }

    if (e.key === "Tab" || e.key === "Escape" || e.key.startsWith("Arrow")) {
      state.hbInstance.sendEvent({ type: "keydown", key: e.key });
      state.hbInstance.sendEvent({ type: "keyup", key: e.key });
      return;
    }
  });

  // Digitação em tempo real (incluindo autocompletar e swype do celular)
  inputProxy.addEventListener("input", (e) => {
    if (!state.hbInstance || !state.isControlling) return;

    if (e.inputType === "insertText" && e.data) {
      sendTextToVirtual(e.data);
    }
  });
}

// Garante que a barra de controles nunca fique oculta por sessões anteriores
localStorage.removeItem("dock_hidden");
if (roomElements.roomDock) {
  roomElements.roomDock.classList.remove("dock-hidden");
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

        case "chat_history":
          renderChatHistory(data.messages);
          break;

        case "chat":
          appendChatMessage(data);
          break;

        case "system":
          appendSystemMessage(data.text);
          break;

        case "room_deleted":
          showToast(data.message || "Esta sala foi encerrada e apagada.", "warning");
          if (state.hbInstance) {
            state.hbInstance.destroy?.();
            state.hbInstance = null;
          }
          state.currentRoom = null;
          window.history.pushState({}, "", "/");
          showScreen("lobby");
          loadRoomsList();
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

  if (data.region) {
    updateRoomRegionBadge(data.region);
  }

  // Atualizar contador online
  const count = onlineUsers.length;
  roomElements.onlineCount.textContent = `${count} ${count === 1 ? "pessoa" : "pessoas"}`;
  roomElements.tabUsersCount.textContent = count;

  // Atualizar temporizador de fechamento da sala
  if (roomElements.timerBadge && roomElements.timerText) {
    if (data.secondsLeft && data.secondsLeft > 0) {
      roomElements.timerBadge.setAttribute("data-seconds", String(data.secondsLeft));
      roomElements.timerText.textContent = `⏳ Fecha em ${formatMinutesSeconds(data.secondsLeft)}`;
      roomElements.timerBadge.className = "room-timer-badge closing";
    } else if (count <= 1) {
      roomElements.timerBadge.removeAttribute("data-seconds");
      roomElements.timerText.textContent = "⏳ Fecha 3m após sair";
      roomElements.timerBadge.className = "room-timer-badge armed";
    } else {
      roomElements.timerBadge.removeAttribute("data-seconds");
      roomElements.timerText.textContent = "🟢 Sala ativa";
      roomElements.timerBadge.className = "room-timer-badge active";
    }
  }

  // Atualizar lista de usuários
  roomElements.usersListBox.innerHTML = "";
  onlineUsers.forEach((u) => {
    const li = document.createElement("li");
    li.className = "user-row";
    const isMe = u.userId === state.user.id;
    const isCtrl = u.userId === currentController;
    const avatarHtml = u.avatar
      ? `<img src="${escapeHTML(u.avatar)}" class="u-avatar-img" alt="${escapeHTML(u.nickname)}" />`
      : `<span class="u-avatar-circle">${escapeHTML(u.nickname.charAt(0).toUpperCase())}</span>`;
    li.innerHTML = `
      <div class="u-info">
        ${avatarHtml}
        <span class="u-name">${escapeHTML(u.nickname)} ${isMe ? "(Você)" : ""}</span>
      </div>
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
    if (roomElements.controlStatusBadge) roomElements.controlStatusBadge.className = "control-status controlling";
    if (roomElements.controlStatusText) roomElements.controlStatusText.textContent = "🎮 No controle";
    if (roomElements.btnToggleControl) {
      roomElements.btnToggleControl.textContent = "🎮 No Controle";
      roomElements.btnToggleControl.className = "btn-dock btn-dock-slim control-active";
      roomElements.btnToggleControl.title = "Você está no controle! Clique para liberar.";
    }
  } else {
    if (roomElements.controlStatusBadge) roomElements.controlStatusBadge.className = "control-status";
    if (roomElements.controlStatusText) {
      roomElements.controlStatusText.textContent = controllerName
        ? `👀 ${controllerName}`
        : "👀 Livre";
    }
    if (roomElements.btnToggleControl) {
      roomElements.btnToggleControl.textContent = controllerName ? `👀 ${controllerName}` : "🎮 Controle";
      roomElements.btnToggleControl.className = "btn-dock btn-dock-slim control-inactive";
      roomElements.btnToggleControl.title = controllerName
        ? `${controllerName} está controlando. Clique para assumir.`
        : "Clique para assumir o controle do navegador virtual.";
    }
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
function leaveRoom() {
  exitFullscreenAndUnlock();
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
}

roomElements.btnLeave.addEventListener("click", leaveRoom);

// APAGAR / ENCERRAR SALA (Apenas para o criador da sala)
if (roomElements.btnDeleteRoom) {
  roomElements.btnDeleteRoom.addEventListener("click", async () => {
    if (!state.currentRoom) return;
    const confirmDel = confirm(
      `Tem certeza que deseja apagar a sala "${state.currentRoom.code}"?\n\nA máquina virtual será desligada e a sala encerrada permanentemente.`
    );
    if (!confirmDel) return;

    await deleteRoomApi(state.currentRoom.code);
  });
}

// NAVEGAR / REPRODUZIR STREAM HLS (.m3u8) OU SITE DENTRO DA SALA
async function navigateHyperbeamToUrl(rawUrl) {
  let url = (rawUrl || "").trim();
  if (!url) return;

  if (!state.isControlling) {
    if (roomElements.inputNavUrl) roomElements.inputNavUrl.value = url;
    showToast("Apenas quem está no controle pode trocar o site. Clique em '🎮 Controle' primeiro.", "error");
    return;
  }

  // Se o usuário digitou uma pesquisa (sem domínio ou com espaços), busca diretamente no Google Brasil (apenas sites do Brasil)
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    if (!url.includes(".") || url.includes(" ")) {
      url = `https://www.google.com.br/search?q=${encodeURIComponent(url)}&cr=countryBR&lr=lang_pt&gl=BR&hl=pt-BR`;
    } else {
      url = "https://" + url;
    }
  }

  // Se for YouTube sem parâmetros regionais, injeta região Brasil (gl=BR) e idioma português (hl=pt)
  if (url.includes("youtube.com") && !url.includes("gl=") && !url.includes("hl=")) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}gl=BR&hl=pt`;
  }

  // Se for Google sem país/idioma, direciona para o Google Brasil em português
  if (url === "https://www.google.com" || url === "http://www.google.com") {
    url = "https://www.google.com.br?hl=pt-BR";
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
        showToast("Carregando no navegador virtual...", "success");
        setTimeout(() => {
          applyVirtualBrowserZoom(1.10);
        }, 1500);
        if (roomElements.inputNavUrl) roomElements.inputNavUrl.value = "";
      }
    }
  } catch (err) {
    showToast("Erro ao carregar link: " + err.message, "error");
  }
}

if (roomElements.formNav) {
  roomElements.formNav.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = roomElements.inputNavUrl.value.trim();
    if (url) {
      await navigateHyperbeamToUrl(url);
    }
  });
}

if (roomElements.btnRoomNavYoutube) {
  roomElements.btnRoomNavYoutube.addEventListener("click", async () => {
    await navigateHyperbeamToUrl(PRESET_URLS.YOUTUBE);
  });
}

if (roomElements.btnRoomNavVizer) {
  roomElements.btnRoomNavVizer.addEventListener("click", async () => {
    await navigateHyperbeamToUrl(PRESET_URLS.VIZER);
  });
}

// ====================================================
// CONTROLES DE ÁUDIO (AMPLIFICADOR TURBO 300%) & TELA CHEIA
// ====================================================
// CONTROLE DE VOLUME NATIVO
// ====================================================
if (roomElements.volumeSlider) {
  roomElements.volumeSlider.addEventListener("input", (e) => {
    const vol = parseFloat(e.target.value);
    if (state.hbInstance) {
      try {
        state.hbInstance.volume = Math.max(0, Math.min(1, vol));
      } catch (_) {}
    }
    if (roomElements.btnMute) {
      roomElements.btnMute.textContent = vol === 0 ? "🔇" : (vol < 0.5 ? "🔉" : "🔊");
    }
  });
}

if (roomElements.btnMute) {
  roomElements.btnMute.addEventListener("click", () => {
    if (!roomElements.volumeSlider) return;
    const currentVol = parseFloat(roomElements.volumeSlider.value);

    if (currentVol > 0) {
      roomElements.volumeSlider.dataset.prevVolume = currentVol;
      roomElements.volumeSlider.value = 0;
      if (state.hbInstance) {
        try {
          state.hbInstance.volume = 0;
        } catch (_) {}
      }
      roomElements.btnMute.textContent = "🔇";
    } else {
      const restoreVol = parseFloat(roomElements.volumeSlider.dataset.prevVolume || "1");
      roomElements.volumeSlider.value = restoreVol;
      if (state.hbInstance) {
        try {
          state.hbInstance.volume = restoreVol;
        } catch (_) {}
      }
      roomElements.btnMute.textContent = restoreVol < 0.5 ? "🔉" : "🔊";
    }
  });
}

// ALTERNAR BLOQUEADOR DE POP-UPS
if (roomElements.btnTogglePopupBlock) {
  roomElements.btnTogglePopupBlock.addEventListener("click", () => {
    state.blockPopups = !state.blockPopups;
    if (state.blockPopups) {
      roomElements.btnTogglePopupBlock.className = "btn-dock-pill btn-dock-pill-slim active";
      roomElements.btnTogglePopupBlock.textContent = "🛡️ Pop-ups: ON";
      showToast("Bloqueador de pop-ups ATIVADO! 🛡️", "success");
    } else {
      roomElements.btnTogglePopupBlock.className = "btn-dock-pill btn-dock-pill-slim disabled";
      roomElements.btnTogglePopupBlock.textContent = "⚠️ Pop-ups: OFF";
      showToast("Bloqueador de pop-ups DESATIVADO. ⚠️", "warning");
    }
  });
}

// ====================================================
// CONTROLE DE TELA CHEIA E ROTAÇÃO HORIZONTAL (MOBILE & DESKTOP)
// ====================================================

let shouldLockLandscape = false;
let isEmulatedFullscreen = false;
let isFsChatOpen = false;
let unreadFsMessages = 0;
let isFsChatUltraTranslucent = false;

function updateFsChatBadge() {
  const badge = roomElements.fsChatBadge || document.getElementById("fs-chat-badge");
  if (!badge) return;
  if (unreadFsMessages > 0) {
    badge.textContent = unreadFsMessages > 99 ? "99+" : String(unreadFsMessages);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function toggleFullscreenChat(forceState) {
  const overlay = roomElements.fullscreenChatOverlay || document.getElementById("fullscreen-chat-overlay");
  const chatToggle = roomElements.btnFullscreenChatToggle || document.getElementById("btn-fullscreen-chat-toggle");
  if (!overlay) return;

  if (typeof forceState === "boolean") {
    isFsChatOpen = forceState;
  } else {
    isFsChatOpen = !isFsChatOpen;
  }

  if (isFsChatOpen) {
    overlay.classList.remove("hidden");
    if (chatToggle) chatToggle.classList.add("active");
    unreadFsMessages = 0;
    updateFsChatBadge();
    const input = roomElements.fsChatInput || document.getElementById("fs-chat-input");
    if (input) {
      setTimeout(() => input.focus(), 80);
    }
    const msgs = roomElements.fsChatMessages || document.getElementById("fs-chat-messages");
    if (msgs) {
      msgs.scrollTop = msgs.scrollHeight;
    }
  } else {
    overlay.classList.add("hidden");
    if (chatToggle) chatToggle.classList.remove("active");
    const input = roomElements.fsChatInput || document.getElementById("fs-chat-input");
    if (input) {
      input.blur();
    }
  }
}

function toggleFsChatOpacity() {
  const overlay = roomElements.fullscreenChatOverlay || document.getElementById("fullscreen-chat-overlay");
  if (!overlay) return;
  isFsChatUltraTranslucent = !isFsChatUltraTranslucent;
  if (isFsChatUltraTranslucent) {
    overlay.classList.add("ultra-translucent");
    showToast("Chat com transparência máxima (vídeo em destaque)", "info");
  } else {
    overlay.classList.remove("ultra-translucent");
    showToast("Chat com opacidade alta (90% de contraste)", "info");
  }
}

function getActiveFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

function isCurrentlyFullscreen() {
  return !!getActiveFullscreenElement() || isEmulatedFullscreen;
}

function updateFullscreenUIState(isFs) {
  const actionBar = document.getElementById("fullscreen-action-bar");
  const btnExit = document.getElementById("btn-fullscreen-exit");
  const btnFloating = document.getElementById("btn-fullscreen-floating");

  if (actionBar) {
    if (isFs) {
      actionBar.classList.remove("hidden");
    } else {
      actionBar.classList.add("hidden");
    }
  }

  if (btnExit) {
    if (isFs) {
      btnExit.classList.remove("hidden");
    } else {
      btnExit.classList.add("hidden");
    }
  }
  if (btnFloating) {
    if (isFs) {
      btnFloating.classList.add("hidden");
    } else {
      btnFloating.classList.remove("hidden");
    }
  }

  if (!isFs) {
    toggleFullscreenChat(false);
    unreadFsMessages = 0;
    updateFsChatBadge();
  }

  if (roomElements.btnFullscreen) {
    roomElements.btnFullscreen.title = isFs ? "Sair da Tela Cheia" : "Tela Cheia";
    roomElements.btnFullscreen.innerHTML = isFs ? "🗗" : "⛶";
  }
}

function enterEmulatedFullscreen(wrapper) {
  isEmulatedFullscreen = true;
  document.body.classList.add("fullscreen-active");
  if (wrapper) {
    wrapper.classList.add("fullscreen-emulated");
  }
  updateFullscreenUIState(true);
}

function exitEmulatedFullscreen() {
  isEmulatedFullscreen = false;
  document.body.classList.remove("fullscreen-active");
  const wrapper =
    document.getElementById("browser-wrapper") ||
    document.querySelector(".browser-wrapper");
  if (wrapper) {
    wrapper.classList.remove("fullscreen-emulated");
  }
  updateFullscreenUIState(false);
}

// Trava a tela em horizontal ("landscape")
// O parâmetro "landscape" permite que o sensor do giroscópio gire entre
// landscape-primary (90°) e landscape-secondary (270°), atendendo exatamente
// ao pedido: "vire horizontalmente porém deixe o sensor de rotação ainda ativo somente para virar na outra horizontal"
async function lockLandscapeOrientationSafely() {
  try {
    if (screen.orientation && typeof screen.orientation.lock === "function") {
      await screen.orientation.lock("landscape");
      console.log("🔒 Orientação travada em landscape (sensor dinâmico entre horizontais ativo).");
    } else if (typeof screen.lockOrientation === "function") {
      screen.lockOrientation("landscape");
    } else if (typeof screen.mozLockOrientation === "function") {
      screen.mozLockOrientation("landscape");
    } else if (typeof screen.msLockOrientation === "function") {
      screen.msLockOrientation("landscape");
    }
  } catch (err) {
    console.warn("Screen orientation lock indisponível ou rejeitado:", err.message);
  }
}

// Destrava a orientação e retorna ao modo padrão do dispositivo
function unlockOrientationSafely() {
  try {
    if (screen.orientation && typeof screen.orientation.unlock === "function") {
      screen.orientation.unlock();
      console.log("🔓 Orientação destravada (modo livre do sistema).");
    } else if (typeof screen.unlockOrientation === "function") {
      screen.unlockOrientation();
    } else if (typeof screen.mozUnlockOrientation === "function") {
      screen.mozUnlockOrientation();
    } else if (typeof screen.msUnlockOrientation === "function") {
      screen.msUnlockOrientation();
    }
  } catch (err) {
    console.warn("Screen orientation unlock:", err.message);
  }
}

async function enterFullscreenWithLandscape() {
  const room = document.getElementById("view-room");
  const wrapper =
    room ||
    document.getElementById("browser-wrapper") ||
    document.querySelector(".browser-wrapper") ||
    document.documentElement;

  shouldLockLandscape = true;
  let nativeSuccess = false;

  // 1. Tenta API Nativa do navegador (Desktop, Android Chrome, iPadOS)
  try {
    if (wrapper.requestFullscreen) {
      await wrapper.requestFullscreen();
      nativeSuccess = true;
    } else if (wrapper.webkitRequestFullscreen) {
      await wrapper.webkitRequestFullscreen();
      nativeSuccess = true;
    } else if (wrapper.mozRequestFullScreen) {
      await wrapper.mozRequestFullScreen();
      nativeSuccess = true;
    } else if (wrapper.msRequestFullscreen) {
      await wrapper.msRequestFullscreen();
      nativeSuccess = true;
    }
  } catch (err) {
    console.warn("requestFullscreen nativo falhou ou não suportado:", err.message);
    nativeSuccess = false;
  }

  // 2. Se a API nativa não for suportada (ex: iPhone / iOS Safari) ou falhou:
  // Ativa automaticamente o modo Fullscreen Emulado (CSS Pseudo-Fullscreen para iPhone/iOS)
  if (!nativeSuccess) {
    enterEmulatedFullscreen(wrapper);
  }

  // 3. Aciona o travamento horizontal se suportado
  await lockLandscapeOrientationSafely();

  // 4. Garante proporção HD 16:9 apenas se a resolução não for 1280x720 (evita que o player saia de tela cheia por resize)
  if (state.hbInstance && typeof state.hbInstance.resize === "function") {
    if (state.hbInstance.width !== 1280 || state.hbInstance.height !== 720) {
      try {
        state.hbInstance.resize(1280, 720);
      } catch (_) {}
    }
  }

  // 5. Aciona tela cheia sincronizada no player do navegador virtual (F11 e f)
  setTimeout(() => {
    triggerVirtualBrowserFullscreen();
  }, 250);

  // 6. Se for dispositivo móvel em pé, avisa que pode virar para horizontal
  if (
    window.innerWidth < window.innerHeight &&
    (window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
  ) {
    showToast("Dica: Gire o aparelho na horizontal para tela cheia completa!", "info");
  }
}

async function exitFullscreenAndUnlock() {
  shouldLockLandscape = false;

  // 1. Sai do modo emulado se estiver ativo
  if (isEmulatedFullscreen) {
    exitEmulatedFullscreen();
  }

  // 2. Sai do fullscreen nativo se estiver ativo
  try {
    if (getActiveFullscreenElement()) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
    }
  } catch (err) {
    console.warn("Erro ao sair de tela cheia:", err.message);
  }

  // 3. Envia Escape e F11 para restaurar modo normal no player do navegador virtual
  if (state.hbInstance) {
    try {
      state.hbInstance.sendEvent({ type: "keydown", key: "Escape" });
      setTimeout(() => {
        if (state.hbInstance) state.hbInstance.sendEvent({ type: "keyup", key: "Escape" });
      }, 50);
    } catch (_) {}
  }

  // 4. Restaura resolução padrão da VM Hyperbeam apenas se for diferente
  if (state.hbInstance && typeof state.hbInstance.resize === "function") {
    if (state.hbInstance.width !== 1280 || state.hbInstance.height !== 720) {
      try {
        state.hbInstance.resize(1280, 720);
      } catch (_) {}
    }
  }

  updateFullscreenUIState(false);
  unlockOrientationSafely();
}

function handleFullscreenChange() {
  const isNativeFs = !!getActiveFullscreenElement();
  const isFs = isNativeFs || isEmulatedFullscreen;
  updateFullscreenUIState(isFs);

  // Mantém SEMPRE a VM Hyperbeam na proporção 16:9 (1280x720) compartilhada
  // apenas disparando resize se as dimensões forem divergentes
  if (state.hbInstance && typeof state.hbInstance.resize === "function") {
    if (state.hbInstance.width !== 1280 || state.hbInstance.height !== 720) {
      try {
        state.hbInstance.resize(1280, 720);
      } catch (err) {
        console.warn("[Hyperbeam resize error]:", err.message);
      }
    }
  }

  if (!isFs) {
    shouldLockLandscape = false;
    unlockOrientationSafely();
  } else if (shouldLockLandscape) {
    lockLandscapeOrientationSafely();
  }
}

document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
document.addEventListener("mozfullscreenchange", handleFullscreenChange);
document.addEventListener("MSFullscreenChange", handleFullscreenChange);

// Dispara tecla de tela cheia no player interno do navegador virtual (F11 e tecla 'f')
function triggerVirtualBrowserFullscreen() {
  if (!state.hbInstance) {
    showToast("Navegador virtual não iniciado.", "warning");
    return;
  }

  try {
    // 1. Envia tecla F11 (Fullscreen nativo do Chromium virtual)
    state.hbInstance.sendEvent({ type: "keydown", key: "F11" });
    setTimeout(() => {
      if (state.hbInstance) state.hbInstance.sendEvent({ type: "keyup", key: "F11" });
    }, 50);

    // 2. Envia tecla 'f' (Atalho padrão de tela cheia de players de vídeo como Superflixapi / YouTube / HTML5)
    setTimeout(() => {
      if (state.hbInstance) {
        state.hbInstance.sendEvent({ type: "keydown", key: "f" });
        setTimeout(() => {
          if (state.hbInstance) state.hbInstance.sendEvent({ type: "keyup", key: "f" });
        }, 50);
      }
    }, 100);

    showToast("Tela Cheia (F11 / F) enviada ao player virtual!", "success");
  } catch (err) {
    console.warn("[Virtual Fullscreen error]:", err);
    showToast("Erro ao acionar tela cheia no player virtual.", "error");
  }
}

if (roomElements.btnFullscreen) {
  roomElements.btnFullscreen.addEventListener("click", () => {
    if (!isCurrentlyFullscreen()) {
      enterFullscreenWithLandscape();
    } else {
      exitFullscreenAndUnlock();
    }
  });
}

const btnFsFloating = document.getElementById("btn-fullscreen-floating");
if (btnFsFloating) {
  btnFsFloating.addEventListener("click", (e) => {
    e.stopPropagation();
    enterFullscreenWithLandscape();
  });
}

const btnFsExitFloating = document.getElementById("btn-fullscreen-exit");
if (btnFsExitFloating) {
  btnFsExitFloating.addEventListener("click", (e) => {
    e.stopPropagation();
    exitFullscreenAndUnlock();
  });
}

const btnFsChatToggle = document.getElementById("btn-fullscreen-chat-toggle");
if (btnFsChatToggle) {
  btnFsChatToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFullscreenChat();
  });
}

const btnFsChatClose = document.getElementById("btn-fs-chat-close");
if (btnFsChatClose) {
  btnFsChatClose.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFullscreenChat(false);
  });
}

const btnFsChatOpacity = document.getElementById("btn-fs-chat-opacity");
if (btnFsChatOpacity) {
  btnFsChatOpacity.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFsChatOpacity();
  });
}

const formFsChat = document.getElementById("form-fs-chat");
const fsChatInput = document.getElementById("fs-chat-input");
if (formFsChat) {
  formFsChat.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = fsChatInput ? fsChatInput.value.trim() : "";
    if (!text || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    state.ws.send(JSON.stringify({ type: "chat", text }));
    if (fsChatInput) {
      fsChatInput.value = "";
    }
  });
}

// Duplo clique ou duplo toque no player para alternar tela cheia (estilo YouTube/Netflix)
if (roomElements.browserMount) {
  roomElements.browserMount.addEventListener("dblclick", (e) => {
    if (!isCurrentlyFullscreen()) {
      enterFullscreenWithLandscape();
    } else {
      exitFullscreenAndUnlock();
    }
  });

  let lastMountTap = 0;
  roomElements.browserMount.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastMountTap < 320 && now - lastMountTap > 50) {
      if (!isCurrentlyFullscreen()) {
        enterFullscreenWithLandscape();
      } else {
        exitFullscreenAndUnlock();
      }
    }
    lastMountTap = now;
  }, { passive: true });
}

// Fechar tela cheia com tecla ESC ou alternar com tecla F ou chat com tecla C
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (isFsChatOpen) {
      toggleFullscreenChat(false);
      return;
    }
    if (isCurrentlyFullscreen()) {
      exitFullscreenAndUnlock();
    }
  }
  if ((e.key === "c" || e.key === "C") && isCurrentlyFullscreen() && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
    toggleFullscreenChat();
  }
  if ((e.key === "f" || e.key === "F") && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
    if (!isCurrentlyFullscreen()) {
      enterFullscreenWithLandscape();
    } else {
      exitFullscreenAndUnlock();
    }
  }
});

// Suporte para giro de tela no iPhone
window.addEventListener("orientationchange", () => {
  if (isCurrentlyFullscreen()) {
    window.scrollTo(0, 0);
  }
});

// ====================================================
// CHAT & SIDEBAR
// ====================================================
if (roomElements.btnToggleSidebar) {
  roomElements.btnToggleSidebar.addEventListener("click", () => {
    roomElements.sidebar.classList.toggle("collapsed");
  });
}

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

function renderChatHistory(messages) {
  if (roomElements.chatMessagesBox) {
    roomElements.chatMessagesBox.innerHTML = `
      <div class="chat-item system">
        <span>Bem-vindo à sala! Envie o link ou senha para seus amigos.</span>
      </div>
    `;
  }

  const fsBox = roomElements.fsChatMessages || document.getElementById("fs-chat-messages");
  if (fsBox) {
    fsBox.innerHTML = `
      <div class="chat-item system">
        <span>Conversa em tela cheia ativa. Escreva abaixo sem sair do vídeo!</span>
      </div>
    `;
  }

  if (Array.isArray(messages) && messages.length > 0) {
    messages.forEach((msg) => {
      appendChatMessage(msg);
    });
  }
}

function buildChatBubbleRow(msg, isMe) {
  const row = document.createElement("div");
  row.className = `chat-bubble-row ${isMe ? "own" : "other"}`;

  const senderName = escapeHTML(msg.user || "Anônimo");
  const firstLetter = (msg.user ? msg.user.charAt(0).toUpperCase() : "?");
  const textHtml = escapeHTML(msg.text);
  const avatarHtml = msg.avatar
    ? `<img src="${escapeHTML(msg.avatar)}" class="chat-avatar-img" alt="${senderName}" />`
    : firstLetter;

  if (isMe) {
    row.innerHTML = `
      <div class="chat-bubble-body">
        <div class="chat-bubble own-bubble">${textHtml}</div>
      </div>
    `;
  } else {
    row.innerHTML = `
      <div class="chat-bubble-avatar">${avatarHtml}</div>
      <div class="chat-bubble-body">
        <span class="chat-sender-name">${senderName}</span>
        <div class="chat-bubble other-bubble">${textHtml}</div>
      </div>
    `;
  }

  return row;
}

function appendChatMessage(msg) {
  const isMe = Boolean(
    state.user &&
    ((msg.userId && msg.userId === state.user.id) ||
     (msg.user && state.user.nickname && msg.user.toLowerCase() === state.user.nickname.toLowerCase()))
  );

  if (roomElements.chatMessagesBox) {
    roomElements.chatMessagesBox.appendChild(buildChatBubbleRow(msg, isMe));
    roomElements.chatMessagesBox.scrollTop = roomElements.chatMessagesBox.scrollHeight;
  }

  const fsBox = roomElements.fsChatMessages || document.getElementById("fs-chat-messages");
  if (fsBox) {
    fsBox.appendChild(buildChatBubbleRow(msg, isMe));
    fsBox.scrollTop = fsBox.scrollHeight;
  }

  if (isCurrentlyFullscreen() && !isFsChatOpen) {
    unreadFsMessages++;
    updateFsChatBadge();
  }
}

function appendSystemMessage(text) {
  function makeSystemItem() {
    const item = document.createElement("div");
    item.className = "chat-item system";
    item.innerHTML = `<span>${escapeHTML(text)}</span>`;
    return item;
  }

  if (roomElements.chatMessagesBox) {
    roomElements.chatMessagesBox.appendChild(makeSystemItem());
    roomElements.chatMessagesBox.scrollTop = roomElements.chatMessagesBox.scrollHeight;
  }

  const fsBox = roomElements.fsChatMessages || document.getElementById("fs-chat-messages");
  if (fsBox) {
    fsBox.appendChild(makeSystemItem());
    fsBox.scrollTop = fsBox.scrollHeight;
  }
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
  setupKeyboardProxy();
  checkInviteRoute();
  checkAuth();
});
