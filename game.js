// ============================================================================
// GLOBAL STATE
// ============================================================================

let peer = null;
let peerId = null;
let connections = new Map(); // Map of peerId -> connection
let isHost = false;
let playerName = '';

let gameState = {
    players: [], // { id, name, score, isHost }
    currentRound: 0,
    maxRounds: CONFIG.MAX_ROUNDS,
    describerId: null,
    currentPhrase: '',
    emojiClue: '',
    gameStarted: false,
    roundInProgress: false,
    roundWinner: null
};

let localEmojiClue = ''; // For describer's current emoji input

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    initializePeer();
});

function initializeUI() {
    // Set name button
    document.getElementById('set-name-btn').addEventListener('click', setPlayerName);
    document.getElementById('player-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') setPlayerName();
    });

    // Start game button
    document.getElementById('start-game-btn').addEventListener('click', startGame);

    // Copy link button
    document.getElementById('copy-link-btn').addEventListener('click', copyRoomLink);

    // Emoji picker
    const emojiPicker = document.getElementById('emoji-picker');
    EMOJIS.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        btn.onclick = () => addEmoji(emoji);
        emojiPicker.appendChild(btn);
    });

    // Emoji controls
    document.getElementById('clear-emoji-btn').addEventListener('click', clearEmoji);
    document.getElementById('submit-clue-btn').addEventListener('click', submitClue);

    // Chat
    document.getElementById('send-guess-btn').addEventListener('click', sendGuess);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendGuess();
    });

    // Play again
    document.getElementById('play-again-btn').addEventListener('click', playAgain);
}

function initializePeer() {
    updateStatus('Connecting...', 'connecting');
    
    // Check if joining existing room
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');

    if (roomId) {
        // Guest joining room
        isHost = false;
        console.log('Joining room:', roomId);
        
        // Create peer with explicit configuration
        peer = new Peer({
            debug: 2, // Enable detailed logging
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });
    } else {
        // Host creating room
        isHost = true;
        console.log('Creating new room');
        
        peer = new Peer({
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });
    }

    peer.on('open', (id) => {
        peerId = id;
        console.log('Peer ID:', peerId);
        
        if (isHost) {
            // Host: Display room link
            const roomLink = `${window.location.origin}${window.location.pathname}?room=${id}`;
            document.getElementById('room-link').textContent = roomLink;
            document.getElementById('room-link-section').classList.remove('hidden');
            document.getElementById('start-game-btn').classList.remove('hidden');
            updateStatus('Connected - You are the host', 'connected');
        } else {
            // Guest: Connect to host with timeout
            connectToHost(roomId);
            
            // Set connection timeout
            setTimeout(() => {
                if (connections.size === 0) {
                    updateStatus('Connection timeout - Unable to reach host', 'error');
                    console.error('Failed to connect to host within timeout period');
                }
            }, CONFIG.CONNECTION_TIMEOUT);
        }
    });

    peer.on('connection', (conn) => {
        console.log('Incoming connection from:', conn.peer);
        handleConnection(conn);
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        let errorMsg = 'Connection error';
        
        if (err.type === 'peer-unavailable') {
            errorMsg = 'Host not found - Check the room link';
        } else if (err.type === 'network') {
            errorMsg = 'Network error - Check your connection';
        } else if (err.type === 'server-error') {
            errorMsg = 'Server error - Try refreshing the page';
        } else {
            errorMsg = `Error: ${err.type}`;
        }
        
        updateStatus(errorMsg, 'error');
    });

    peer.on('disconnected', () => {
        console.log('Peer disconnected');
        updateStatus('Disconnected - Attempting to reconnect...', 'connecting');
        
        // Attempt to reconnect
        setTimeout(() => {
            if (!peer.destroyed) {
                peer.reconnect();
            }
        }, 1000);
    });

    peer.on('close', () => {
        console.log('Peer connection closed');
        updateStatus('Connection closed', 'error');
    });
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

function connectToHost(hostId) {
    updateStatus('Connecting to host...', 'connecting');
    console.log('Attempting to connect to host:', hostId);
    
    const conn = peer.connect(hostId, {
        reliable: true,
        serialization: 'json'
    });
    
    // Set connection timeout
    const timeout = setTimeout(() => {
        if (!conn.open) {
            console.error('Connection timeout');
            updateStatus('Connection timeout - Host may be offline', 'error');
            conn.close();
        }
    }, CONFIG.CONNECTION_TIMEOUT);
    
    conn.on('open', () => {
        clearTimeout(timeout);
        console.log('Connection established with host');
    });
    
    handleConnection(conn);
}

function handleConnection(conn) {
    console.log('Setting up connection handlers for:', conn.peer);
    
    conn.on('open', () => {
        console.log('Connection opened:', conn.peer);
        connections.set(conn.peer, conn);
        
        // Send player info if name is set
        if (playerName) {
            sendMessage(conn, {
                type: 'player-join',
                player: {
                    id: peerId,
                    name: playerName,
                    score: 0,
                    isHost: isHost
                }
            });
        }
        
        updateStatus('Connected', 'connected');
        
        // If guest, prompt for name
        if (!isHost && !playerName) {
            addSystemMessage('Connected to host! Please enter your name.');
        }
    });

    conn.on('data', (data) => {
        console.log('Received data:', data.type);
        handleMessage(conn, data);
    });

    conn.on('close', () => {
        console.log('Connection closed:', conn.peer);
        connections.delete(conn.peer);
        handlePlayerDisconnect(conn.peer);
    });

    conn.on('error', (err) => {
        console.error('Connection error with', conn.peer, ':', err);
        updateStatus('Connection error occurred', 'error');
    });
}

function sendMessage(conn, message) {
    if (conn && conn.open) {
        try {
            conn.send(message);
            console.log('Sent message:', message.type);
        } catch (err) {
            console.error('Error sending message:', err);
        }
    } else {
        console.warn('Attempted to send message on closed connection');
    }
}

function broadcastMessage(message) {
    console.log('Broadcasting message:', message.type, 'to', connections.size, 'peers');
    connections.forEach((conn, peerId) => {
        sendMessage(conn, message);
    });
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

function handleMessage(conn, data) {
    switch (data.type) {
        case 'player-join':
            handlePlayerJoin(data.player, conn);
            break;
        case 'game-state':
            handleGameStateUpdate(data.state);
            break;
        case 'start-game':
            handleGameStart(data.state);
            break;
        case 'emoji-clue':
            handleEmojiClue(data.clue);
            break;
        case 'chat-message':
            handleChatMessage(data);
            break;
        case 'round-end':
            handleRoundEnd(data);
            break;
        case 'game-end':
            handleGameEnd(data.state);
            break;
        case 'play-again':
            handlePlayAgain();
            break;
    }
}

function handlePlayerJoin(player, conn) {
    console.log('Player joining:', player.name);
    
    // Check if player already exists
    const existingPlayer = gameState.players.find(p => p.id === player.id);
    if (existingPlayer) {
        console.log('Player already exists:', player.name);
        return;
    }

    // Add player
    gameState.players.push(player);
    updateLobbyPlayerList();
    
    // If host, send current game state to new player and all others
    if (isHost) {
        // Send state to new player
        if (conn && conn.open) {
            sendMessage(conn, {
                type: 'game-state',
                state: gameState
            });
        }
        
        // Broadcast updated state to all players
        broadcastMessage({
            type: 'game-state',
            state: gameState
        });
    }
    
    addSystemMessage(`${player.name} joined the game`);
}

function handleGameStateUpdate(state) {
    console.log('Updating game state');
    gameState = state;
    updateLobbyPlayerList();
    updateScoreDisplay();
}

function handleGameStart(state) {
    console.log('Game starting');
    gameState = state;
    showGameScreen();
    
    // Non-host clients wait for first round state
    if (!isHost) {
        updateGameUI();
    }
}

function handleEmojiClue(clue) {
    console.log('Received emoji clue');
    gameState.emojiClue = clue;
    document.getElementById('emoji-clue-display').textContent = clue || 'Waiting for clue...';
    addSystemMessage('Describer submitted a clue!');
}

function handleChatMessage(data) {
    // Don't duplicate local messages
    if (data.playerId !== peerId) {
        addChatMessage(data.playerName, data.message, data.isCorrect);
    }
    
    // If host and correct guess, handle it
    if (isHost && data.isCorrect && !gameState.roundWinner) {
        handleCorrectGuess(data.playerId, data.playerName);
    }
}

function handleRoundEnd(data) {
    console.log('Round ended');
    gameState = data.state;
    showRoundResults(data.winner, data.phrase);
    
    // Non-host waits for next round state from host
    if (!isHost) {
        setTimeout(() => {
            if (gameState.currentRound < gameState.maxRounds) {
                updateGameUI();
            } else {
                // Game will end, wait for game-end message
            }
        }, CONFIG.ROUND_DELAY);
    }
}

function handleGameEnd(state) {
    console.log('Game ended');
    gameState = state;
    showFinalLeaderboard();
}

function handlePlayAgain() {
    console.log('Playing again');
    resetGame();
    showGameScreen();
    updateGameUI();
}

function handlePlayerDisconnect(playerId) {
    const player = gameState.players.find(p => p.id === playerId);
    if (player) {
        addSystemMessage(`${player.name} disconnected`);
        gameState.players = gameState.players.filter(p => p.id !== playerId);
        updateLobbyPlayerList();
        updateScoreDisplay();
        
        // If host disconnected and game is running, handle gracefully
        if (player.isHost && gameState.gameStarted) {
            // Elect new host
            if (gameState.players.length > 0) {
                gameState.players[0].isHost = true;
                if (gameState.players[0].id === peerId) {
                    isHost = true;
                    addSystemMessage('You are now the host');
                }
            } else {
                // No players left, reset
                resetGame();
                showLobbyScreen();
            }
        }
    }
}

// Continue in next file...
