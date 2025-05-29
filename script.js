import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, addDoc, deleteDoc, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const DEFAULT_CUSTOM_TEAM_COLORS = ["#007bff", "#dc3545", "#28a745", "#ffc107", "#6f42c1"];
// players agora será um array de objetos com id, name, checked, lastModified
let players = [];
let checkedState = {}; // Derivado do array de players
let generatedTeams = [];
let winningScore = 15;
let setsToWin = 0;
let playersPerTeam = 4;
// customTeamNames agora será um array de objetos com id, name, color, order, lastModified
let customTeamNames = [];
let currentTheme = 'dark';
let vibrationEnabled = true;
let showPlayersOnScoreboard = true;
let scoreA = 0, scoreB = 0;
let setsA = 0, setsB = 0;
let gameEnded = false;
let gameStarted = false;
let lastWinningTeam = null;
let currentPlayingTeamA = { name: 'Time A', players: [], color: '#007bff' };
let currentPlayingTeamB = { name: 'Time B', players: [], color: '#dc3545' };
let activeManageTeamId = null;
let gameTimerInterval = null;
let setTimerInterval = null;
let gameTimeInSeconds = 0;
let setTimeInSeconds = 0;
let isTimerRunning = false;
// appointments agora será um array de objetos com id, date, time, location, lastModified
let appointments = [];
let newWorker = null;

let db;
let auth;
let userId;
let isAuthReady = false;
let isOnline = navigator.onLine; // Flag para status da conexão

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : `{
  "apiKey": "AIzaSyBeu7H2Us7FYNb0yhGx8pkYj_aeTgnndUA",
  "authDomain": "voleizinho-das-ruas.firebaseapp.com",
  "databaseURL": "https://voleizinho-das-ruas-default-rtdb.firebaseio.com",
  "projectId": "voleizinho-das-ruas",
  "storageBucket": "voleizinho-das-ruas.firebasestorage.app",
  "messagingSenderId": "394754605937",
  "appId": "1:394754605937:web:e97314f6c48373c8dc2cd0"
}`);

/**
 * Inicializa o Firebase e a autenticação.
 * Configura o listener de estado de autenticação para carregar dados e configurar listeners do Firestore.
 */
async function initFirebase() {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            document.getElementById('userIdDisplay').textContent = `ID do Usuário: ${userId}`;
        } else {
            // Se não houver usuário logado, tenta login anônimo
            try {
                await signInAnonymously(auth);
                userId = auth.currentUser.uid; // Pega o UID do usuário anônimo
                document.getElementById('userIdDisplay').textContent = `ID do Usuário: ${userId} (Anônimo)`;
            } catch (anonError) {
                console.error("Erro ao fazer login anonimamente:", anonError);
                userId = crypto.randomUUID(); // Fallback para um ID aleatório se o login anônimo falhar
                document.getElementById('userIdDisplay').textContent = `ID do Usuário: ${userId} (Erro de Auth)`;
            }
        }
        isAuthReady = true;
        // Se estiver online, sincroniza dados locais para o Firestore e configura listeners
        if (isOnline) {
            await syncLocalToFirestore();
            setupFirestoreListeners();
        } else {
            console.log("Offline: Firestore listeners não serão configurados até que a conexão seja reestabelecida.");
        }
    });

    // Tenta autenticar com token personalizado se disponível
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
            await signInWithCustomToken(auth, __initial_auth_token);
        } catch (error) {
            console.log("Erro ao autenticar com token personalizado, tentando anonimamente:", error);
            await signInAnonymously(auth);
        }
    } else {
        await signInAnonymously(auth);
    }
}

/**
 * Carrega todas as configurações e dados do localStorage.
 * Atualiza o estado do aplicativo com os dados carregados.
 */
function loadLocalSettings() {
    winningScore = parseInt(localStorage.getItem('winningScore') || '15');
    setsToWin = parseInt(localStorage.getItem('setsToWin') || '0');
    playersPerTeam = parseInt(localStorage.getItem('playersPerTeam') || '4');
    currentTheme = localStorage.getItem('theme') || 'dark';
    vibrationEnabled = JSON.parse(localStorage.getItem('vibrationEnabled') || 'true');
    showPlayersOnScoreboard = JSON.parse(localStorage.getItem('showPlayersOnScoreboard') || 'true');
    scoreA = parseInt(localStorage.getItem('scoreA') || '0');
    scoreB = parseInt(localStorage.getItem('scoreB') || '0');
    setsA = parseInt(localStorage.getItem('setsA') || '0');
    setsB = parseInt(localStorage.getItem('setsB') || '0');
    gameEnded = JSON.parse(localStorage.getItem('gameEnded') || 'false');
    gameStarted = JSON.parse(localStorage.getItem('gameStarted') || 'false');
    lastWinningTeam = localStorage.getItem('lastWinningTeam') || null;
    currentPlayingTeamA = JSON.parse(localStorage.getItem('currentPlayingTeamA') || JSON.stringify({ name: 'Time A', players: [], color: '#007bff' }));
    currentPlayingTeamB = JSON.parse(localStorage.getItem('currentPlayingTeamB') || JSON.stringify({ name: 'Time B', players: [], color: '#dc3545' }));
    gameTimeInSeconds = parseInt(localStorage.getItem('gameTimeInSeconds') || '0');
    setTimeInSeconds = parseInt(localStorage.getItem('setTimeInSeconds') || '0');
    isTimerRunning = JSON.parse(localStorage.getItem('isTimerRunning') || 'false');

    // Carrega dados específicos que agora são objetos com ID e lastModified
    players = JSON.parse(localStorage.getItem('players') || '[]');
    // Recria checkedState a partir dos players carregados
    checkedState = {};
    players.forEach(p => {
        checkedState[p.name] = p.checked;
    });

    appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    customTeamNames = JSON.parse(localStorage.getItem('customTeamNames') || '[]');

    // Atualiza a UI com os dados carregados
    document.getElementById('winningScore').value = winningScore;
    document.getElementById('setsToWinConfig').value = setsToWin;
    document.getElementById('playersPerTeam').value = playersPerTeam;
    document.getElementById('vibrationEnabled').checked = vibrationEnabled;
    document.getElementById('showPlayersOnScoreboard').checked = showPlayersOnScoreboard;
    document.getElementById('themeSelect').value = currentTheme;
    setTheme(currentTheme, false); // Não salva novamente ao carregar
    updatePlayerDisplayOnScoreboard();
    updateScoreboardTeamsDisplay();
    document.getElementById("scoreA").textContent = scoreA;
    document.getElementById("scoreB").textContent = scoreB;
    updateSetsDisplay();
    updateTimerDisplay();
    if (gameStarted && isTimerRunning) {
        startAllTimers();
    } else {
        stopAllTimers();
    }
    // Renderiza listas que dependem dos dados carregados
    updatePlayerList();
    renderAppointments();
    renderCustomTeamNamesConfig(); // Nova função para renderizar configs de times
    renderGeneratedTeams(); // Garante que times gerados (se houver) sejam exibidos
}

/**
 * Salva todas as configurações e dados no localStorage.
 */
async function saveLocalSettings() {
    localStorage.setItem('winningScore', winningScore.toString());
    localStorage.setItem('setsToWin', setsToWin.toString());
    localStorage.setItem('playersPerTeam', playersPerTeam.toString());
    localStorage.setItem('vibrationEnabled', JSON.stringify(vibrationEnabled));
    localStorage.setItem('showPlayersOnScoreboard', JSON.stringify(showPlayersOnScoreboard));
    localStorage.setItem('theme', currentTheme);
    localStorage.setItem('scoreA', scoreA.toString());
    localStorage.setItem('scoreB', scoreB.toString());
    localStorage.setItem('setsA', setsA.toString());
    localStorage.setItem('setsB', setsB.toString());
    localStorage.setItem('gameEnded', JSON.stringify(gameEnded));
    localStorage.setItem('gameStarted', JSON.stringify(gameStarted));
    localStorage.setItem('lastWinningTeam', lastWinningTeam);
    localStorage.setItem('currentPlayingTeamA', JSON.stringify(currentPlayingTeamA));
    localStorage.setItem('currentPlayingTeamB', JSON.stringify(currentPlayingTeamB));
    localStorage.setItem('gameTimeInSeconds', gameTimeInSeconds.toString());
    localStorage.setItem('setTimeInSeconds', setTimeInSeconds.toString());
    localStorage.setItem('isTimerRunning', JSON.stringify(isTimerRunning));
    localStorage.setItem('generatedTeams', JSON.stringify(generatedTeams)); // Salva times gerados

    // Salva os arrays de objetos com ID e lastModified
    localStorage.setItem('players', JSON.stringify(players));
    localStorage.setItem('checkedState', JSON.stringify(checkedState)); // Salva o estado de checked separadamente
    localStorage.setItem('appointments', JSON.stringify(appointments));
    localStorage.setItem('customTeamNames', JSON.stringify(customTeamNames));

    updatePlayerDisplayOnScoreboard();
    applyTeamColorsToScoreboard();
}

/**
 * Configura os listeners em tempo real do Firestore para jogadores, agendamentos e nomes de times personalizados.
 * Realiza a fusão de dados com base no timestamp lastModified.
 */
function setupFirestoreListeners() {
    if (!isAuthReady || !isOnline) {
        console.log("Firestore listeners não configurados: Auth não pronto ou offline.");
        return;
    }

    // Listener para Jogadores
    onSnapshot(collection(db, `artifacts/${appId}/public/data/players`), (snapshot) => {
        const fetchedPlayers = [];
        snapshot.forEach(doc => {
            fetchedPlayers.push({ id: doc.id, ...doc.data() });
        });

        // Fusão de dados: Firebase é a fonte de verdade quando online
        const newPlayers = [];
        const newCheckedState = {};
        fetchedPlayers.forEach(fbPlayer => {
            const localPlayer = players.find(p => p.id === fbPlayer.id);
            if (localPlayer) {
                // Se o Firebase for mais recente ou igual, usa a versão do Firebase
                if (fbPlayer.lastModified >= localPlayer.lastModified) {
                    newPlayers.push(fbPlayer);
                } else {
                    // Se o local for mais recente (e já deveria ter sido sincronizado), mantém o local
                    // Ou, se o Firebase for mais antigo, atualiza o Firebase com o local (isso é feito em syncLocalToFirestore)
                    newPlayers.push(localPlayer);
                }
            } else {
                // Jogador novo no Firebase, adiciona localmente
                newPlayers.push(fbPlayer);
            }
            newCheckedState[fbPlayer.name] = fbPlayer.checked;
        });

        // Remove jogadores locais que não existem mais no Firebase
        players.forEach(localPlayer => {
            if (!fetchedPlayers.some(fbPlayer => fbPlayer.id === localPlayer.id)) {
                // Jogador foi deletado no Firebase, remove localmente
                // Não adiciona a newPlayers
            }
        });

        players = newPlayers;
        checkedState = newCheckedState;
        saveLocalSettings(); // Salva o estado atualizado no localStorage
        updatePlayerList();
    }, (error) => {
        console.error("Erro ao carregar jogadores do Firestore:", error);
        displayMessage("Erro ao carregar jogadores do servidor.", "error");
    });

    // Listener para Agendamentos
    onSnapshot(collection(db, `artifacts/${appId}/public/data/appointments`), (snapshot) => {
        const fetchedAppointments = [];
        snapshot.forEach(doc => {
            fetchedAppointments.push({ id: doc.id, ...doc.data() });
        });

        const newAppointments = [];
        fetchedAppointments.forEach(fbAppt => {
            const localAppt = appointments.find(a => a.id === fbAppt.id);
            if (localAppt) {
                if (fbAppt.lastModified >= localAppt.lastModified) {
                    newAppointments.push(fbAppt);
                } else {
                    newAppointments.push(localAppt);
                }
            } else {
                newAppointments.push(fbAppt);
            }
        });

        appointments.forEach(localAppt => {
            if (!fetchedAppointments.some(fbAppt => fbAppt.id === localAppt.id)) {
                // Agendamento deletado no Firebase, remove localmente
            }
        });

        appointments = newAppointments;
        saveLocalSettings();
        renderAppointments();
    }, (error) => {
        console.error("Erro ao carregar agendamentos do Firestore:", error);
        displayMessage("Erro ao carregar agendamentos do servidor.", "error");
    });

    // Listener para Nomes de Times Personalizados
    onSnapshot(query(collection(db, `artifacts/${appId}/public/data/customTeamNames`), orderBy('order')), (snapshot) => {
        const fetchedCustomTeamNames = [];
        snapshot.forEach(doc => {
            fetchedCustomTeamNames.push({ id: doc.id, ...doc.data() });
        });

        const newCustomTeamNames = [];
        fetchedCustomTeamNames.forEach(fbTeam => {
            const localTeam = customTeamNames.find(t => t.id === fbTeam.id);
            if (localTeam) {
                if (fbTeam.lastModified >= localTeam.lastModified) {
                    newCustomTeamNames.push(fbTeam);
                } else {
                    newCustomTeamNames.push(localTeam);
                }
            } else {
                newCustomTeamNames.push(fbTeam);
            }
        });

        // Garante que sempre haja 5 times personalizados
        while (newCustomTeamNames.length < 5) {
            newCustomTeamNames.push({
                id: null, // Será gerado pelo Firebase
                name: "",
                color: DEFAULT_CUSTOM_TEAM_COLORS[newCustomTeamNames.length] || '#cccccc',
                order: newCustomTeamNames.length,
                lastModified: Date.now()
            });
        }
        customTeamNames = newCustomTeamNames;
        saveLocalSettings();
        renderCustomTeamNamesConfig(); // Renderiza a UI das configurações de times
        renderGeneratedTeams(); // Atualiza a exibição dos times gerados
    }, (error) => {
        console.error("Erro ao carregar nomes de times personalizados do Firestore:", error);
        displayMessage("Erro ao carregar nomes de times personalizados do servidor.", "error");
    });
}

/**
 * Sincroniza as alterações locais (localStorage) para o Firestore.
 * Isso é chamado quando a aplicação fica online.
 */
async function syncLocalToFirestore() {
    if (!isAuthReady || !isOnline) return;

    console.log("Sincronizando alterações locais para o Firestore...");

    // Sincronizar Jogadores
    const playersCollectionRef = collection(db, `artifacts/${appId}/public/data/players`);
    const firebasePlayersSnapshot = await getDocs(playersCollectionRef);
    const firebasePlayers = firebasePlayersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (const localPlayer of players) {
        const fbPlayer = firebasePlayers.find(p => p.id === localPlayer.id);

        if (!fbPlayer) {
            // Jogador local não existe no Firebase (criado offline ou ID ainda não atribuído)
            if (!localPlayer.id) { // Novo jogador sem ID do Firebase
                try {
                    const docRef = await addDoc(playersCollectionRef, {
                        name: localPlayer.name,
                        checked: localPlayer.checked,
                        lastModified: localPlayer.lastModified
                    });
                    localPlayer.id = docRef.id; // Atribui o ID do Firebase ao objeto local
                    console.log(`Jogador '${localPlayer.name}' adicionado ao Firestore.`);
                } catch (e) {
                    console.error(`Erro ao adicionar jogador '${localPlayer.name}' ao Firestore:`, e);
                }
            } else {
                // Jogador local com ID, mas não encontrado no Firebase (provavelmente deletado por outro usuário)
                // Remove localmente (já feito pelo onSnapshot, mas garante consistência)
                console.log(`Jogador '${localPlayer.name}' (ID: ${localPlayer.id}) não encontrado no Firestore, removendo localmente.`);
                players = players.filter(p => p.id !== localPlayer.id);
            }
        } else {
            // Jogador existe em ambos, verifica lastModified para atualizar
            if (localPlayer.lastModified > fbPlayer.lastModified) {
                try {
                    await updateDoc(doc(playersCollectionRef, localPlayer.id), {
                        name: localPlayer.name, // Pode ser necessário se o nome puder ser editado
                        checked: localPlayer.checked,
                        lastModified: localPlayer.lastModified
                    });
                    console.log(`Jogador '${localPlayer.name}' atualizado no Firestore.`);
                } catch (e) {
                    console.error(`Erro ao atualizar jogador '${localPlayer.name}' no Firestore:`, e);
                }
            }
        }
    }

    // Sincronizar Agendamentos
    const appointmentsCollectionRef = collection(db, `artifacts/${appId}/public/data/appointments`);
    const firebaseAppointmentsSnapshot = await getDocs(appointmentsCollectionRef);
    const firebaseAppointments = firebaseAppointmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (const localAppt of appointments) {
        const fbAppt = firebaseAppointments.find(a => a.id === localAppt.id);

        if (!fbAppt) {
            if (!localAppt.id) { // Novo agendamento sem ID do Firebase
                try {
                    const docRef = await addDoc(appointmentsCollectionRef, {
                        date: localAppt.date,
                        time: localAppt.time,
                        location: localAppt.location,
                        lastModified: localAppt.lastModified
                    });
                    localAppt.id = docRef.id;
                    console.log(`Agendamento em '${localAppt.date}' adicionado ao Firestore.`);
                } catch (e) {
                    console.error(`Erro ao adicionar agendamento em '${localAppt.date}' ao Firestore:`, e);
                }
            } else {
                console.log(`Agendamento (ID: ${localAppt.id}) não encontrado no Firestore, removendo localmente.`);
                appointments = appointments.filter(a => a.id !== localAppt.id);
            }
        } else {
            if (localAppt.lastModified > fbAppt.lastModified) {
                try {
                    await updateDoc(doc(appointmentsCollectionRef, localAppt.id), {
                        date: localAppt.date,
                        time: localAppt.time,
                        location: localAppt.location,
                        lastModified: localAppt.lastModified
                    });
                    console.log(`Agendamento em '${localAppt.date}' atualizado no Firestore.`);
                } catch (e) {
                    console.error(`Erro ao atualizar agendamento em '${localAppt.date}' no Firestore:`, e);
                }
            }
        }
    }

    // Sincronizar Nomes de Times Personalizados (sempre sobrescreve o Firebase com o local se o local for mais recente)
    const customTeamNamesCollectionRef = collection(db, `artifacts/${appId}/public/data/customTeamNames`);
    const firebaseCustomTeamNamesSnapshot = await getDocs(customTeamNamesCollectionRef);
    const firebaseCustomTeamNames = firebaseCustomTeamNamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (let i = 0; i < customTeamNames.length; i++) {
        const localTeam = customTeamNames[i];
        const fbTeam = firebaseCustomTeamNames.find(t => t.id === localTeam.id || t.order === localTeam.order); // Tenta encontrar pelo ID ou pela ordem

        if (!fbTeam) {
            // Time local não existe no Firebase, adiciona
            try {
                const docRef = await addDoc(customTeamNamesCollectionRef, {
                    name: localTeam.name,
                    color: localTeam.color,
                    order: localTeam.order,
                    lastModified: localTeam.lastModified
                });
                localTeam.id = docRef.id;
                console.log(`Time personalizado '${localTeam.name}' adicionado ao Firestore.`);
            } catch (e) {
                console.error(`Erro ao adicionar time personalizado '${localTeam.name}' ao Firestore:`, e);
            }
        } else {
            // Time existe em ambos, verifica lastModified para atualizar
            if (localTeam.lastModified > fbTeam.lastModified) {
                try {
                    // Se o ID local for nulo mas o Firebase tiver um ID para a mesma ordem, usa o ID do Firebase
                    const targetId = localTeam.id || fbTeam.id;
                    await setDoc(doc(customTeamNamesCollectionRef, targetId), {
                        name: localTeam.name,
                        color: localTeam.color,
                        order: localTeam.order,
                        lastModified: localTeam.lastModified
                    });
                    localTeam.id = targetId; // Garante que o ID local seja o do Firebase
                    console.log(`Time personalizado '${localTeam.name}' atualizado no Firestore.`);
                } catch (e) {
                    console.error(`Erro ao atualizar time personalizado '${localTeam.name}' no Firestore:`, e);
                }
            } else if (!localTeam.id && fbTeam.id) {
                // Se o local não tem ID mas o Firebase tem, atualiza o local com o ID do Firebase
                localTeam.id = fbTeam.id;
            }
        }
    }
    saveLocalSettings(); // Salva todas as alterações após a sincronização
    console.log("Sincronização local para Firestore concluída.");
}

/**
 * Renderiza os campos de input para os nomes de times personalizados.
 */
function renderCustomTeamNamesConfig() {
    for (let i = 0; i < 5; i++) {
        const team = customTeamNames[i] || { name: "", color: DEFAULT_CUSTOM_TEAM_COLORS[i] || '#cccccc' };
        const nameInput = document.getElementById(`customTeamName${i + 1}`);
        const colorInput = document.getElementById(`customTeamColor${i + 1}`);
        if (nameInput) nameInput.value = team.name || "";
        if (colorInput) colorInput.value = team.color || DEFAULT_CUSTOM_TEAM_COLORS[i] || '#cccccc';
    }
}

function toggleMenu() {
  const menu = document.getElementById("gearMenu");
  const overlay = document.getElementById("menuOverlay");
  menu.classList.toggle("show");
  overlay.classList.toggle("show");
  updateResetButtonVisibility();
  if (menu.classList.contains("show")) {
    document.addEventListener('click', closeMenuOnOutsideClick);
  } else {
    document.removeEventListener('click', closeMenuOnOutsideClick);
  }
}

function closeMenuOnOutsideClick(e) {
  const menu = document.getElementById("gearMenu");
  const button = document.querySelector(".gear-button");
  if (!menu.contains(e.target) && !button.contains(e.target)) {
    if (menu.classList.contains("show")) {
        menu.classList.remove("show");
        document.getElementById("menuOverlay").classList.remove("show");
        document.removeEventListener('click', closeMenuOnOutsideClick);
    }
  }
}

function navigateTo(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById("gearMenu").classList.remove("show");
  document.getElementById("menuOverlay").classList.remove("show");
  updateResetButtonVisibility();
  if (id === 'times') {
      renderGeneratedTeams();
  } else if (id === 'agendamentos') {
      renderAppointments();
  }
}

function updateResetButtonVisibility() {
    const resetButton = document.getElementById('resetGameButton');
    const pontuacaoSection = document.getElementById('pontuacao');
    if (gameStarted && pontuacaoSection.classList.contains('active')) {
        resetButton.classList.remove('disabled');
    } else {
        resetButton.classList.add('disabled');
    }
}

/**
 * Adiciona um novo jogador. Salva localmente e, se online, no Firestore.
 */
async function addPlayer() {
  const input = document.getElementById("playerName");
  const name = input.value.trim();
  if (name && !players.some(p => p.name === name)) {
    const newPlayer = {
        id: null, // O ID será atribuído pelo Firebase se online
        name: name,
        checked: true,
        lastModified: Date.now()
    };
    players.push(newPlayer);
    checkedState[name] = true;
    input.value = "";
    updatePlayerList();
    await saveLocalSettings(); // Salva localmente

    if (isOnline && isAuthReady) {
        try {
            const docRef = await addDoc(collection(db, `artifacts/${appId}/public/data/players`), {
                name: newPlayer.name,
                checked: newPlayer.checked,
                lastModified: newPlayer.lastModified
            });
            newPlayer.id = docRef.id; // Atualiza o ID do jogador local com o ID do Firebase
            await saveLocalSettings(); // Salva novamente para persistir o ID do Firebase
            displayMessage("Jogador adicionado e sincronizado!", "success");
        } catch (e) {
            displayMessage("Erro ao adicionar jogador ao servidor. Salvo localmente.", "error");
            console.error("Erro ao adicionar jogador ao Firestore:", e);
        }
    } else {
        displayMessage("Jogador adicionado localmente. Sincronizará quando online.", "info");
    }
  } else if (players.some(p => p.name === name)) {
    displayMessage("Este nome já está na lista.", "warning");
  }
}

/**
 * Atualiza a lista de jogadores na UI.
 */
function updatePlayerList() {
  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }));
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  sortedPlayers.forEach((p) => {
    const li = document.createElement("li");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = p.checked; // Usa o checked do objeto do jogador
    checkbox.style.marginRight = '.5rem';
    checkbox.style.width = '1rem';
    checkbox.onchange = async () => {
      p.checked = checkbox.checked; // Atualiza o objeto do jogador
      p.lastModified = Date.now(); // Atualiza o timestamp de modificação
      checkedState[p.name] = p.checked; // Atualiza o checkedState
      await saveLocalSettings(); // Salva localmente

      if (isOnline && isAuthReady && p.id) { // Só tenta atualizar no Firebase se tiver ID e estiver online
          try {
              await updateDoc(doc(db, `artifacts/${appId}/public/data/players`, p.id), {
                  checked: p.checked,
                  lastModified: p.lastModified
              });
              displayMessage("Status do jogador sincronizado!", "success");
          } catch (e) {
              displayMessage("Erro ao sincronizar status do jogador. Salvo localmente.", "error");
              console.error("Erro ao atualizar status do jogador no Firestore:", e);
          }
      } else if (isOnline && isAuthReady && !p.id) {
          // Jogador sem ID, tenta adicionar ao Firebase
          try {
              const docRef = await addDoc(collection(db, `artifacts/${appId}/public/data/players`), {
                  name: p.name,
                  checked: p.checked,
                  lastModified: p.lastModified
              });
              p.id = docRef.id;
              await saveLocalSettings();
              displayMessage("Jogador sincronizado com ID!", "success");
          } catch (e) {
              displayMessage("Erro ao sincronizar jogador sem ID. Salvo localmente.", "error");
              console.error("Erro ao adicionar jogador sem ID ao Firestore:", e);
          }
      } else {
          displayMessage("Status do jogador atualizado localmente. Sincronizará quando online.", "info");
      }
      updatePlayerCounter();
      updateToggleSelectAllButtonText();
    };
    const span = document.createElement("span");
    span.textContent = p.name;
    const btn = document.createElement("button");
    btn.textContent = "Remover";
    btn.className = "btn";
    btn.onclick = () => {
        showConfirmationModal("Tem certeza que deseja remover este jogador?", async (confirmed) => {
            if (confirmed) {
                // Remove localmente
                const playerIndex = players.findIndex(player => player.id === p.id);
                if (playerIndex > -1) {
                    const removedPlayer = players.splice(playerIndex, 1)[0];
                    delete checkedState[removedPlayer.name];
                    await saveLocalSettings(); // Salva localmente
                    updatePlayerList();
                    generatedTeams = []; // Reinicia os times gerados ao remover um jogador
                    renderGeneratedTeams();

                    if (isOnline && isAuthReady && removedPlayer.id) {
                        try {
                            await deleteDoc(doc(db, `artifacts/${appId}/public/data/players`, removedPlayer.id));
                            displayMessage("Jogador removido e sincronizado!", "success");
                        } catch (e) {
                            displayMessage("Erro ao remover jogador do servidor. Removido localmente.", "error");
                            console.error("Erro ao remover jogador do Firestore:", e);
                        }
                    } else {
                        displayMessage("Jogador removido localmente. Sincronizará quando online.", "info");
                    }
                }
            }
        });
    };
    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(btn);
    list.appendChild(li);
  });
  updatePlayerCounter();
  updateToggleSelectAllButtonText();
}

function updatePlayerCounter() {
  const selected = players.filter(p => p.checked !== false).length; // Usa p.checked diretamente
  const total = players.length;
  document.getElementById("playerCounter").textContent = `${selected}/${total}`;
}

/**
 * Alterna a seleção de todos os jogadores. Salva localmente e, se online, no Firestore.
 */
async function toggleSelectAllPlayers() {
  const allSelected = players.every(p => p.checked !== false);
  const newCheckedState = !allSelected;

  // Atualiza o estado local de todos os jogadores
  players.forEach(p => {
      p.checked = newCheckedState;
      p.lastModified = Date.now();
      checkedState[p.name] = newCheckedState;
  });
  await saveLocalSettings(); // Salva localmente
  updatePlayerList(); // Atualiza a UI

  if (isOnline && isAuthReady) {
      try {
          const batch = [];
          const playersCollectionRef = collection(db, `artifacts/${appId}/public/data/players`);
          // Busca todos os documentos para ter seus IDs
          const querySnapshot = await getDocs(playersCollectionRef);
          querySnapshot.forEach(playerDoc => {
              const localPlayer = players.find(p => p.id === playerDoc.id);
              if (localPlayer) { // Garante que o jogador ainda existe localmente
                  batch.push(updateDoc(doc(db, `artifacts/${appId}/public/data/players`, playerDoc.id), {
                      checked: localPlayer.checked,
                      lastModified: localPlayer.lastModified
                  }));
              }
          });
          await Promise.all(batch);
          displayMessage("Seleção de jogadores sincronizada!", "success");
      } catch (e) {
          displayMessage("Erro ao sincronizar seleção de jogadores. Salvo localmente.", "error");
          console.error("Erro ao alternar seleção de jogadores no Firestore:", e);
      }
  } else {
      displayMessage("Seleção de jogadores atualizada localmente. Sincronizará quando online.", "info");
  }
}

function updateToggleSelectAllButtonText() {
  const toggleButton = document.getElementById('toggleSelectAllButton');
  if (toggleButton) {
    const allSelected = players.every(p => p.checked !== false);
    if (allSelected && players.length > 0) {
      toggleButton.textContent = "Desselecionar Todos";
    } else {
      toggleButton.textContent = "Selecionar Todos";
    }
  }
}

function confirmReset() {
    const resetButton = document.getElementById('resetGameButton');
    if (resetButton.classList.contains('disabled')) {
        return;
    }
    showConfirmationModal("Tem certeza que deseja reiniciar a pontuação? Isso irá zerar os pontos e sets de ambos os times.", async (confirmed) => {
        if (confirmed) {
            await resetGame();
            document.getElementById("gearMenu").classList.remove("show");
            document.getElementById("menuOverlay").classList.remove("show");
        }
    });
}

async function resetGame() {
  scoreA = 0;
  scoreB = 0;
  setsA = 0;
  setsB = 0;
  gameEnded = false;
  gameStarted = false;
  lastWinningTeam = null;
  document.getElementById("scoreA").textContent = 0;
  document.getElementById("scoreB").textContent = 0;
  updateSetsDisplay();
  updateScoreboardTeamsDisplay();
  updateResetButtonVisibility();
  updateSwapTeamsButtonVisibility();
  showStartGameModal(); // Mantenha esta chamada aqui, pois é para reiniciar a partida
  generatedTeams = []; // Reinicia os times gerados ao reiniciar o jogo
  renderGeneratedTeams();
  stopAllTimers();
  gameTimeInSeconds = 0;
  setTimeInSeconds = 0;
  updateTimerDisplay();
  await saveLocalSettings();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

async function generateCustomTeams() {
  const perTeam = parseInt(document.getElementById("playersPerTeam").value);
  if (isNaN(perTeam) || perTeam <= 0) {
    displayMessage("Informe um número válido de jogadores por time.", "error");
    return false;
  }
  const selectedPlayers = players.filter(p => p.checked !== false).map(p => p.name); // Pega apenas os nomes
  if (selectedPlayers.length < 2) {
    displayMessage("Selecione pelo menos dois jogadores para gerar times.", "error");
    return false;
  }
  if (selectedPlayers.length < perTeam) {
      displayMessage(`Você precisa de pelo menos ${perTeam} jogadores selecionados para gerar um time.`, "error");
      return false;
  }
  
  shuffle(selectedPlayers);

  generatedTeams = [];
  let teamCount = 0;
  for (let i = 0; i < selectedPlayers.length; i += perTeam) {
    teamCount++;
    const customTeamConfig = customTeamNames[teamCount - 1]; // Usa a configuração do time personalizado
    const teamName = customTeamConfig && customTeamConfig.name.trim() !== "" ? customTeamConfig.name : `Time ${teamCount}`;
    const teamColor = customTeamConfig ? customTeamConfig.color : DEFAULT_CUSTOM_TEAM_COLORS[teamCount - 1] || '#cccccc';
    generatedTeams.push({ name: teamName, players: selectedPlayers.slice(i, i + perTeam), color: teamColor });
  }
  renderGeneratedTeams();
  displayMessage(`${teamCount} time(s) gerado(s) com sucesso!`, "success");
  await saveLocalSettings();
  return true;
}

function renderGeneratedTeams() {
    const container = document.getElementById("teamsContainer");
    container.innerHTML = "";
    if (generatedTeams.length === 0) {
        const noTeamsMsg = document.createElement('p');
        noTeamsMsg.textContent = 'Nenhum time gerado ainda. Vá em "Jogadores", selecione-os e depois use o botão "Gerar".';
        noTeamsMsg.style.textAlign = 'center';
        noTeamsMsg.style.fontStyle = 'italic';
        noTeamsMsg.style.color = 'rgba(255,255,255,.7)';
        container.appendChild(noTeamsMsg);
        return;
    }
    generatedTeams.forEach((team) => {
        const teamCard = document.createElement("div");
        teamCard.classList.add("team-card");
        teamCard.style.setProperty('--team-card-dynamic-border-color', team.color);
        const teamNameEl = document.createElement("h4");
        teamNameEl.appendChild(document.createTextNode(team.name));
        teamCard.appendChild(teamNameEl);
        const playersList = document.createElement("ul");
        playersList.classList.add('player-list-compact');
        if (team.players.length === 0) {
            const playerLi = document.createElement("li");
            playerLi.textContent = "Sem jogadores";
            playerLi.style.fontStyle = 'italic';
            playerLi.style.color = 'rgba(255,255,255,.5)';
            playersList.appendChild(playerLi);
        } else {
            team.players.forEach(player => {
                const playerLi = document.createElement("li");
                playerLi.textContent = player;
                playersList.appendChild(playerLi);
            });
        }
        teamCard.appendChild(playersList);
        container.appendChild(teamCard);
    });
}

function setupSwipeToDecrease(id, team) {
  const el = document.getElementById(id);
  let startY = null;
  el.addEventListener('touchstart', e => {
    const playerInfoContainer = el.querySelector('.player-info-container');
    if (playerInfoContainer && playerInfoContainer.contains(e.target)) {
        startY = null;
        return;
    }
    if (e.touches.length === 1) {
      startY = e.touches[0].clientY;
    }
  });
  el.addEventListener('touchend', e => {
    if (startY !== null && e.changedTouches.length === 1) {
      const endY = e.changedTouches[0].clientY;
      if (endY - startY > 30) {
        changeScore(team, -1);
      }
      startY = null;
    }
  });
}

function triggerVibration() {
  if (vibrationEnabled && navigator.vibrate) {
    navigator.vibrate(100);
  }
}

async function changeScore(team, delta) {
  if (!gameStarted) {
    if (delta > 0) displayMessage("Inicie uma partida primeiro!", "warning");
    return;
  }
  if (gameEnded) return;
  const scoreElement = document.getElementById('score' + team);
  scoreElement.classList.remove('increase-anim', 'decrease-anim');
  void scoreElement.offsetWidth;
  if (team === 'A') {
    scoreA = Math.max(0, scoreA + delta);
    scoreElement.textContent = scoreA;
  } else {
    scoreB = Math.max(0, scoreB + delta);
    scoreElement.textContent = scoreB;
  }
  if (delta > 0) {
    scoreElement.classList.add('increase-anim');
    triggerVibration();
  } else if (delta < 0) {
    scoreElement.classList.add('decrease-anim');
    triggerVibration();
  }
  await saveLocalSettings();
  checkWinCondition();
}

async function checkWinCondition() {
  if (gameEnded) return;
  let winner = null;
  if (scoreA >= winningScore && scoreA - scoreB >= 2) {
    winner = 'A';
  } else if (scoreB >= winningScore && scoreB - scoreA >= 2) {
    winner = 'B';
  }
  if (winner) {
    gameEnded = true;
    lastWinningTeam = winner;
    stopAllTimers();
    const winningTeamName = winner === 'A' ? currentPlayingTeamA.name : currentPlayingTeamB.name;
    showVictoryAnimation(winner, winningTeamName);
    updateSwapTeamsButtonVisibility();
    await saveLocalSettings();
    setTimeout(async () => {
      let currentSetsA = setsA;
      let currentSetsB = setsB;
      if (winner === 'A') {
        currentSetsA++;
      } else {
        currentSetsB++;
      }
      if (setsToWin > 0 && (currentSetsA >= setsToWin || currentSetsB >= setsToWin)) {
        showSuperVictoryAnimation(winningTeamName);
      } else {
        showGameOverModal(winningTeamName, 'set_won');
      }
    }, 3000);
  }
}

function showVictoryAnimation(teamId, winningTeamName) {
  const teamSection = document.getElementById('section' + teamId);
  const victoryElements = teamSection.querySelector('.victory-elements');
  const crownContainer = victoryElements.querySelector('.crown-container');
  const confettiContainer = victoryElements.querySelector('.confetti-container');
  confettiContainer.innerHTML = '';
  victoryElements.classList.add('show');
  crownContainer.style.opacity = 0;
  crownContainer.style.animation = 'none';
  void crownContainer.offsetWidth;
  crownContainer.style.animation = 'crownAppear 1.5s ease-out forwards';
  const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f', '#ffa500'];
  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement('div');
    confetti.classList.add('confetti-piece');
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.width = `${Math.random() * 10 + 5}px`;
    confetti.style.height = confetti.style.width;
    const startX = teamSection.offsetWidth / 2;
    const startY = teamSection.offsetHeight / 2;
    confetti.style.left = `${startX}px`;
    confetti.style.top = `${startY}px`;
    const endX = (Math.random() - .5) * teamSection.offsetWidth * 1.5;
    const endY = (Math.random() - .5) * teamSection.offsetHeight * 1.5;
    const rotateDeg = Math.random() * 720;
    const duration = Math.random() * 1.5 + 1.5;
    const delay = Math.random() * .5;
    confetti.style.setProperty('--confetti-end-x', `${endX}px`);
    confetti.style.setProperty('--confetti-end-y', `${endY}px`);
    confetti.style.setProperty('--confetti-rotate-deg', `${rotateDeg}deg`);
    confetti.style.animation = `confettiFall ${duration}s ease-out ${delay}s forwards`;
    confetti.style.opacity = 1;
    confettiContainer.appendChild(confetti);
    confetti.addEventListener('animationend', () => {
      confetti.remove();
    });
  }
  setTimeout(() => {
    victoryElements.classList.remove('show');
  }, 3000);
}

function showGameOverModal(winningTeamName, gameStatus) {
  const modal = document.getElementById('gameOverModal');
  const modalWinningTeamName = document.getElementById('modalWinningTeamName');
  const modalMessage = document.getElementById('modalMessage');
  const newSetButton = document.getElementById('newSetButton');
  modalWinningTeamName.textContent = winningTeamName;
  if (gameStatus === 'game_won') {
    modalMessage.textContent = 'Venceu a Partida!';
    newSetButton.style.display = 'none';
  } else {
    modalMessage.textContent = 'Venceu o Set!';
    newSetButton.style.display = 'block';
  }
  modal.classList.add('show');
}

function hideGameOverModal() {
  document.getElementById('gameOverModal').classList.remove('show');
}

function increaseWinningScoreModal() {
  hideGameOverModal();
  document.getElementById('increaseScoreModal').classList.add('show');
  document.getElementById('newWinningScoreInput').value = winningScore + 5;
}

function hideIncreaseScoreModal() {
  document.getElementById('increaseScoreModal').classList.remove('show');
}

async function confirmIncreaseWinningScore() {
  const newScore = parseInt(document.getElementById('newWinningScoreInput').value);
  if (isNaN(newScore) || newScore <= 0) {
    displayMessage("Por favor, insira um número de pontos válido.", "error");
    return;
  }
  if (newScore <= winningScore) {
    displayMessage(`A nova pontuação (${newScore}) deve ser maior que a pontuação atual (${winningScore}).`, "warning");
    return;
  }
  winningScore = newScore;
  document.getElementById('winningScore').value = winningScore;
  displayMessage(`Pontuação para vencer aumentada para ${winningScore}!`, "success");
  hideIncreaseScoreModal();
  gameEnded = false;
  startAllTimers();
  await saveLocalSettings();
}

function showStartGameModal() {
  document.getElementById('startGameModal').classList.add('show');
  document.getElementById('initialWinningScore').value = winningScore;
  document.getElementById('initialNumberOfSets').value = setsToWin;
  document.getElementById('modalStartGameButton').onclick = confirmStartGame;
  document.getElementById('modalCancelGameButton').onclick = hideStartGameModal;
  document.getElementById('startGameButton').style.display = 'none';
}

function hideStartGameModal() {
  document.getElementById('startGameModal').classList.remove('show');
  if (!gameStarted) {
      document.getElementById('startGameButton').style.display = 'block';
      document.getElementById('scoreboardOverlay').classList.remove('hidden');
  }
}

async function confirmStartGame() {
  const newWinningScore = parseInt(document.getElementById('initialWinningScore').value);
  const newSetsToWin = parseInt(document.getElementById('initialNumberOfSets').value);
  if (isNaN(newWinningScore) || newWinningScore <= 0) {
    displayMessage("Por favor, insira um valor válido para 'Pontos por set'.", "error");
    return;
  }
  if (isNaN(newSetsToWin) || newSetsToWin < 0) {
    displayMessage("Por favor, insira um valor válido para 'Número de sets'.", "error");
    return;
  }
  winningScore = newWinningScore;
  setsToWin = newSetsToWin;

  hideStartGameModal();

  if (generatedTeams.length === 0) {
      showConfirmationModal("Não há times gerados. Deseja gerar times automaticamente com o número de jogadores por time definido nas configurações?", async (confirmed) => {
          if (confirmed) {
              const success = await generateCustomTeams();
              if (!success) {
                  displayMessage("Não foi possível gerar times automaticamente. Por favor, adicione mais jogadores ou gere os times manualmente.", "error");
                  document.getElementById('startGameButton').style.display = 'block';
                  document.getElementById('scoreboardOverlay').classList.remove('hidden');
                  return;
              }
              await selectAndInitializeTeams();
          } else {
              showStartGameModal();
          }
      });
  } else {
      await selectAndInitializeTeams();
  }
  await saveLocalSettings();
}

async function selectAndInitializeTeams() {
  if (generatedTeams.length >= 2) {
      currentPlayingTeamA = { ...generatedTeams[0] };
      currentPlayingTeamB = { ...generatedTeams[1] };
  } else if (customTeamNames.length >= 2 && customTeamNames[0].name.trim() !== "" && customTeamNames[1].name.trim() !== "") {
      currentPlayingTeamA = { ...customTeamNames[0] };
      currentPlayingTeamB = { ...customTeamNames[1] };
  } else {
      currentPlayingTeamA = { name: 'Time A', players: [], color: '#007bff' };
      currentPlayingTeamB = { name: 'Time B', players: [], color: '#dc3545' };
  }
  await initializeGameAndTeams();
}

async function initializeGameAndTeams() {
  scoreA = 0;
  scoreB = 0;
  setsA = 0;
  setsB = 0;
  gameEnded = false;
  gameStarted = true;
  lastWinningTeam = null;

  document.getElementById("scoreA").textContent = scoreA;
  document.getElementById("scoreB").textContent = scoreB;
  updateSetsDisplay();
  document.getElementById('scoreboardOverlay').classList.add('hidden');
  document.getElementById('startGameButton').style.display = 'none';

  updateScoreboardTeamsDisplay();
  updateResetButtonVisibility();
  updateSwapTeamsButtonVisibility();
  gameTimeInSeconds = 0;
  setTimeInSeconds = 0;
  startAllTimers();
  await saveLocalSettings();
}

async function startNewGame() {
  hideGameOverModal();

  scoreA = 0;
  scoreB = 0;
  setsA = 0;
  setsB = 0;
  gameEnded = false;
  gameStarted = true;

  document.getElementById("scoreA").textContent = 0;
  document.getElementById("scoreB").textContent = 0;
  updateSetsDisplay();
  document.getElementById('scoreboardOverlay').classList.add('hidden');
  document.getElementById('startGameButton').style.display = 'none';

  let nextTeamA = { ...currentPlayingTeamA };
  let nextTeamB = { ...currentPlayingTeamB };

  if (lastWinningTeam !== null) {
      const losingTeam = (lastWinningTeam === 'A' ? currentPlayingTeamB : currentPlayingTeamA);
      const winningTeam = (lastWinningTeam === 'A' ? currentPlayingTeamA : currentPlayingTeamB);

      const availableTeamsForSubstitution = generatedTeams.filter(team => {
          const teamIdentifier = JSON.stringify({ name: team.name, players: team.players });
          const winningTeamIdentifier = JSON.stringify({ name: winningTeam.name, players: winningTeam.players });
          const losingTeamIdentifier = JSON.stringify({ name: losingTeam.name, players: losingTeam.players });
          return teamIdentifier !== winningTeamIdentifier && teamIdentifier !== losingTeamIdentifier;
      });

      if (availableTeamsForSubstitution.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableTeamsForSubstitution.length);
          const newTeam = availableTeamsForSubstitution[randomIndex];

          if (lastWinningTeam === 'A') {
              nextTeamB = { ...newTeam };
              displayMessage(`Time ${losingTeam.name} foi substituído por ${newTeam.name} para a nova partida!`, "info");
          } else {
              nextTeamA = { ...newTeam };
              displayMessage(`Time ${losingTeam.name} foi substituído por ${newTeam.name} para a nova partida!`, "info");
          }
      } else {
          displayMessage("Não há times disponíveis para substituição. Os times atuais continuarão na nova partida.", "info");
      }
  } else {
      if (generatedTeams.length >= 2) {
          nextTeamA = { ...generatedTeams[0] };
          nextTeamB = { ...generatedTeams[1] };
      } else if (customTeamNames.length >= 2 && customTeamNames[0].name.trim() !== "" && customTeamNames[1].name.trim() !== "") {
          nextTeamA = { ...customTeamNames[0] };
          nextTeamB = { ...customTeamNames[1] };
      } else {
          nextTeamA = { name: 'Time A', players: [], color: '#007bff' };
          nextTeamB = { name: 'Time B', players: [], color: '#dc3545' };
      }
  }

  currentPlayingTeamA = nextTeamA;
  currentPlayingTeamB = nextTeamB;

  updateScoreboardTeamsDisplay();
  lastWinningTeam = null;
  gameTimeInSeconds = 0;
  setTimeInSeconds = 0;
  startAllTimers();
  await saveLocalSettings();
}

async function startNewSet() {
  hideGameOverModal();
  let winnerId = lastWinningTeam;
  if (winnerId === 'A') {
      setsA++;
  } else {
      setsB++;
  }
  scoreA = 0;
  scoreB = 0;
  gameEnded = false;
  document.getElementById("scoreA").textContent = 0;
  document.getElementById("scoreB").textContent = 0;
  updateSetsDisplay();
  updateScoreboardTeamsDisplay();
  updateSwapTeamsButtonVisibility();
  setTimeInSeconds = 0;
  startAllTimers();
  await saveLocalSettings();
}

function showSuperVictoryAnimation(winningTeamName) {
  const superVictoryModal = document.getElementById('superVictoryModal');
  const superVictoryTeamName = document.getElementById('superVictoryTeamName');
  const confettiContainer = superVictoryModal.querySelector('.confetti-container');
  superVictoryTeamName.textContent = winningTeamName;
  superVictoryModal.classList.add('show');
  confettiContainer.innerHTML = '';
  const colors = ['#FFD700', '#FFA500', '#FF4500', '#FFFFFF', '#007bff', '#dc3545'];
  for (let i = 0; i < 200; i++) {
    const confetti = document.createElement('div');
    confetti.classList.add('confetti-piece');
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.width = `${Math.random() * 15 + 8}px`;
    confetti.style.height = confetti.style.width;
    const startX = Math.random() * window.innerWidth;
    const startY = -Math.random() * window.innerHeight;
    confetti.style.left = `${startX}px`;
    confetti.style.top = `${startY}px`;
    const endX = (Math.random() - .5) * window.innerWidth * 2;
    const endY = window.innerHeight + Math.random() * window.innerHeight;
    const rotateDeg = Math.random() * 1080;
    const duration = Math.random() * 2 + 3;
    const delay = Math.random() * 1;
    confetti.style.setProperty('--confetti-end-x', `${endX}px`);
    confetti.style.setProperty('--confetti-end-y', `${endY}px`);
    confetti.style.setProperty('--confetti-rotate-deg', `${rotateDeg}deg`);
    confetti.style.animation = `confettiFall ${duration}s ease-out ${delay}s forwards`;
    confetti.style.opacity = 1;
    confettiContainer.appendChild(confetti);
    confetti.addEventListener('animationend', () => {
      confetti.remove();
    });
  }
  setTimeout(() => {
    superVictoryModal.classList.remove('show');
    showGameOverModal(winningTeamName, 'game_won');
  }, 5000);
}

function updateSetsDisplay() {
  const setIndicatorA = document.getElementById('setIndicatorA');
  const setIndicatorB = document.getElementById('setIndicatorB');
  setIndicatorA.innerHTML = '';
  setIndicatorB.innerHTML = '';
  for (let i = 0; i < setsA; i++) {
    const star = document.createElement('i');
    star.classList.add('fa-solid', 'fa-star', 'set-star');
    setIndicatorA.appendChild(star);
  }
  for (let i = 0; i < setsB; i++) {
    const star = document.createElement('i');
    star.classList.add('fa-solid', 'fa-star', 'set-star');
    setIndicatorB.appendChild(star);
  }
}

async function setTheme(themeName, save = true) {
  if (themeName === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
  currentTheme = themeName;
  if (save) {
    await saveLocalSettings();
    displayMessage('Tema alterado para ' + (themeName === 'dark' ? 'Escuro' : 'Claro') + '!', "info");
  }
}

function applyTeamColorsToScoreboard() {
    document.getElementById('sectionA').style.backgroundColor = currentPlayingTeamA.color;
    document.getElementById('sectionB').style.backgroundColor = currentPlayingTeamB.color;
}

function setupSwipeBetweenSections() {
  let touchStartX = null;

  document.body.addEventListener('touchstart', e => {
    if (e.target.closest('.game-over-modal.show, .increase-score-modal.show, .start-game-modal.show, .super-victory-modal.show, .custom-message-modal.show, .custom-confirmation-modal.show, .manage-team-modal.show') ||
        e.target.closest('#startGameButton') || e.target.closest('#swapTeamsButton') || document.getElementById("gearMenu").classList.contains("show")) {
      touchStartX = null;
      return;
    }
    
    const activeSection = document.querySelector('.section.active');
    if (activeSection && activeSection.scrollHeight > activeSection.clientHeight) {
        const touch = e.touches[0];
        const startY = touch.clientY;
        const scrollableElement = activeSection;
        let isScrollingVertically = false;
        const handleTouchMove = (moveEvent) => {
            const currentY = moveEvent.touches[0].clientY;
            const deltaY = currentY - startY;
            if (Math.abs(deltaY) > 5) {
                isScrollingVertically = true;
            }
            if (isScrollingVertically &&
                ((deltaY > 0 && scrollableElement.scrollTop === 0) ||
                 (deltaY < 0 && scrollableElement.scrollTop + scrollableElement.clientHeight >= scrollableElement.scrollHeight - 1))) {
                moveEvent.preventDefault();
            }
        };
        const handleTouchEnd = () => {
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
    }
    touchStartX = e.touches[0].clientX;
  });

  document.body.addEventListener('touchend', e => {
    if (touchStartX === null) return;

    if (e.target.closest('.game-over-modal.show, .increase-score-modal.show, .start-game-modal.show, .super-victory-modal.show, .custom-message-modal.show, .custom-confirmation-modal.show, .manage-team-modal.show') ||
        e.target.closest('#startGameButton') || e.target.closest('#swapTeamsButton') || document.getElementById("gearMenu").classList.contains("show")) {
      touchStartX = null;
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const dx = touchStartX - touchEndX;
    const threshold = 50;
    
    const sections = ['pontuacao', 'times', 'jogadores', 'agendamentos', 'configuracoes'];
    const currentIndex = sections.findIndex(id => document.getElementById(id).classList.contains('active'));
    let nextIndex = currentIndex;
    if (dx > threshold) {
      nextIndex = (currentIndex + 1) % sections.length;
    } else if (dx < -threshold) {
      nextIndex = (currentIndex - 1 + sections.length) % sections.length;
    }
    if (nextIndex !== currentIndex) {
        navigateTo(sections[nextIndex]);
    }
    touchStartX = null;
  });
}

async function swapTeams() {
  if (!gameStarted) {
    displayMessage("Inicie uma partida para inverter os times.", "warning");
    return;
  }
  const sectionA = document.getElementById('sectionA');
  const sectionB = document.getElementById('sectionB');
  sectionA.style.pointerEvents = 'none';
  sectionB.style.pointerEvents = 'none';
  document.getElementById('swapTeamsButton').style.pointerEvents = 'none';
  const animationDuration = 300;
  sectionA.classList.add('fade-out');
  sectionB.classList.add('fade-out');
  setTimeout(async () => {
    let tempScore = scoreA;
    scoreA = scoreB;
    scoreB = tempScore;
    let tempSets = setsA;
    setsA = setsB;
    setsB = tempSets;
    let tempTeam = currentPlayingTeamA;
    currentPlayingTeamA = currentPlayingTeamB;
    currentPlayingTeamB = tempTeam;

    document.getElementById("scoreA").textContent = scoreA;
    document.getElementById("scoreB").textContent = scoreB;
    updateSetsDisplay();
    updateScoreboardTeamsDisplay();

    sectionA.classList.remove('fade-out');
    sectionB.classList.remove('fade-out');
    sectionA.classList.add('fade-in');
    sectionB.classList.add('fade-in');
    await saveLocalSettings();
    setTimeout(() => {
      sectionA.classList.remove('fade-in');
      sectionB.classList.remove('fade-in');
      sectionA.style.pointerEvents = 'auto';
      sectionB.style.pointerEvents = 'auto';
      document.getElementById('swapTeamsButton').style.pointerEvents = 'auto';
    }, animationDuration);
  }, animationDuration);
}

function updateSwapTeamsButtonVisibility() {
    const swapButton = document.getElementById('swapTeamsButton');
    if (gameStarted && !gameEnded) {
        swapButton.classList.add('show');
    } else {
        swapButton.classList.remove('show');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const customModalHTML = `
        <div id="customMessageModal" class="custom-message-modal">
            <div class="modal-content custom-message-content">
                <h3 id="customMessageTitle"></h3>
                <p id="customMessageText"></p>
                <div class="modal-buttons">
                    <button onclick="hideCustomMessageModal()">OK</button>
                </div>
            </div>
        </div>
        <div id="customConfirmationModal" class="custom-confirmation-modal">
            <div class="modal-content custom-confirmation-content">
                <h3 id="customConfirmationTitle">Confirmação</h3>
                <p id="customConfirmationText"></p>
                <div class="modal-buttons">
                    <button id="confirmYesButton">Sim</button>
                    <button id="confirmNoButton" style="background-color:#dc3545;--modal-button-hover-bg:#c82333;">Não</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', customModalHTML);
    document.getElementById('confirmYesButton').addEventListener('click', () => {
        if (typeof window.currentConfirmationCallback === 'function') {
            window.currentConfirmationCallback(true);
        }
        hideCustomConfirmationModal();
    });
    document.getElementById('confirmNoButton').addEventListener('click', () => {
        if (typeof window.currentConfirmationCallback === 'function') {
            window.currentConfirmationCallback(false);
        }
        hideCustomConfirmationModal();
    });
});

function displayMessage(message, type = 'info') {
    const modal = document.getElementById('customMessageModal');
    const titleElement = document.getElementById('customMessageTitle');
    const textElement = document.getElementById('customMessageText');
    let title = '';
    switch (type) {
        case 'success': title = 'Sucesso!'; break;
        case 'error': title = 'Erro!'; break;
        case 'warning': title = 'Atenção!'; break;
        default: title = 'Informação'; break;
    }
    titleElement.textContent = title;
    textElement.textContent = message;
    modal.classList.add('show');
}

function hideCustomMessageModal() {
    document.getElementById('customMessageModal').classList.remove('show');
}

function showConfirmationModal(message, callback) {
    const modal = document.getElementById('customConfirmationModal');
    const textElement = document.getElementById('customConfirmationText');
    textElement.textContent = message;
    window.currentConfirmationCallback = callback;
    modal.classList.add('show');
}

function hideCustomConfirmationModal() {
    document.getElementById('customConfirmationModal').classList.remove('show');
    window.currentConfirmationCallback = null;
}

async function showManageTeamModal(teamId) {
    activeManageTeamId = teamId;
    const modal = document.getElementById('manageTeamModal');
    const selectElement = document.getElementById('selectTeamForManagement');
    document.getElementById('manageTeamModalTitle').textContent = `Selecionar Time`;
    const currentTeam = (teamId === 'A' ? currentPlayingTeamA : currentPlayingTeamB);
    selectElement.innerHTML = '<option value="">Selecione um time</option>';

    if (generatedTeams.length > 0) {
        const optgroupGenerated = document.createElement('optgroup');
        optgroupGenerated.label = 'Times Gerados';
        generatedTeams.forEach((team, index) => {
            const option = document.createElement('option');
            option.value = `generated-${index}`;
            option.textContent = `${team.name}`;
            if (currentTeam.name === team.name && currentTeam.players.length === team.players.length && currentTeam.players.every((p, i) => p === team.players[i])) {
              option.selected = true;
            }
            optgroupGenerated.appendChild(option);
        });
        selectElement.appendChild(optgroupGenerated);
    }

    if (customTeamNames.length > 0) {
        const optgroupCustom = document.createElement('optgroup');
        optgroupCustom.label = 'Times Personalizados';
        customTeamNames.forEach((team, index) => {
            if (team.name && team.name.trim() !== "") {
                const option = document.createElement('option');
                option.value = `custom-${index}`;
                option.textContent = `${team.name}`;
                if (currentTeam.name === team.name && currentTeam.color === team.color && currentTeam.players.length === 0) {
                  option.selected = true;
                }
                optgroupCustom.appendChild(option);
            }
        });
        if (optgroupCustom.children.length > 0) {
            selectElement.appendChild(optgroupCustom);
        }
    }

    if (selectElement.children.length <= 1) {
        selectElement.innerHTML += '<option value="" disabled>Nenhum time disponível</option>';
    }

    const selectedValue = selectElement.value;
    const isCurrentTeamGenerated = selectedValue.startsWith('generated-');
    const currentTeamIndex = isCurrentTeamGenerated ? parseInt(selectedValue.split('-')[1]) : -1;

    if (currentTeamIndex === -1 ||
        (generatedTeams[currentTeamIndex] && (generatedTeams[currentTeamIndex].name !== currentTeam.name ||
         !generatedTeams[currentTeamIndex].players.every((p, i) => p === currentTeam.players[i])))) {
          const isCurrentTeamCustom = customTeamNames.some((ct, idx) =>
              currentTeam.name === ct.name && currentTeam.color === ct.color && `custom-${idx}` === selectedValue
          );
          if (!isCurrentTeamCustom) {
              selectElement.value = "";
          }
    }

    modal.classList.add('show');
    setTimeout(() => {
        document.addEventListener('click', closeManageTeamModalOnOutsideClick);
    }, 0);
}

function closeManageTeamModalOnOutsideClick(e) {
  const modal = document.getElementById("manageTeamModal");
  const modalContent = modal.querySelector(".modal-content");
  if (!modalContent.contains(e.target)) {
    hideManageTeamModal();
  }
}

function hideManageTeamModal() {
    document.getElementById('manageTeamModal').classList.remove('show');
    activeManageTeamId = null;
    document.removeEventListener('click', closeManageTeamModalOnOutsideClick);
}

async function saveTeamNameAndPlayers() {
    const selectedDropdownValue = document.getElementById('selectTeamForManagement').value;
    let targetTeam = (activeManageTeamId === 'A' ? currentPlayingTeamA : currentPlayingTeamB);
    let otherTeam = (activeManageTeamId === 'A' ? currentPlayingTeamB : currentPlayingTeamA);
    let finalTeamName;
    let finalTeamPlayers;
    let finalTeamColor;

    if (selectedDropdownValue === "") {
        finalTeamName = (activeManageTeamId === 'A' ? 'Time A' : 'Time B');
        finalTeamPlayers = [];
        finalTeamColor = (activeManageTeamId === 'A' ? '#007bff' : '#dc3545');
    } else if (selectedDropdownValue.startsWith('generated-')) {
        const index = parseInt(selectedDropdownValue.split('-')[1]);
        const selectedGeneratedTeam = generatedTeams[index];

        if (otherTeam.name === selectedGeneratedTeam.name &&
            otherTeam.players.length === selectedGeneratedTeam.players.length &&
            otherTeam.players.every((p, i) => p === selectedGeneratedTeam.players[i])) {
            displayMessage("Este time gerado já está atribuído ao outro time. Por favor, selecione um time diferente.", "warning");
            document.getElementById('selectTeamForManagement').value = "";
            return;
        }
        finalTeamName = selectedGeneratedTeam.name;
        finalTeamPlayers = selectedGeneratedTeam.players;
        finalTeamColor = selectedGeneratedTeam.color;
    } else if (selectedDropdownValue.startsWith('custom-')) {
        const index = parseInt(selectedDropdownValue.split('-')[1]);
        const selectedCustomTeam = customTeamNames[index];

        if (otherTeam.name === selectedCustomTeam.name && otherTeam.players.length === 0) {
            displayMessage("Este time personalizado já está atribuído ao outro time. Por favor, selecione um time diferente.", "warning");
            document.getElementById('selectTeamForManagement').value = "";
            return;
        }
        finalTeamName = selectedCustomTeam.name;
        finalTeamPlayers = [];
        finalTeamColor = selectedCustomTeam.color;
    }

    targetTeam.name = finalTeamName;
    targetTeam.players = finalTeamPlayers;
    targetTeam.color = finalTeamColor;

    updateScoreboardTeamsDisplay();
    hideManageTeamModal();
    await saveLocalSettings();
}

/**
 * Salva os nomes e cores dos times personalizados. Salva localmente e, se online, no Firestore.
 */
async function saveCustomTeamNamesToFirestore() {
    for (let i = 0; i < 5; i++) {
        const name = document.getElementById(`customTeamName${i + 1}`).value.trim();
        const color = document.getElementById(`customTeamColor${i + 1}`).value;

        // Garante que o objeto exista no array customTeamNames
        if (!customTeamNames[i]) {
            customTeamNames[i] = { id: null, name: "", color: DEFAULT_CUSTOM_TEAM_COLORS[i], order: i, lastModified: Date.now() };
        }

        customTeamNames[i].name = name;
        customTeamNames[i].color = color;
        customTeamNames[i].lastModified = Date.now();
        customTeamNames[i].order = i; // Garante a ordem
    }
    await saveLocalSettings(); // Salva localmente

    if (isOnline && isAuthReady) {
        try {
            const customTeamNamesCollectionRef = collection(db, `artifacts/${appId}/public/data/customTeamNames`);
            const batch = [];
            for (let i = 0; i < customTeamNames.length; i++) {
                const team = customTeamNames[i];
                const docRef = team.id ? doc(customTeamNamesCollectionRef, team.id) : doc(customTeamNamesCollectionRef, `customTeam_${i}`); // Usa ID se existir, senão um nome fixo
                batch.push(setDoc(docRef, {
                    name: team.name,
                    color: team.color,
                    order: team.order,
                    lastModified: team.lastModified
                }, { merge: true })); // Usa merge para não sobrescrever completamente se o doc já existir
            }
            await Promise.all(batch);
            displayMessage("Times personalizados salvos e sincronizados!", "success");
            // Após salvar no Firestore, atualiza os IDs locais caso algum tenha sido gerado
            const updatedSnapshot = await getDocs(customTeamNamesCollectionRef);
            updatedSnapshot.forEach(doc => {
                const localTeam = customTeamNames.find(t => t.order === doc.data().order);
                if (localTeam) {
                    localTeam.id = doc.id;
                }
            });
            await saveLocalSettings();
        } catch (e) {
            console.error("Erro ao salvar times personalizados no Firestore:", e);
            displayMessage("Erro ao sincronizar times personalizados. Salvo localmente.", "error");
        }
    } else {
        displayMessage("Times personalizados salvos localmente. Sincronizará quando online.", "info");
    }
}

function toggleCustomTeamNamesSection() {
    const content = document.getElementById('customTeamNamesContent');
    const arrow = document.getElementById('customTeamNamesArrow');
    content.classList.toggle('show');
    arrow.classList.toggle('rotated');
    // Adiciona/remove listeners para salvar quando a seção está aberta
    for (let i = 0; i < 5; i++) {
        const nameInput = document.getElementById(`customTeamName${i + 1}`);
        const colorInput = document.getElementById(`customTeamColor${i + 1}`);
        if (content.classList.contains('show')) {
            nameInput.addEventListener('change', saveCustomTeamNamesToFirestore);
            colorInput.addEventListener('change', saveCustomTeamNamesToFirestore);
        } else {
            nameInput.removeEventListener('change', saveCustomTeamNamesToFirestore);
            colorInput.removeEventListener('change', saveCustomTeamNamesToFirestore);
        }
    }
}

function toggleGeneralSettingsSection() {
    const content = document.getElementById('generalSettingsContent');
    const arrow = document.getElementById('generalSettingsArrow');
    content.classList.toggle('show');
    arrow.classList.toggle('rotated');
}

function togglePastAppointmentsSection() {
    const content = document.getElementById('pastAppointmentsContent');
    const arrow = document.getElementById('pastAppointmentsArrow');
    content.classList.toggle('show');
    arrow.classList.toggle('rotated');
}

function updatePlayerDisplayOnScoreboard() {
    const playerInfoContainerA = document.querySelector('#sectionA .player-info-container');
    const playerInfoContainerB = document.querySelector('#sectionB .player-info-container');
    if (showPlayersOnScoreboard) {
        playerInfoContainerA.classList.remove('hidden-players');
        playerInfoContainerB.classList.remove('hidden-players');
    } else {
        playerInfoContainerA.classList.add('hidden-players');
        playerInfoContainerB.classList.add('hidden-players');
    }
}

function updateScoreboardTeamsDisplay() {
    document.getElementById('teamNameA').textContent = currentPlayingTeamA.name;
    document.getElementById('teamNameB').textContent = currentPlayingTeamB.name;
    const playerListA = document.getElementById('playerListA');
    const playerListB = document.getElementById('playerListB');
    playerListA.innerHTML = '';
    playerListB.innerHTML = '';

    currentPlayingTeamA.players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p;
        playerListA.appendChild(li);
    });
    currentPlayingTeamB.players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p;
        li.style.color = 'inherit';
        playerListB.appendChild(li);
    });
    updatePlayerDisplayOnScoreboard();
    applyTeamColorsToScoreboard();
}

async function updateTimerDisplay() {
  const minutesGame = Math.floor(gameTimeInSeconds / 60);
  const secondsGame = gameTimeInSeconds % 60;
  const formattedGameTime =
    `${minutesGame.toString().padStart(2, '0')}:${secondsGame.toString().padStart(2, '0')}`;
  document.getElementById('timerDisplay').textContent = formattedGameTime;

  const minutesSet = Math.floor(setTimeInSeconds / 60);
  const secondsSet = setTimeInSeconds % 60;
  const formattedSetTime =
    `${minutesSet.toString().padStart(2, '0')}:${secondsSet.toString().padStart(2, '0')}`;
  document.getElementById('setTimerDisplay').textContent = formattedSetTime;

  const timerIcon = document.getElementById('timerIcon');
  if (isTimerRunning) {
      timerIcon.classList.remove('fa-play');
      timerIcon.classList.add('fa-pause');
  } else {
      timerIcon.classList.remove('fa-pause');
      timerIcon.classList.add('fa-play');
  }
  await saveLocalSettings();
}

function startAllTimers() {
  if (gameTimerInterval) {
    clearInterval(gameTimerInterval);
  }
  if (setTimerInterval) {
    clearInterval(setTimerInterval);
  }
  document.getElementById('gameTimer').classList.add('show');
  isTimerRunning = true;
  gameTimerInterval = setInterval(() => {
    gameTimeInSeconds++;
    updateTimerDisplay();
  }, 1000);
  setTimerInterval = setInterval(() => {
    setTimeInSeconds++;
    updateTimerDisplay();
  }, 1000);
  updateTimerDisplay();
}

function stopAllTimers() {
  if (gameTimerInterval) {
    clearInterval(gameTimerInterval);
    gameTimerInterval = null;
  }
  if (setTimerInterval) {
    clearInterval(setTimerInterval);
    setTimerInterval = null;
  }
  isTimerRunning = false;
  updateTimerDisplay();
}

function toggleTimer() {
    if (!gameStarted || gameEnded) {
        displayMessage("O cronômetro só pode ser pausado/retomado durante uma partida ativa.", "warning");
        return;
    }
    if (isTimerRunning) {
        stopAllTimers();
    } else {
        startAllTimers();
    }
}

/**
 * Adiciona um novo agendamento. Salva localmente e, se online, no Firestore.
 */
async function addAppointment() {
    const gameDateInput = document.getElementById('gameDate');
    const gameTimeInput = document.getElementById('gameTime');
    const gameLocationInput = document.getElementById('gameLocation');

    const date = gameDateInput.value;
    const time = gameTimeInput.value;
    const location = gameLocationInput.value.trim();

    if (!date || !time || !location) {
        displayMessage("Por favor, preencha todos os campos do agendamento.", "warning");
        return;
    }

    const newAppointment = {
        id: null, // O ID será atribuído pelo Firebase se online
        date: date,
        time: time,
        location: location,
        lastModified: Date.now()
    };
    appointments.push(newAppointment);
    gameDateInput.value = '';
    gameTimeInput.value = '';
    gameLocationInput.value = '';
    renderAppointments();
    await saveLocalSettings(); // Salva localmente

    if (isOnline && isAuthReady) {
        try {
            const docRef = await addDoc(collection(db, `artifacts/${appId}/public/data/appointments`), {
                date: newAppointment.date,
                time: newAppointment.time,
                location: newAppointment.location,
                lastModified: newAppointment.lastModified
            });
            newAppointment.id = docRef.id; // Atualiza o ID do agendamento local
            await saveLocalSettings(); // Salva novamente para persistir o ID do Firebase
            displayMessage("Agendamento adicionado e sincronizado!", "success");
        } catch (e) {
            displayMessage("Erro ao adicionar agendamento ao servidor. Salvo localmente.", "error");
            console.error("Erro ao adicionar agendamento ao Firestore:", e);
        }
    } else {
        displayMessage("Agendamento adicionado localmente. Sincronizará quando online.", "info");
    }
}

/**
 * Exclui um agendamento. Remove localmente e, se online, do Firestore.
 */
function deleteAppointment(idToDelete) {
    showConfirmationModal("Tem certeza que deseja excluir este agendamento?", async (confirmed) => {
        if (confirmed) {
            // Remove localmente
            const initialLength = appointments.length;
            appointments = appointments.filter(appt => appt.id !== idToDelete);
            if (appointments.length < initialLength) {
                renderAppointments();
                await saveLocalSettings(); // Salva localmente

                if (isOnline && isAuthReady && idToDelete) { // Só tenta remover do Firebase se tiver ID e estiver online
                    try {
                        await deleteDoc(doc(db, `artifacts/${appId}/public/data/appointments`, idToDelete));
                        displayMessage("Agendamento excluído e sincronizado!", "success");
                    } catch (e) {
                        displayMessage("Erro ao excluir agendamento do servidor. Excluído localmente.", "error");
                        console.error("Erro ao excluir agendamento do Firestore:", e);
                    }
                } else {
                    displayMessage("Agendamento excluído localmente. Sincronizará quando online.", "info");
                }
            }
        }
    });
}

function formatDate(dateString) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

function renderAppointments() {
    const upcomingAppointmentsList = document.getElementById('upcomingAppointmentsList');
    const pastAppointmentsList = document.getElementById('pastAppointmentsList');
    upcomingAppointmentsList.innerHTML = '';
    pastAppointmentsList.innerHTML = '';

    appointments.sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.time}`);
        const dateTimeB = new Date(`${b.date}T${b.time}`);
        return dateTimeA - dateTimeB;
    });

    const now = new Date();
    let hasUpcoming = false;
    let hasPast = false;

    appointments.forEach((appointment) => {
        const li = document.createElement('li');
        li.dataset.id = appointment.id;
        const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const appointmentDateOnly = new Date(appointmentDateTime.getFullYear(), appointmentDateTime.getMonth(), appointmentDateTime.getDate());
        const isPast = appointmentDateOnly < today;
        const statusClass = isPast ? 'appointment-past' : 'appointment-upcoming';
        li.innerHTML = `
            <div class="appointment-card ${statusClass}">
                <div class="card-header">
                    <span class="card-date"><i class="fas fa-calendar-alt"></i> ${formatDate(appointment.date)}</span>
                    <span class="card-time"><i class="fas fa-clock"></i> ${appointment.time}</span>
                </div>
                <div class="card-body">
                    <p class="card-location"><i class="fas fa-map-marker-alt"></i> <strong>Local:</strong> ${appointment.location}</p>
                </div>
                <button class="delete-appointment-btn" data-id="${appointment.id}" title="Excluir agendamento"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        if (isPast) {
            pastAppointmentsList.appendChild(li);
            hasPast = true;
        } else {
            upcomingAppointmentsList.appendChild(li);
            hasUpcoming = true;
        }
    });

    if (!hasUpcoming) {
        upcomingAppointmentsList.innerHTML = '<p style="text-align: center; color: var(--text-color);">Nenhum agendamento futuro.</p>';
    }
    if (!hasPast) {
        pastAppointmentsList.innerHTML = '<p style="text-align: center; color: var(--text-color);">Nenhum jogo anterior registrado.</p>';
    }
    document.querySelectorAll('.delete-appointment-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const idToDelete = event.currentTarget.dataset.id;
            deleteAppointment(idToDelete);
        });
    });
}

async function displaySystemVersion() {
    try {
        const response = await fetch('./service-worker.js');
        if (!response.ok) {
            document.getElementById('systemVersionDisplay').textContent = 'Erro ao carregar (status: ' + response.status + ')';
            console.error('Erro ao carregar service-worker.js (status:', response.status + ')');
            return;
        }
        const text = await response.text();
        const match = text.match(/const CACHE_NAME = '(volei-das-ruas-v[^']+)';/);
        if (match && match[1]) {
            document.getElementById('systemVersionDisplay').textContent = match[1];
        } else {
            document.getElementById('systemVersionDisplay').textContent = 'Não disponível';
            console.error('Versão do Service Worker não encontrada.');
        }
    } catch (error) {
        document.getElementById('systemVersionDisplay').textContent = 'Erro ao carregar';
        console.error('Erro ao carregar service-worker.js:', error);
    }
}

function reloadApp() {
    if (newWorker) {
        newWorker.postMessage({ action: 'skipWaiting' });
    }
    window.location.reload();
}

// Event listeners para status da conexão
window.addEventListener('online', async () => {
    isOnline = true;
    console.log('App está online. Tentando sincronizar alterações offline...');
    displayMessage("Conexão reestabelecida. Sincronizando dados...", "info");
    if (isAuthReady) {
        await syncLocalToFirestore();
        setupFirestoreListeners(); // Re-configura listeners para garantir que estejam ativos
    } else {
        // Se a autenticação ainda não estiver pronta, a sincronização e os listeners serão configurados após initFirebase
        console.log("App online, mas autenticação ainda não pronta. Sincronização e listeners aguardando initFirebase.");
    }
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.log('App está offline.');
    displayMessage("Você está offline. As alterações serão salvas localmente.", "warning");
    // Não há necessidade de desconfigurar listeners, eles falharão silenciosamente ou com erro
});

window.onload = async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              document.getElementById('updateBanner').classList.add('show');
            }
          });
        });
      })
      .catch(error => console.error('Service Worker registration failed:', error));
  }

  // Carrega as configurações e dados locais primeiro
  loadLocalSettings();

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('pontuacao').classList.add('active');
  
  // Inicia o Firebase APÓS carregar as configurações locais
  await initFirebase();

  document.getElementById("scoreA").textContent = scoreA;
  document.getElementById("scoreB").textContent = scoreB;
  updateSetsDisplay();
  updateScoreboardTeamsDisplay();
  
  if (gameStarted) {
    document.getElementById('startGameButton').style.display = 'none';
    document.getElementById('scoreboardOverlay').classList.add('hidden');
  } else {
    document.getElementById('startGameButton').style.display = 'block';
    document.getElementById('scoreboardOverlay').classList.remove('hidden');
  }

  updateSwapTeamsButtonVisibility();
  updateResetButtonVisibility();
  renderGeneratedTeams();
  setupSwipeToDecrease('sectionA', 'A');
  setupSwipeToDecrease('sectionB', 'B');
  setupSwipeBetweenSections();
  document.getElementById('sectionA').addEventListener('click', (e) => {
    if (e.target.closest('.team-name') || e.target.closest('.player-info-container')) {
        showManageTeamModal('A');
    } else {
        changeScore('A', 1);
    }
  });
  document.getElementById('sectionB').addEventListener('click', (e) => {
    if (e.target.closest('.team-name') || e.target.closest('.player-info-container')) {
        showManageTeamModal('B');
    } else {
        changeScore('B', 1);
    }
  });
  updateTimerDisplay();
  displaySystemVersion();
  window.addEventListener('beforeunload', async () => {
      await saveLocalSettings();
  });
}

window.toggleMenu = toggleMenu;
window.navigateTo = navigateTo;
window.confirmReset = confirmReset;
window.addPlayer = addPlayer;
window.toggleSelectAllPlayers = toggleSelectAllPlayers;
window.generateCustomTeams = generateCustomTeams;
window.showStartGameModal = showStartGameModal;
window.swapTeams = swapTeams;
window.toggleTimer = toggleTimer;
window.addAppointment = addAppointment;
window.deleteAppointment = deleteAppointment;
window.togglePastAppointmentsSection = togglePastAppointmentsSection;
window.toggleGeneralSettingsSection = toggleGeneralSettingsSection;
window.toggleCustomTeamNamesSection = toggleCustomTeamNamesSection;
window.showManageTeamModal = showManageTeamModal;
window.saveTeamNameAndPlayers = saveTeamNameAndPlayers;
window.hideCustomMessageModal = hideCustomMessageModal;
window.hideCustomConfirmationModal = hideCustomConfirmationModal;
window.reloadApp = reloadApp;
window.setTheme = setTheme;
window.saveCustomTeamNamesToFirestore = saveCustomTeamNamesToFirestore;
window.startNewGame = startNewGame;
window.startNewSet = startNewSet;
window.increaseWinningScoreModal = increaseWinningScoreModal;
