import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, addDoc, deleteDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const DEFAULT_CUSTOM_TEAM_COLORS = ["#007bff", "#dc3545", "#28a745", "#ffc107", "#6f42c1"];
let players = [];
let checkedState = {};
let generatedTeams = [];
let winningScore = 15;
let setsToWin = 0;
let playersPerTeam = 4;
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
let appointments = [];
let newWorker = null;

let db;
let auth;
let userId;
let isAuthReady = false;

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

async function initFirebase() {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            document.getElementById('userIdDisplay').textContent = `ID do Usuário: ${userId}`;
        } else {
            userId = crypto.randomUUID();
            document.getElementById('userIdDisplay').textContent = `ID do Usuário: ${userId} (Anônimo)`;
        }
        isAuthReady = true;
        loadLocalSettings();
        setupFirestoreListeners();
    });

    if (typeof __initial_auth_token !== 'undefined') {
        try {
            await signInWithCustomToken(auth, __initial_auth_token);
        } catch (error) {
            await signInAnonymously(auth);
        }
    } else {
        await signInAnonymously(auth);
    }
}

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

    document.getElementById('winningScore').value = winningScore;
    document.getElementById('setsToWinConfig').value = setsToWin;
    document.getElementById('playersPerTeam').value = playersPerTeam;
    document.getElementById('vibrationEnabled').checked = vibrationEnabled;
    document.getElementById('showPlayersOnScoreboard').checked = showPlayersOnScoreboard;

    document.getElementById('themeSelect').value = currentTheme;
    setTheme(currentTheme, false);
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
}

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

    updatePlayerDisplayOnScoreboard();
    applyTeamColorsToScoreboard();
}

async function setupFirestoreListeners() {
    if (!isAuthReady) return;

    onSnapshot(collection(db, `artifacts/${appId}/public/data/players`), (snapshot) => {
        const fetchedPlayers = [];
        const fetchedCheckedState = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            fetchedPlayers.push(data.name);
            fetchedCheckedState[data.name] = data.checked;
        });
        players = fetchedPlayers;
        checkedState = fetchedCheckedState;
        updatePlayerList();
    }, (error) => {
        console.error("Erro ao carregar jogadores:", error);
    });

    onSnapshot(collection(db, `artifacts/${appId}/public/data/appointments`), (snapshot) => {
        const fetchedAppointments = [];
        snapshot.forEach(doc => {
            fetchedAppointments.push({ id: doc.id, ...doc.data() });
        });
        appointments = fetchedAppointments;
        renderAppointments();
    }, (error) => {
        console.error("Erro ao carregar agendamentos:", error);
    });

    onSnapshot(collection(db, `artifacts/${appId}/public/data/customTeamNames`), (snapshot) => {
        const fetchedCustomTeamNames = [];
        snapshot.forEach(doc => {
            fetchedCustomTeamNames.push(doc.data());
        });
        customTeamNames = fetchedCustomTeamNames;
        while (customTeamNames.length < 5) {
            customTeamNames.push({ name: "", color: DEFAULT_CUSTOM_TEAM_COLORS[customTeamNames.length] || '#cccccc' });
        }
        for (let i = 0; i < 5; i++) {
            document.getElementById(`customTeamName${i + 1}`).value = customTeamNames[i].name;
            document.getElementById(`customTeamColor${i + 1}`).value = customTeamNames[i].color;
        }
    }, (error) => {
        console.error("Erro ao carregar nomes de times personalizados:", error);
    });
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

async function addPlayer() {
  if (!isAuthReady) return;
  const input = document.getElementById("playerName");
  const name = input.value.trim();
  if (name && !players.includes(name)) {
    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/players`), { name: name, checked: true });
        input.value = "";
    } catch (e) {
        displayMessage("Erro ao adicionar jogador.", "error");
    }
  } else if (players.includes(name)) {
    displayMessage("Este nome já está na lista.", "warning");
  }
}

function updatePlayerList() {
  players.sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }));
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = checkedState[p] !== false;
    checkbox.style.marginRight = '.5rem';
    checkbox.style.width = '1rem';
    checkbox.onchange = async () => {
      if (!isAuthReady) return;
      checkedState[p] = checkbox.checked;
      try {
          const q = query(collection(db, `artifacts/${appId}/public/data/players`), where("name", "==", p));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
              const playerDoc = querySnapshot.docs[0];
              await updateDoc(doc(db, `artifacts/${appId}/public/data/players`, playerDoc.id), { checked: checkbox.checked });
          }
      } catch (e) {
          displayMessage("Erro ao atualizar status do jogador.", "error");
      }
      updatePlayerCounter();
      updateToggleSelectAllButtonText();
    };
    const span = document.createElement("span");
    span.textContent = p;
    const btn = document.createElement("button");
    btn.textContent = "Remover";
    btn.className = "btn";
    btn.onclick = () => {
        showConfirmationModal("Tem certeza que deseja remover este jogador?", async (confirmed) => {
            if (confirmed) {
                if (!isAuthReady) return;
                try {
                    const q = query(collection(db, `artifacts/${appId}/public/data/players`), where("name", "==", p));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        const playerDoc = querySnapshot.docs[0];
                        await deleteDoc(doc(db, `artifacts/${appId}/public/data/players`, playerDoc.id));
                    }
                    generatedTeams = [];
                    renderGeneratedTeams();
                    resetGame();
                } catch (e) {
                    displayMessage("Erro ao remover jogador.", "error");
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
  const selected = players.filter(p => checkedState[p] !== false).length;
  const total = players.length;
  document.getElementById("playerCounter").textContent = `${selected}/${total}`;
}

async function toggleSelectAllPlayers() {
  if (!isAuthReady) return;
  const allSelected = players.every(p => checkedState[p] !== false);
  try {
      const playersCollectionRef = collection(db, `artifacts/${appId}/public/data/players`);
      const querySnapshot = await getDocs(playersCollectionRef);
      const batch = [];
      querySnapshot.forEach(playerDoc => {
          batch.push(updateDoc(doc(db, `artifacts/${appId}/public/data/players`, playerDoc.id), { checked: !allSelected }));
      });
      await Promise.all(batch);
  } catch (e) {
      displayMessage("Erro ao alternar seleção de jogadores.", "error");
  }
}

function updateToggleSelectAllButtonText() {
  const toggleButton = document.getElementById('toggleSelectAllButton');
  if (toggleButton) {
    const allSelected = players.every(p => checkedState[p] !== false);
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
  showStartGameModal();
  generatedTeams = [];
  renderGeneratedTeams();
  stopAllTimers();
  gameTimeInSeconds = 0;
  setTimeInSeconds = 0;
  updateTimerDisplay();
  await saveLocalSettings();
}

async function resetAllData() {
    showConfirmationModal("Tem certeza que deseja resetar TODOS os dados? Isso apagará jogadores, times gerados, configurações e o estado atual do jogo.", async (confirmed) => {
        if (confirmed) {
            if (!isAuthReady) return;
            try {
                const playersCollectionRef = collection(db, `artifacts/${appId}/public/data/players`);
                const appointmentsCollectionRef = collection(db, `artifacts/${appId}/public/data/appointments`);
                const customTeamNamesCollectionRef = collection(db, `artifacts/${appId}/public/data/customTeamNames`);

                const playerDocs = await getDocs(playersCollectionRef);
                const appointmentDocs = await getDocs(appointmentsCollectionRef);
                const customTeamNameDocs = await getDocs(customTeamNamesCollectionRef);

                const deletePromises = [];
                playerDocs.forEach(d => deletePromises.push(deleteDoc(doc(db, `artifacts/${appId}/public/data/players`, d.id))));
                appointmentDocs.forEach(d => deletePromises.push(deleteDoc(doc(db, `artifacts/${appId}/public/data/appointments`, d.id))));
                customTeamNameDocs.forEach(d => deletePromises.push(deleteDoc(doc(db, `artifacts/${appId}/public/data/customTeamNames`, d.id))));

                await Promise.all(deletePromises);

                localStorage.clear();
                location.reload();
            } catch (e) {
                displayMessage("Erro ao resetar todos os dados.", "error");
            }
        }
    });
}

function confirmResetAllData() {
    resetAllData();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[i], array[j]];
  }
}

async function generateCustomTeams() {
  const perTeam = parseInt(document.getElementById("playersPerTeam").value);

  if (isNaN(perTeam) || perTeam <= 0) {
    displayMessage("Informe um número válido de jogadores por time.", "error");
    return false;
  }
  const selectedPlayers = players.filter(p => checkedState[p] !== false);
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
    const customTeam = customTeamNames[teamCount - 1];
    const teamName = customTeam && customTeam.name.trim() !== "" ? customTeam.name : `Time ${teamCount}`;
    const teamColor = customTeam ? customTeam.color : DEFAULT_CUSTOM_TEAM_COLORS[teamCount - 1] || '#cccccc';
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
  document.getElementById('startGameButton').style.display = 'none';
  document.getElementById('scoreboardOverlay').classList.add('hidden');
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
    if (document.getElementById("gearMenu").classList.contains("show") ||
        document.getElementById("gameOverModal").classList.contains("show") ||
        document.getElementById("increaseScoreModal").classList.contains("show") ||
        document.getElementById("startGameModal").classList.contains("show") ||
        document.getElementById("superVictoryModal").classList.contains("show") ||
        document.getElementById("customMessageModal").classList.contains("show") ||
        document.getElementById("customConfirmationModal").classList.contains("show") ||
        document.getElementById("manageTeamModal").classList.contains("show") ||
        e.target.closest('#startGameButton') || e.target.closest('#swapTeamsButton')) {
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
    const touchEndX = e.changedTouches[0].clientX;
    const dx = touchStartX - touchEndX;
    const threshold = 50;

    if (document.getElementById("gameOverModal").classList.contains("show") ||
        document.getElementById("increaseScoreModal").classList.contains("show") ||
        document.getElementById("startGameModal").classList.contains("show") ||
        document.getElementById("superVictoryModal").classList.contains("show") ||
        document.getElementById("customMessageModal").classList.contains("show") ||
        document.getElementById("customConfirmationModal").classList.contains("show") ||
        document.getElementById("manageTeamModal").classList.contains("show") ||
        e.target.closest('#startGameButton') || e.target.closest('#swapTeamsButton') ||
        document.getElementById("gearMenu").classList.contains("show")
        ) {
        touchStartX = null;
        return;
    }

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

    if (generatedTeams.length === 0) {
        selectElement.innerHTML += '<option value="" disabled>Nenhum time gerado</option>';
    } else {
        generatedTeams.forEach((team, index) => {
            const option = document.createElement('option');
            option.value = `generated-${index}`;
            option.textContent = `${team.name}`;
            if (currentTeam.name === team.name && currentTeam.players.length === team.players.length && currentTeam.players.every((p, i) => p === team.players[i])) {
              option.selected = true;
            }
            selectElement.appendChild(option);
        });
    }

    const selectedValue = selectElement.value;
    const isCurrentTeamGenerated = selectedValue.startsWith('generated-');
    const currentTeamIndex = isCurrentTeamGenerated ? parseInt(selectedValue.split('-')[1]) : -1;

    if (currentTeamIndex === -1 ||
        (generatedTeams[currentTeamIndex].name !== currentTeam.name ||
         !generatedTeams[currentTeamIndex].players.every((p, i) => p === currentTeam.players[i])) ) {
          selectElement.value = "";
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
    }

    targetTeam.name = finalTeamName;
    targetTeam.players = finalTeamPlayers;
    targetTeam.color = finalTeamColor;

    updateScoreboardTeamsDisplay();
    hideManageTeamModal();
    await saveLocalSettings();
}

async function saveCustomTeamNamesToFirestore() {
    if (!isAuthReady) return;
    try {
        const customTeamNamesCollectionRef = collection(db, `artifacts/${appId}/public/data/customTeamNames`);
        const existingDocs = await getDocs(customTeamNamesCollectionRef);
        const batch = [];
        existingDocs.forEach(d => batch.push(deleteDoc(doc(db, `artifacts/${appId}/public/data/customTeamNames`, d.id))));
        await Promise.all(batch);

        const addPromises = [];
        for (let i = 0; i < 5; i++) {
            const name = document.getElementById(`customTeamName${i + 1}`).value;
            const color = document.getElementById(`customTeamColor${i + 1}`).value;
            addPromises.push(addDoc(customTeamNamesCollectionRef, { name: name, color: color, order: i }));
        }
        await Promise.all(addPromises);
    } catch (e) {
        console.error("Erro ao salvar times personalizados:", e);
        displayMessage("Erro ao salvar times personalizados.", "error");
    }
}

function toggleCustomTeamNamesSection() {
    const content = document.getElementById('customTeamNamesContent');
    const arrow = document.getElementById('customTeamNamesArrow');
    content.classList.toggle('show');
    arrow.classList.toggle('rotated');
    if (content.classList.contains('show')) {
        for (let i = 0; i < 5; i++) {
            document.getElementById(`customTeamName${i + 1}`).addEventListener('change', saveCustomTeamNamesToFirestore);
            document.getElementById(`customTeamColor${i + 1}`).addEventListener('change', saveCustomTeamNamesToFirestore);
        }
    } else {
        for (let i = 0; i < 5; i++) {
            document.getElementById(`customTeamName${i + 1}`).removeEventListener('change', saveCustomTeamNamesToFirestore);
            document.getElementById(`customTeamColor${i + 1}`).removeEventListener('change', saveCustomTeamNamesToFirestore);
        }
    }
}

function toggleGeneralSettingsSection() {
    const content = document.getElementById('generalSettingsContent');
    const arrow = document.getElementById('generalSettingsArrow');
    content.classList.toggle('show');
    arrow.classList.toggle('rotated');
}

function toggleDataManagementSection() {
    const content = document.getElementById('dataManagementContent');
    const arrow = document.getElementById('dataManagementArrow');
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

async function exportSettings() {
    const appStateToExport = {
        winningScore: winningScore,
        setsToWin: setsToWin,
        playersPerTeam: playersPerTeam,
        currentTheme: currentTheme,
        vibrationEnabled: vibrationEnabled,
        showPlayersOnScoreboard: showPlayersOnScoreboard,
        generatedTeams: generatedTeams
    };
    const dataStr = JSON.stringify(appStateToExport, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'placar_volei_config_local.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    displayMessage("Configurações locais exportadas com sucesso!", "success");
}

function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedAppState = JSON.parse(e.target.result);

            winningScore = importedAppState.winningScore !== undefined ? importedAppState.winningScore : 15;
            setsToWin = importedAppState.setsToWin !== undefined ? importedAppState.setsToWin : 0;
            playersPerTeam = importedAppState.playersPerTeam !== undefined ? importedAppState.playersPerTeam : 4;
            currentTheme = importedAppState.currentTheme || 'dark';
            vibrationEnabled = importedAppState.vibrationEnabled !== undefined ? importedAppState.vibrationEnabled : true;
            showPlayersOnScoreboard = importedAppState.showPlayersOnScoreboard !== undefined ? importedAppState.showPlayersOnScoreboard : true;
            generatedTeams = importedAppState.generatedTeams || [];

            scoreA = 0;
            scoreB = 0;
            setsA = 0;
            setsB = 0;
            gameEnded = false;
            gameStarted = false;
            lastWinningTeam = null;
            currentPlayingTeamA = { name: 'Time A', players: [], color: '#007bff' };
            currentPlayingTeamB = { name: 'Time B', players: [], color: '#dc3545' };
            gameTimeInSeconds = 0;
            setTimeInSeconds = 0;
            isTimerRunning = false;
            stopAllTimers();

            document.getElementById('winningScore').value = winningScore;
            document.getElementById('setsToWinConfig').value = setsToWin;
            document.getElementById('playersPerTeam').value = playersPerTeam;
            document.getElementById('vibrationEnabled').checked = vibrationEnabled;
            document.getElementById('showPlayersOnScoreboard').checked = showPlayersOnScoreboard;
            document.getElementById('themeSelect').value = currentTheme;
            setTheme(currentTheme, false);

            updateSetsDisplay();
            document.getElementById("scoreA").textContent = scoreA;
            document.getElementById("scoreB").textContent = scoreB;
            updateScoreboardTeamsDisplay();
            updateSwapTeamsButtonVisibility();
            updateResetButtonVisibility();
            document.getElementById('startGameButton').style.display = 'block';
            document.getElementById('scoreboardOverlay').classList.remove('hidden');
            updateTimerDisplay();

            await saveLocalSettings();
            displayMessage("Configurações locais importadas com sucesso!", "success");

        } catch (error) {
            displayMessage("Erro ao importar arquivo. Verifique se é um arquivo de configurações válido.", "error");
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
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

async function addAppointment() {
    if (!isAuthReady) return;
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
        date: date,
        time: time,
        location: location
    };

    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/appointments`), newAppointment);
        gameDateInput.value = '';
        gameTimeInput.value = '';
        gameLocationInput.value = '';
        displayMessage("Agendamento adicionado com sucesso!", "success");
    } catch (e) {
        displayMessage("Erro ao adicionar agendamento.", "error");
    }
}

function deleteAppointment(idToDelete) {
    showConfirmationModal("Tem certeza que deseja excluir este agendamento?", async (confirmed) => {
        if (confirmed) {
            if (!isAuthReady) return;
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/appointments`, idToDelete));
                displayMessage("Agendamento excluído com sucesso!", "success");
            } catch (e) {
                displayMessage("Erro ao excluir agendamento.", "error");
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
            return;
        }
        const text = await response.text();
        const match = text.match(/const CACHE_NAME = '(volei-das-ruas-v[^']+)';/);

        if (match && match[1]) {
            document.getElementById('systemVersionDisplay').textContent = match[1];
        } else {
            document.getElementById('systemVersionDisplay').textContent = 'Não disponível';
        }
    } catch (error) {
        document.getElementById('systemVersionDisplay').textContent = 'Erro ao carregar';
    }
}

function reloadApp() {
    if (newWorker) {
        newWorker.postMessage({ action: 'skipWaiting' });
    }
    window.location.reload();
}

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

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('pontuacao').classList.add('active');

  await initFirebase();

  document.getElementById("scoreA").textContent = scoreA;
  document.getElementById("scoreB").textContent = scoreB;
  updateSetsDisplay();
  updateScoreboardTeamsDisplay();

  document.getElementById('startGameButton').style.display = 'block';
  document.getElementById('scoreboardOverlay').classList.remove('hidden');

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
window.toggleDataManagementSection = toggleDataManagementSection;
window.exportSettings = exportSettings;
window.importSettings = importSettings;
window.confirmResetAllData = confirmResetAllData;
window.confirmIncreaseWinningScore = confirmIncreaseWinningScore;
window.hideIncreaseScoreModal = hideIncreaseScoreModal;
window.confirmStartGame = confirmStartGame;
window.hideStartGameModal = hideStartGameModal;
window.startNewGame = startNewGame;
window.startNewSet = startNewSet;
window.increaseWinningScoreModal = increaseWinningScoreModal;
window.showManageTeamModal = showManageTeamModal;
window.saveTeamNameAndPlayers = saveTeamNameAndPlayers;
window.hideCustomMessageModal = hideCustomMessageModal;
window.hideCustomConfirmationModal = hideCustomConfirmationModal;
window.reloadApp = reloadApp;
window.setTheme = setTheme;
