// Generate a unique client ID per session (simple random ID)
const clientId = Math.random().toString(36).substr(2, 9);

// Use this for player keys in lobbies instead of username directly

// Modify joinLobbyBtn.onclick to properly await joinLobby and catch errors
joinLobbyBtn.onclick = async () => {
  let code = sanitizeLobbyCode(joinLobbyInput.value);
  if (!code.match(/^[A-Z]{6}$/)) {
    alert('Please enter a valid 6-letter lobby code.');
    return;
  }
  try {
    await joinLobby(code);
  } catch (e) {
    alert(e.message || 'Failed to join lobby.');
  }
};

async function joinLobby(code) {
  const lobbyRef = db.collection('lobbies').doc(code);
  const doc = await lobbyRef.get();
  if (!doc.exists) {
    throw new Error('Lobby not found.');
  }

  currentLobby = code;
  showPage(lobbyPage);
  lobbyCodeDisplay.textContent = code;

  // Add player with clientId key and username value
  await db.runTransaction(async (transaction) => {
    const lobbyDoc = await transaction.get(lobbyRef);
    if (!lobbyDoc.exists) throw new Error("Lobby does not exist!");
    const players = lobbyDoc.data().players || {};
    players[clientId] = username;
    transaction.update(lobbyRef, { players });
  });

  // Remove player from lobby on page unload or refresh
  window.addEventListener('beforeunload', async () => {
    if (!currentLobby) return;
    try {
      await db.runTransaction(async (transaction) => {
        const lobbyDoc = await transaction.get(lobbyRef);
        if (!lobbyDoc.exists) return;
        const players = lobbyDoc.data().players || {};
        delete players[clientId];
        transaction.update(lobbyRef, { players });
      });
    } catch (e) {
      // Ignore errors here
    }
  });

  // Listen for players count update
  lobbyPlayersUnsub = lobbyRef.onSnapshot(snapshot => {
    const data = snapshot.data();
    const players = data?.players || {};
    const count = Object.keys(players).length;
    playerCountDisplay.textContent = `Players: ${count}`;
  });

  // Listen for lobby chat messages
  lobbyMessagesUnsub = lobbyRef.collection('messages').orderBy('timestamp')
    .onSnapshot(snapshot => {
      if (currentChat !== 'lobby') return; // only update if lobby chat is active
      messagesDiv.innerHTML = '';
      snapshot.forEach(doc => {
        const msg = doc.data();
        addMessage(messagesDiv, msg);
      });
      scrollMessagesToBottom(messagesDiv);
    });

  // Set chat tab to lobby by default
  setActiveChatTab('lobby');
}

// Leave lobby modified to use clientId key
leaveLobbyBtn.onclick = async () => {
  if (!currentLobby) return;

  const lobbyRef = db.collection('lobbies').doc(currentLobby);
  await db.runTransaction(async (transaction) => {
    const lobbyDoc = await transaction.get(lobbyRef);
    if (!lobbyDoc.exists) return;
    const players = lobbyDoc.data().players || {};
    delete players[clientId];
    transaction.update(lobbyRef, { players });
  });

  if (lobbyPlayersUnsub) lobbyPlayersUnsub();
  if (lobbyMessagesUnsub) lobbyMessagesUnsub();

  currentLobby = null;
  messagesDiv.innerHTML = '';
  chatMessageInput.value = '';
  showPage(chatChoicePage);
};
