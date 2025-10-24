// ============================================================================
// PLAYER MANAGEMENT
// ============================================================================

function setPlayerName() {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Please enter a name');
        return;
    }
    
    playerName = name;
    
    // Add self to players list
    const selfPlayer = {
        id: peerId,
        name: playerName,
        score: 0,
        isHost: isHost
    };
    
    gameState.players.push(selfPlayer);
    
    // Hide name input
    document.getElementById('name-input-section').classList.add('hidden');
    
    // Send to all connections
    broadcastMessage({
        type: 'player-join',
        player: selfPlayer
    });
    
    updateLobbyPlayerList();
    updateStartButton();
}

function updateLobbyPlayerList() {
    const listEl = document.getElementById('lobby-player-list');
    const countEl = document.getElementById('player-count');
    
    listEl.innerHTML = '';
    countEl.textContent = gameState.players.length;
    
    gameState.players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.textContent = `${player.name}${player.isHost ? ' (Host)' : ''}`;
        listEl.appendChild(div);
    });
    
    updateStartButton();
}

function updateStartButton() {
    if (isHost) {
        const btn = document.getElementById('start-game-btn');
        const canStart = gameState.players.length >= CONFIG.MIN_PLAYERS;
        btn.disabled = !canStart;
        btn.textContent = canStart ? 'Start Game' : `Start Game (Need ${CONFIG.MIN_PLAYERS}+ players)`;
    }
}

// ============================================================================
// GAME FLOW
// ============================================================================

function startGame() {
    if (!isHost) return;
    if (gameState.players.length < CONFIG.MIN_PLAYERS) {
        alert(`Need at least ${CONFIG.MIN_PLAYERS} players to start`);
        return;
    }
    
    gameState.gameStarted = true;
    gameState.currentRound = 0;
    
    // Reset scores
    gameState.players.forEach(p => p.score = 0);
    
    // Broadcast game start
    broadcastMessage({
        type: 'start-game',
        state: gameState
    });
    
    showGameScreen();
    startRound();
}

function startRound() {
    if (!isHost) return;
    
    gameState.currentRound++;
    gameState.roundInProgress = true;
    gameState.roundWinner = null;
    gameState.emojiClue = '';
    localEmojiClue = '';
    
    // Rotate describer
    const describerIndex = (gameState.currentRound - 1) % gameState.players.length;
    gameState.describerId = gameState.players[describerIndex].id;
    
    // Pick random phrase
    gameState.currentPhrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    
    console.log(`Round ${gameState.currentRound}: Describer=${gameState.describerId}, Phrase=${gameState.currentPhrase}`);
    
    // Broadcast game state
    broadcastMessage({
        type: 'game-state',
        state: gameState
    });
    
    updateGameUI();
}

function submitClue() {
    if (gameState.describerId !== peerId) return;
    if (!localEmojiClue) {
        alert('Please add some emojis to your clue');
        return;
    }
    
    gameState.emojiClue = localEmojiClue;
    
    // Broadcast clue to all players
    const clueMessage = {
        type: 'emoji-clue',
        clue: localEmojiClue
    };
    
    if (isHost) {
        broadcastMessage(clueMessage);
    } else {
        // Send to host who will broadcast
        connections.forEach(conn => {
            sendMessage(conn, clueMessage);
        });
    }
    
    // Update local UI
    document.getElementById('emoji-clue-display').textContent = localEmojiClue;
    updateGameUI();
    addSystemMessage(`${playerName} submitted a clue!`);
}

function sendGuess() {
    const input = document.getElementById('chat-input');
    const guess = input.value.trim();
    
    if (!guess) return;
    if (!gameState.roundInProgress) return;
    if (gameState.describerId === peerId) return; // Describer can't guess
    if (gameState.roundWinner) return; // Round already won
    
    input.value = '';
    
    // Check if guess is correct
    const isCorrect = checkGuess(guess, gameState.currentPhrase);
    
    const message = {
        type: 'chat-message',
        playerId: peerId,
        playerName: playerName,
        message: guess,
        isCorrect: isCorrect,
        timestamp: Date.now()
    };
    
    // Add to local chat
    addChatMessage(playerName, guess, isCorrect);
    
    // Broadcast to all
    if (isHost) {
        broadcastMessage(message);
        
        // Handle correct guess
        if (isCorrect && !gameState.roundWinner) {
            handleCorrectGuess(peerId, playerName);
        }
    } else {
        // Send to all peers (including host)
        connections.forEach(conn => {
            sendMessage(conn, message);
        });
    }
}

function checkGuess(guess, phrase) {
    // Normalize strings: lowercase, remove special chars
    const normalizeStr = (str) => {
        return str.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };
    
    const normalizedGuess = normalizeStr(guess);
    const normalizedPhrase = normalizeStr(phrase);
    
    return normalizedGuess === normalizedPhrase;
}

function handleCorrectGuess(winnerId, winnerName) {
    if (!isHost) return;
    if (gameState.roundWinner) return; // Already has winner
    
    gameState.roundWinner = winnerId;
    gameState.roundInProgress = false;
    
    // Award points
    const winner = gameState.players.find(p => p.id === winnerId);
    const describer = gameState.players.find(p => p.id === gameState.describerId);
    
    if (winner) winner.score += CONFIG.POINTS_CORRECT_GUESS;
    if (describer) describer.score += CONFIG.POINTS_DESCRIBER;
    
    // Update scores display immediately
    updateScoreDisplay();
    
    // Broadcast round end
    broadcastMessage({
        type: 'round-end',
        state: gameState,
        winner: winnerName,
        phrase: gameState.currentPhrase
    });
    
    showRoundResults(winnerName, gameState.currentPhrase);
    
    // Start next round after delay
    setTimeout(() => {
        if (gameState.currentRound < gameState.maxRounds) {
            startRound();
        } else {
            endGame();
        }
    }, CONFIG.ROUND_DELAY);
}

function endGame() {
    if (!isHost) return;
    
    gameState.gameStarted = false;
    
    // Broadcast game end
    broadcastMessage({
        type: 'game-end',
        state: gameState
    });
    
    showFinalLeaderboard();
}

function playAgain() {
    if (!isHost) return;
    
    resetGame();
    
    broadcastMessage({
        type: 'play-again'
    });
    
    showGameScreen();
    startRound();
}

function resetGame() {
    gameState.currentRound = 0;
    gameState.gameStarted = true;
    gameState.roundInProgress = false;
    gameState.roundWinner = null;
    gameState.describerId = null;
    gameState.currentPhrase = '';
    gameState.emojiClue = '';
    gameState.players.forEach(p => p.score = 0);
    
    localEmojiClue = '';
    document.getElementById('emoji-preview').textContent = '';
    document.getElementById('chat-messages').innerHTML = '';
}

// ============================================================================
// EMOJI PICKER
// ============================================================================

function addEmoji(emoji) {
    localEmojiClue += emoji;
    document.getElementById('emoji-preview').textContent = localEmojiClue;
}

function clearEmoji() {
    localEmojiClue = '';
    document.getElementById('emoji-preview').textContent = '';
}

// ============================================================================
// CHAT
// ============================================================================

function addChatMessage(name, message, isCorrect = false) {
    const chatEl = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `chat-message${isCorrect ? ' correct' : ''}`;
    div.textContent = `${name}: ${message}`;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
}

function addSystemMessage(message) {
    const chatEl = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-message system';
    div.textContent = `[${message}]`;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateStatus(text, status) {
    const statusEl = document.getElementById('connection-status');
    const textEl = document.getElementById('status-text');
    
    statusEl.className = `connection-status status-${status}`;
    textEl.textContent = text;
}

function showLobbyScreen() {
    document.getElementById('lobby-screen').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('round-results').classList.add('hidden');
    document.getElementById('final-leaderboard').classList.add('hidden');
}

function showGameScreen() {
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('round-results').classList.add('hidden');
    document.getElementById('final-leaderboard').classList.add('hidden');
    
    updateGameUI();
}

function updateGameUI() {
    // Update round info
    document.getElementById('current-round').textContent = gameState.currentRound;
    document.getElementById('max-rounds').textContent = gameState.maxRounds;
    
    // Update describer name
    const describer = gameState.players.find(p => p.id === gameState.describerId);
    document.getElementById('current-describer-name').textContent = describer ? describer.name : '-';
    
    // Show appropriate view
    const isDescriber = gameState.describerId === peerId;
    const hasClue = gameState.emojiClue !== '';
    
    document.getElementById('describer-view').classList.toggle('hidden', !isDescriber || hasClue);
    document.getElementById('guesser-view').classList.toggle('hidden', isDescriber || !hasClue);
    document.getElementById('waiting-view').classList.toggle('hidden', gameState.roundInProgress && (isDescriber || hasClue));
    
    // Update describer view
    if (isDescriber && !hasClue) {
        document.getElementById('secret-phrase-text').textContent = gameState.currentPhrase;
        document.getElementById('emoji-preview').textContent = localEmojiClue;
    }
    
    // Update guesser view
    if (!isDescriber && hasClue) {
        document.getElementById('emoji-clue-display').textContent = gameState.emojiClue;
    }
    
    // Update scores
    updateScoreDisplay();
    
    // Disable chat input for describer or if round not in progress
    const canChat = !isDescriber && gameState.roundInProgress && hasClue && !gameState.roundWinner;
    document.getElementById('chat-input').disabled = !canChat;
    document.getElementById('send-guess-btn').disabled = !canChat;
}

function updateScoreDisplay() {
    const scoreEl = document.getElementById('score-list');
    scoreEl.innerHTML = '';
    
    // Sort by score
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    
    sortedPlayers.forEach(player => {
        const div = document.createElement('div');
        div.className = 'score-item';
        if (player.id === gameState.describerId) {
            div.classList.add('current-describer');
        }
        
        const name = document.createElement('span');
        name.textContent = player.name;
        
        const score = document.createElement('span');
        score.textContent = player.score;
        
        div.appendChild(name);
        div.appendChild(score);
        scoreEl.appendChild(div);
    });
}

function showRoundResults(winnerName, phrase) {
    const resultsEl = document.getElementById('round-results');
    const contentEl = document.getElementById('results-content');
    
    contentEl.innerHTML = `
        <div class="winner-announcement">🎉 ${winnerName} guessed correctly!</div>
        <p><strong>The answer was:</strong> ${phrase}</p>
        <p><strong>Emoji clue:</strong> ${gameState.emojiClue}</p>
    `;
    
    resultsEl.classList.remove('hidden');
    
    setTimeout(() => {
        resultsEl.classList.add('hidden');
    }, CONFIG.ROUND_DELAY - 500);
}

function showFinalLeaderboard() {
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('round-results').classList.add('hidden');
    document.getElementById('final-leaderboard').classList.remove('hidden');
    
    // Show play again button only to host
    document.getElementById('play-again-btn').classList.toggle('hidden', !isHost);
    
    const scoresEl = document.getElementById('final-scores');
    scoresEl.innerHTML = '';
    
    // Sort by score
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    
    sortedPlayers.forEach((player, index) => {
        const div = document.createElement('div');
        div.className = 'leaderboard-item';
        
        const position = document.createElement('span');
        position.textContent = `#${index + 1} ${player.name}`;
        
        const score = document.createElement('span');
        score.textContent = `${player.score} points`;
        
        div.appendChild(position);
        div.appendChild(score);
        scoresEl.appendChild(div);
    });
}

function copyRoomLink() {
    const linkEl = document.getElementById('room-link');
    const link = linkEl.textContent;
    
    navigator.clipboard.writeText(link).then(() => {
        const btn = document.getElementById('copy-link-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy link. Please copy manually.');
    });
}

// ============================================================================
// QR CODE GENERATION
// ============================================================================

function generateQRCode(url) {
    const canvas = document.getElementById('qr-code');
    const placeholder = document.getElementById('qr-placeholder');
    
    if (typeof QRCode !== 'undefined') {
        QRCode.toCanvas(canvas, url, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        }, (error) => {
            if (error) {
                console.error('QR Code generation error:', error);
                placeholder.textContent = 'QR code generation failed';
            } else {
                console.log('QR code generated successfully');
                canvas.style.display = 'block';
                placeholder.style.display = 'none';
            }
        });
    } else {
        console.error('QRCode library not loaded');
        placeholder.textContent = 'QR code library not available';
    }
}
