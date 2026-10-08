# IPL-Auction

> **Build Your Squad. Manage Your Purse. Win The Auction.**

A fully functional, broadcast-grade **Online IPL Auction Game & Simulator** supporting 19 IPL seasons from **2008 to 2026** with verified historical data. Built using pure **HTML5, CSS3, and Vanilla JavaScript** with zero external frameworks or backend dependencies.

---

## 🌟 Key Features

- **🏏 19 IPL Seasons (2008–2026)**:
  - Browse and select any season from the inaugural 2008 tournament up to the latest 2026 roster.
  - Dynamically loads verified historical teams and player pools for each selected edition.
- **💰 ₹120 Crore Starting Purse**:
  - Authentic IPL auction rules: manage a ₹120 Cr budget, minimum 18 players, maximum 25 players, and up to 8 overseas stars.
- **🤖 Realistic AI Franchises**:
  - Compete against intelligent franchise bidders evaluating player ratings, role scarcity (Batters, Bowlers, All-rounders, Wicketkeepers), and budget constraints.
- **🎮 Friends Party Mode (Pass-and-Play)**:
  - Play with up to 10 friends controlling historical franchises simultaneously.
  - Interactive manager paddles with live remaining purse tracking.
- **⏱️ Live 10-Second Countdown & Audio Gavel**:
  - Real-time bidding countdown with automatic timer resets on new bids.
  - Dynamic Web Audio API synthesizer for gavel strikes, bid sounds, ticking countdowns, and sold fanfares with zero latency.
- **📊 Comprehensive Analytics & Squad Rater**:
  - Live squad balance meters (Batting Depth, Bowling Attack, All-Round Prowess, Wicketkeeping).
  - Searchable and filterable player database by role, nationality, and price bracket.
  - End-of-auction team rankings and championship readiness reports.

---

## 🛠️ Technology Stack

- **Markup**: Semantic HTML5
- **Styling**: Vanilla CSS3 (Custom Design System, Glassmorphism, Responsive Grid)
- **Logic**: Vanilla JavaScript (ES6+ State Machine & AI Bidding Engine)
- **Audio**: Web Audio API Sound Synthesizer
- **Storage**: Browser LocalStorage for seamless auto-save and resume

---

## 🚀 How to Run Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sanjith-Y/IPL-Auction.git
   cd IPL-Auction
   ```

2. **Serve locally** (or open `index.html` directly in any modern browser):
   ```bash
   # Using Python
   python3 -m http.server 8899

   # Or using Node.js
   npx serve .
   ```

3. Open **`http://localhost:8899/index.html`** in your browser and start bidding!

---

## 📄 License

MIT License. Designed and developed for cricket enthusiasts worldwide.
