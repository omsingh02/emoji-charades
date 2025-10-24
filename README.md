# 🎭 Emoji Charades

A 100% client-side P2P multiplayer game where players use only emojis to describe movies, songs, and books. Built with PeerJS and vanilla JavaScript - no backend server required!

## 🎮 How to Play

1. **Host** opens the game and shares the room link with friends
2. **Players** join via the link and enter their names
3. **Host** starts the game (needs 2-6 players)
4. **Each round:**
   - One player is the "describer" who gets a secret phrase
   - Describer creates clues using ONLY emojis
   - Other players type guesses in the chat
   - First correct guess wins the round!
5. After 10 rounds, see the final leaderboard

## ⚡ Features

- **True P2P**: WebRTC connections via PeerJS - zero server costs
- **No Backend**: Runs entirely in the browser
- **2-6 Players**: Perfect for small groups
- **10 Rounds**: Quick 8-10 minute sessions
- **50+ Phrases**: Movies, songs, books, and more
- **300+ Emojis**: Comprehensive emoji picker
- **Real-time Chat**: Instant message syncing
- **Smart Matching**: Case-insensitive fuzzy matching for guesses
- **Scoring System**: +10 for correct guess, +5 for describer
- **Minimal Design**: Suckless/Unix philosophy styling

## 🚀 Deployment

### GitHub Pages (Recommended)

1. **Clone or download this repo**
2. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/emoji-charades.git
   git branch -M main
   git push -u origin main
   ```
3. **Enable GitHub Pages:**
   - Go to repo Settings → Pages
   - Source: Deploy from branch `main` → `/root`
   - Save
4. **Access at:** `https://YOUR_USERNAME.github.io/emoji-charades/`

### Local Testing

Simply open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).

**Note:** For local testing with multiple players, open the game in different browsers or incognito windows.

## 📁 Project Structure

```
emoji-charades/
├── index.html      # Main HTML structure
├── styles.css      # Minimal Suckless styling
├── config.js       # Game configuration & data
├── game.js         # P2P networking & game logic
├── ui.js          # UI updates & interactions
├── favicon.svg     # Theater masks favicon
└── README.md       # This file
```

## 🔧 Technical Details

- **PeerJS**: WebRTC abstraction for P2P connections
- **No Build Process**: Pure vanilla JavaScript (ES6+)
- **Host Authority**: Host manages game state
- **Mesh Network**: All players directly connected
- **State Sync**: Broadcast system for game updates
- **Reconnection**: Automatic retry on disconnect
- **Error Handling**: Timeout detection and status messages

## 🐛 Troubleshooting

### "Connecting to host..." never resolves
- **Cause**: Network/firewall blocking WebRTC
- **Fix**: Try different network or use VPN
- **Check**: Browser console for errors (F12)

### Connection timeout
- **Cause**: Host may be offline or link expired
- **Fix**: Get fresh link from host
- **Note**: PeerJS free tier IDs expire after inactivity

### Players can't join
- **Cause**: Host hasn't set their name yet
- **Fix**: Host must enter name before sharing link

### Emojis not displaying
- **Cause**: Old browser lacking emoji support
- **Fix**: Update browser to latest version

## 🎨 Customization

### Add More Phrases
Edit `config.js` and add to the `PHRASES` array:
```javascript
const PHRASES = [
    "Your New Movie",
    "Your New Song",
    // ... existing phrases
];
```

### Change Game Settings
Modify constants in `config.js`:
```javascript
const CONFIG = {
    MAX_PLAYERS: 6,        // Max players
    MIN_PLAYERS: 2,        // Min to start
    MAX_ROUNDS: 10,        // Rounds per game
    ROUND_DELAY: 5000,     // ms between rounds
    POINTS_CORRECT_GUESS: 10,
    POINTS_DESCRIBER: 5
};
```

### Modify Emojis
Edit the `EMOJIS` array in `config.js` to add/remove emojis from the picker.

## 📝 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Contributions welcome! Some ideas:
- [ ] Add more phrase categories
- [ ] Timer per round
- [ ] Difficulty levels
- [ ] Mobile UI improvements
- [ ] Sound effects
- [ ] Emoji search/filter
- [ ] Private room codes
- [ ] Game replay feature

## 🙏 Credits

- **PeerJS**: WebRTC connection library
- **Design**: Inspired by Suckless philosophy
- Built with ❤️ and emojis

---

**Live Demo:** [Your GitHub Pages URL here]

Enjoy playing Emoji Charades! 🎉
