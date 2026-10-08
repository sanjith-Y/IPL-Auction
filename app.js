/**
 * IPL AUCTION GAME - CORE APPLICATION ENGINE
 * Pure Vanilla JavaScript (ES6+), HTML5, CSS3 & LocalStorage
 * Supports 19 IPL Seasons (2008 to 2026) with verified historical data
 */

(function () {
  'use strict';

  // Constants & Config
  const STORAGE_KEY = 'IPL_AUCTION_PRO_STATE_V1';
  const STARTING_PURSE = 120.0; // ₹120 Crore per prompt requirements
  const MIN_SQUAD_SIZE = 18;
  const MAX_SQUAD_SIZE = 25;
  const MAX_OVERSEAS = 8;
  const TIMER_DEFAULT = 10; // 10 seconds live countdown

  // Default 10 Friends Roster
  const DEFAULT_10_FRIENDS = {
    CSK: "Friend 1",
    MI: "Friend 2",
    RCB: "Friend 3",
    KKR: "Friend 4",
    DC: "Friend 5",
    PBKS: "Friend 6",
    RR: "Friend 7",
    SRH: "Friend 8",
    GT: "Friend 9",
    LSG: "Friend 10"
  };

  // Application State
  const state = {
    selectedSeason: 2021,
    userTeamId: null,
    teams: {}, // Map of teamId -> team object
    auctionPool: [],
    currentPlayerIndex: 0,
    unsoldPool: [],
    soldHistory: [],
    eventLog: [],
    
    // Play Mode & Multi-Manager
    playMode: 'solo', // 'solo' or 'party'
    activeBiddingTeamId: null,
    managerAssignments: { ...DEFAULT_10_FRIENDS },
    squadViewingTeamId: null,

    // Live Auction State
    currentBid: 0,
    highestBidderId: null,
    isBiddingActive: false,
    isPaused: false,
    speedMultiplier: 1, // 1 or 2
    timerRemaining: TIMER_DEFAULT,
    timerInterval: null,
    aiTimeout: null,
    autoAdvance: true,
    roundCompleted: false,
    isUnsoldRound: false,

    // Statistics Cache
    highestSale: { player: null, amount: 0, team: null },
    totalSpent: 0
  };

  // =========================================================================
  // INITIALIZATION & LIFECYCLE
  // =========================================================================

  function initApp() {
    console.log('🏏 Initializing IPL Auction Game Simulator...');
    renderSeasonsGrid();
    renderHistoryTimeline();

    // Check LocalStorage for saved game
    const saved = loadGame();
    if (saved) {
      updateHomeResumeBanner();
    } else {
      // Default to IPL 2024 season if no saved session so tabs are immediately ready
      loadSeason(2024);
      if (state.teams && Object.keys(state.teams).length > 0) {
        state.userTeamId = Object.keys(state.teams)[0];
      }
    }

    // Set up Global Click / Hotkey bindings
    setupEventHandlers();

    // Default route
    navigateTo('home');
  }

  function setupEventHandlers() {
    // Auto advance checkbox
    const autoAdvCheck = document.getElementById('autoAdvanceCheck');
    if (autoAdvCheck) {
      autoAdvCheck.addEventListener('change', (e) => {
        state.autoAdvance = e.target.checked;
      });
    }

    // Close modals on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeResetModal();
        closeTeamSquadModal();
      }
    });
  }

  // =========================================================================
  // NAVIGATION & ROUTING
  // =========================================================================

  function navigateTo(viewId) {
    try {
      // Hide all views
      document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

      const targetView = document.getElementById(`view-${viewId}`);
      if (targetView) {
        targetView.classList.add('active');
      }

      // Highlight active nav item
      const navBtn = document.querySelector(`.nav-item[data-target="${viewId}"]`);
      if (navBtn) {
        navBtn.classList.add('active');
      }

      // Trigger view-specific refreshes safely without blocking navigation
      try {
        if (viewId === 'players') {
          filterPlayersDatabase();
        } else if (viewId === 'squad') {
          renderMySquadView();
        } else if (viewId === 'teams') {
          renderAllTeamsView();
        } else if (viewId === 'statistics') {
          renderStatisticsView();
        } else if (viewId === 'results') {
          renderResultsView();
        } else if (viewId === 'auction') {
          updatePurseHeader();
        }
      } catch (err) {
        console.warn(`Error refreshing view for ${viewId}:`, err);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(`Error navigating to ${viewId}:`, e);
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'gold') toast.style.borderColor = 'var(--gold)';
    if (type === 'error') toast.style.borderColor = 'var(--rose)';
    if (type === 'success') toast.style.borderColor = 'var(--emerald)';

    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // =========================================================================
  // SEASONS HANDLING (2008 - 2026)
  // =========================================================================

  function renderSeasonsGrid(filterCategory = 'all') {
    const grid = document.getElementById('seasonsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const seasons = window.IPL_SEASONS || {};
    const years = Object.keys(seasons).map(Number).sort((a, b) => b - a); // 2026 down to 2008

    years.forEach(year => {
      // Category filter
      if (filterCategory === 'modern' && year < 2021) return;
      if (filterCategory === 'middle' && (year < 2014 || year > 2020)) return;
      if (filterCategory === 'classic' && year > 2013) return;

      const s = seasons[year];
      if (!s) return;

      const card = document.createElement('div');
      card.className = `season-card ${state.selectedSeason === year ? 'selected' : ''}`;
      card.id = `seasonCard-${year}`;
      card.onclick = () => selectSeasonCard(year);

      const teamCount = s.teams ? s.teams.length : 8;
      const playerCount = s.players ? s.players.length : 20;

      // Render team chips preview
      let teamDotsHtml = '';
      if (s.teams) {
        s.teams.slice(0, 6).forEach(t => {
          teamDotsHtml += `<span class="team-dot-chip" style="border-left: 3px solid ${t.primaryColor}">${t.shortName}</span>`;
        });
        if (s.teams.length > 6) {
          teamDotsHtml += `<span class="team-dot-chip">+${s.teams.length - 6} more</span>`;
        }
      }

      card.innerHTML = `
        <div class="season-card-top">
          <span class="season-year-badge">${year}</span>
          <span class="season-champ-pill">🏆 ${s.champions || 'IPL Champion'}</span>
        </div>
        <h3 class="season-title-text">${s.title}</h3>
        <p class="season-desc-text">${s.description}</p>
        <div class="season-teams-preview">
          ${teamDotsHtml}
        </div>
        <div class="season-meta-row">
          <span>${teamCount} Franchises</span>
          <span>${playerCount} Players Pool</span>
          <span class="text-gold">₹120 Cr Purse</span>
        </div>
      `;

      grid.appendChild(card);
    });
  }

  function filterSeasonCards(category, btn) {
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderSeasonsGrid(category);
  }

  function selectSeasonCard(year) {
    state.selectedSeason = year;
    document.querySelectorAll('.season-card').forEach(c => c.classList.remove('selected'));
    const selectedCard = document.getElementById(`seasonCard-${year}`);
    if (selectedCard) selectedCard.classList.add('selected');

    const s = window.IPL_SEASONS[year];
    if (!s) return;

    // Show bottom confirmation bar
    const bar = document.getElementById('seasonConfirmBar');
    bar.style.display = 'flex';
    document.getElementById('selectedSeasonTitle').innerText = `${s.title} (${year})`;
    document.getElementById('selectedSeasonSummary').innerText = 
      `${s.teams.length} Historical Franchises • ${s.players.length} Verified Players • Starting Purse ₹120.00 Cr`;

    const chipsContainer = document.getElementById('participatingTeamsChips');
    chipsContainer.innerHTML = '';
    s.teams.forEach(t => {
      const chip = document.createElement('span');
      chip.className = 'team-dot-chip';
      chip.style.borderColor = t.primaryColor;
      chip.innerText = `${t.badge} ${t.shortName}`;
      chipsContainer.appendChild(chip);
    });
  }

  function confirmSeasonAndProceed() {
    loadSeason(state.selectedSeason);
    renderTeamSelectionView();
    setPlayMode(state.playMode || 'solo');
    navigateTo('team-select');
  }

  // =========================================================================
  // LOAD SEASON & TEAM SELECTION
  // =========================================================================

  function loadSeason(year) {
    const seasonData = window.IPL_SEASONS[year];
    if (!seasonData) {
      console.error(`Season ${year} data not found!`);
      showToast(`Error: Season ${year} data missing`, 'error');
      return false;
    }

    state.selectedSeason = year;
    state.teams = {};
    state.soldHistory = [];
    state.eventLog = [];
    state.unsoldPool = [];
    state.highestSale = { player: null, amount: 0, team: null };
    state.totalSpent = 0;
    state.roundCompleted = false;
    state.isUnsoldRound = false;

    // Deep clone teams with initial purse ₹120.00 Cr
    seasonData.teams.forEach(t => {
      state.teams[t.id] = {
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        city: t.city,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        badge: t.badge,
        purse: STARTING_PURSE,
        spent: 0.0,
        squad: [],
        overseasCount: 0,
        rating: 0
      };
    });

    // Deep clone player pool
    state.auctionPool = JSON.parse(JSON.stringify(seasonData.players));
    state.currentPlayerIndex = 0;

    // Update Header Pill
    const seasonBadge = document.getElementById('currentSeasonBadge');
    seasonBadge.style.display = 'flex';
    document.getElementById('badgeSeasonText').innerText = `IPL ${year}`;

    // Populate Original Team Filter in Player Database
    populateOriginalTeamFilter();

    console.log(`Loaded IPL Season ${year}: ${seasonData.teams.length} teams, ${seasonData.players.length} players.`);
    return true;
  }

  function renderTeamSelectionView() {
    const s = window.IPL_SEASONS[state.selectedSeason];
    if (!s) return;

    document.getElementById('teamSelectSeasonYear').innerText = state.selectedSeason;
    const grid = document.getElementById('teamsSelectGrid');
    grid.innerHTML = '';

    const confirmBar = document.getElementById('teamConfirmBar');
    confirmBar.style.display = 'none';

    s.teams.forEach(t => {
      const card = document.createElement('div');
      card.className = `team-select-card ${state.userTeamId === t.id ? 'selected' : ''}`;
      card.id = `teamCard-${t.id}`;
      card.style.setProperty('--team-primary', t.primaryColor);
      card.onclick = () => selectUserTeam(t.id);

      card.innerHTML = `
        <div class="team-card-header">
          <div class="team-badge-large">${t.badge}</div>
          <div class="team-info-group">
            <h3>${t.name}</h3>
            <span class="team-city-tag">📍 ${t.city} • Code: <strong>${t.shortName}</strong></span>
          </div>
        </div>
        <div class="team-stats-box">
          <div class="team-stat-cell">
            <span>STARTING PURSE</span>
            <strong class="text-gold">₹120.00 Cr</strong>
          </div>
          <div class="team-stat-cell">
            <span>SQUAD TARGET</span>
            <strong>18–25 Players</strong>
          </div>
        </div>
        <button class="select-team-btn">${state.userTeamId === t.id ? '✓ SELECTED AS MY TEAM' : 'SELECT AS MY TEAM'}</button>
      `;

      grid.appendChild(card);
    });
  }

  function selectUserTeam(teamId) {
    state.userTeamId = teamId;
    const team = state.teams[teamId];
    if (!team) return;

    document.querySelectorAll('.team-select-card').forEach(c => {
      c.classList.remove('selected');
      const btn = c.querySelector('.select-team-btn');
      if (btn) btn.innerText = 'SELECT AS MY TEAM';
    });

    const activeCard = document.getElementById(`teamCard-${teamId}`);
    if (activeCard) {
      activeCard.classList.add('selected');
      const btn = activeCard.querySelector('.select-team-btn');
      if (btn) btn.innerText = '✓ SELECTED AS MY TEAM';
    }

    // Show confirm bar
    const bar = document.getElementById('teamConfirmBar');
    bar.style.display = 'flex';
    document.getElementById('selectedTeamName').innerText = `${team.badge} ${team.name} (${team.shortName})`;

    // Play pleasant chime
    if (window.auctionSounds) window.auctionSounds.playBid();
  }

  function confirmTeamAndStartAuction() {
    if (!state.userTeamId) {
      showToast('Please select a franchise first!', 'error');
      return;
    }

    state.playMode = 'solo';
    state.activeBiddingTeamId = state.userTeamId;
    initializeAuction();
    navigateTo('auction');
    saveGame();
    showToast(`Welcome! You are managing ${state.teams[state.userTeamId].name}!`, 'gold');
  }

  // =========================================================================
  // 10 FRIENDS MULTIPLAYER / PARTY MODE
  // =========================================================================

  function setPlayMode(mode) {
    state.playMode = mode;
    const btnSolo = document.getElementById('btnModeSolo');
    const btnParty = document.getElementById('btnModeParty');
    const panel = document.getElementById('friendsConfigPanel');
    const teamsGrid = document.getElementById('teamsSelectGrid');
    const confirmBar = document.getElementById('teamConfirmBar');

    if (mode === 'party') {
      if (btnSolo) btnSolo.classList.remove('active');
      if (btnParty) btnParty.classList.add('active');
      if (panel) panel.style.display = 'block';
      if (teamsGrid) teamsGrid.style.display = 'none';
      if (confirmBar) confirmBar.style.display = 'none';
      renderFriendsConfigPanel();
    } else {
      if (btnSolo) btnSolo.classList.add('active');
      if (btnParty) btnParty.classList.remove('active');
      if (panel) panel.style.display = 'none';
      if (teamsGrid) teamsGrid.style.display = 'grid';
    }
  }

  function startAuctionFlow(mode = 'solo') {
    state.playMode = mode;
    navigateTo('seasons');
    if (mode === 'party') {
      showToast('Select any season (2008–2026) to play with your friends!', 'gold');
    }
  }

  function renderFriendsConfigPanel() {
    const grid = document.getElementById('friendsRosterGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const teams = Object.values(state.teams);
    teams.forEach((t, index) => {
      const card = document.createElement('div');
      card.className = 'friend-slot-card';

      // Assign default name: Friend 1, Friend 2, etc. if not customized
      if (!state.managerAssignments[t.id]) {
        state.managerAssignments[t.id] = `Friend ${index + 1}`;
      }
      const currentManager = state.managerAssignments[t.id];

      card.innerHTML = `
        <div class="friend-slot-badge">${t.badge}</div>
        <div class="friend-slot-details">
          <div class="friend-slot-team-title">
            <span style="color: ${t.primaryColor}">${t.name} (${t.shortName})</span>
            <span class="text-gold">₹120.00 Cr</span>
          </div>
          <input type="text" class="friend-slot-input" value="${currentManager}"
            placeholder="Friend Name" onchange="window.iplApp.updateManagerName('${t.id}', this.value)">
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function updateManagerName(teamId, newName) {
    if (newName && newName.trim()) {
      state.managerAssignments[teamId] = newName.trim();
    }
  }

  function confirm10FriendsAndStart() {
    confirmFriendsAndStart();
  }

  function confirmFriendsAndStart() {
    state.playMode = 'party';
    state.userTeamId = Object.keys(state.teams)[0] || 'CSK';
    state.activeBiddingTeamId = state.userTeamId;

    initializeAuction();
    navigateTo('auction');
    saveGame();
    showToast(`🎮 Friends Party Mode Started for IPL ${state.selectedSeason}! All manager paddles active.`, 'gold');
  }

  function renderManagerPaddles() {
    const row = document.getElementById('paddlesScrollRow');
    if (!row) return;
    row.innerHTML = '';

    const teams = Object.values(state.teams);
    if (!state.activeBiddingTeamId && teams.length > 0) {
      state.activeBiddingTeamId = state.userTeamId || teams[0].id;
    }

    teams.forEach(t => {
      const btn = document.createElement('button');
      const isSelected = t.id === state.activeBiddingTeamId;
      const managerName = state.managerAssignments[t.id] || (t.id === state.userTeamId ? 'My Team' : t.shortName);
      btn.className = `team-paddle-btn ${isSelected ? 'active' : ''}`;
      btn.id = `paddleBtn-${t.id}`;
      btn.onclick = () => selectActiveBiddingTeam(t.id);

      btn.innerHTML = `
        <span>${t.badge}</span>
        <span>${managerName} (${t.shortName})</span>
        <span class="paddle-purse-chip">₹${t.purse.toFixed(2)}Cr</span>
      `;
      row.appendChild(btn);
    });

    updateActiveManagerDisplay();
  }

  function selectActiveBiddingTeam(teamId) {
    state.activeBiddingTeamId = teamId;
    document.querySelectorAll('.team-paddle-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`paddleBtn-${teamId}`);
    if (btn) btn.classList.add('active');

    updateActiveManagerDisplay();
    updateUserBidControls();
  }

  function updateActiveManagerDisplay() {
    const activeTeam = state.teams[state.activeBiddingTeamId];
    if (!activeTeam) return;

    const mgr = state.managerAssignments[activeTeam.id] || activeTeam.shortName;
    const tag = document.getElementById('activeManagerTag');
    if (tag) tag.innerText = `${mgr} (${activeTeam.name})`;

    const teamCode = document.getElementById('userControlsTeamCode');
    if (teamCode) teamCode.innerText = `${mgr} (${activeTeam.shortName})`;

    const purseElem = document.getElementById('userControlsPurse');
    if (purseElem) purseElem.innerText = `₹${activeTeam.purse.toFixed(2)} Cr`;
  }

  // =========================================================================
  // AUCTION ROOM CORE ENGINE
  // =========================================================================

  function initializeAuction() {
    console.log('Auction initialized.');
    state.isPaused = false;
    state.roundCompleted = false;

    // Reset controls UI
    document.getElementById('roundCompleteBar').style.display = 'none';
    document.getElementById('soldOverlay').style.display = 'none';

    updatePurseHeader();
    updateTeamsPurseList();
    renderManagerPaddles();
    loadCurrentPlayer();
  }

  function getCurrentPlayer() {
    if (state.currentPlayerIndex < 0 || state.currentPlayerIndex >= state.auctionPool.length) {
      return null;
    }
    return state.auctionPool[state.currentPlayerIndex];
  }

  function loadCurrentPlayer() {
    const player = getCurrentPlayer();
    if (!player) {
      onAuctionRoundComplete();
      return;
    }

    // Reset bidding state
    state.currentBid = player.basePrice;
    state.highestBidderId = null;
    state.isBiddingActive = true;
    state.timerRemaining = TIMER_DEFAULT;

    // Clear existing AI timers
    clearTimeout(state.aiTimeout);
    clearInterval(state.timerInterval);

    // Update Progress Counter
    const total = state.auctionPool.length;
    const currentIdx = state.currentPlayerIndex + 1;
    document.getElementById('auctionPlayerCounter').innerText = `Player ${currentIdx} of ${total}`;
    const pct = Math.round((currentIdx / total) * 100);
    document.getElementById('auctionProgressBar').style.width = `${pct}%`;

    // Render Player Card (Left Column)
    renderPlayerCard(player);

    // Render Live Bidding Arena (Center Column)
    renderBiddingArena(player);

    // Update Bid Controls & Paddles
    renderManagerPaddles();
    updateUserBidControls();

    // Reset Sold Modal
    document.getElementById('soldOverlay').style.display = 'none';

    // Start live countdown & AI evaluation
    startCountdown();
    scheduleNextAIBid(1500 / state.speedMultiplier);

    // Play tick
    if (window.auctionSounds) window.auctionSounds.playTick();
  }

  function renderPlayerCard(player) {
    document.getElementById('playerPoolTag').innerText = `LOT #${state.currentPlayerIndex + 1}`;
    document.getElementById('playerName').innerText = player.name;
    document.getElementById('playerInitials').innerText = getInitials(player.name);
    document.getElementById('playerCountry').innerText = player.isOverseas ? `✈️ ${player.nationality}` : `🇮🇳 ${player.nationality}`;
    document.getElementById('playerOriginalTeam').innerText = `Ex-${player.originalTeam || 'IPL'}`;
    document.getElementById('playerBio').innerText = player.description || `${player.role} with world-class skill.`;
    document.getElementById('playerRoleBadge').innerText = player.role;

    // Avatar Role Color Styling
    const avatar = document.getElementById('playerAvatar');
    const badge = document.getElementById('playerRoleBadge');
    if (player.role === 'Batter') {
      avatar.style.borderColor = 'var(--gold)';
      badge.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    } else if (player.role === 'Bowler') {
      avatar.style.borderColor = 'var(--cyan)';
      badge.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
    } else if (player.role === 'All-rounder') {
      avatar.style.borderColor = 'var(--emerald)';
      badge.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    } else {
      avatar.style.borderColor = 'var(--purple)';
      badge.style.background = 'linear-gradient(135deg, #8b5cf6, #6d28d9)';
    }

    // Ratings
    document.getElementById('playerRatingNum').innerText = player.overallRating;
    document.getElementById('scoreBatting').innerText = player.battingRating;
    document.getElementById('scoreBowling').innerText = player.bowlingRating;
    document.getElementById('scoreFielding').innerText = player.fieldingRating;

    document.getElementById('meterBatting').style.width = `${player.battingRating}%`;
    document.getElementById('meterBowling').style.width = `${player.bowlingRating}%`;
    document.getElementById('meterFielding').style.width = `${player.fieldingRating}%`;

    // Specs
    document.getElementById('playerBasePrice').innerText = `₹${player.basePrice.toFixed(2)} Cr`;
    document.getElementById('playerOverseasStatus').innerText = player.isOverseas ? 'Yes (Foreign)' : 'No (Domestic)';
  }

  function renderBiddingArena(player) {
    const bidDisplay = document.getElementById('currentBidDisplay');
    bidDisplay.innerText = `₹${state.currentBid.toFixed(2)} Cr`;
    bidDisplay.classList.remove('bid-pulse');

    const statusMsg = document.getElementById('statusMessage');
    statusMsg.innerText = 'BIDDING ACTIVE';

    const highestBidderPill = document.getElementById('highestBidderPill');
    const highestBidderName = document.getElementById('highestBidderName');
    const highestBidderBadge = document.getElementById('highestBidderBadge');

    if (state.highestBidderId) {
      const team = state.teams[state.highestBidderId];
      highestBidderName.innerText = `${team.name} (${team.shortName})`;
      highestBidderBadge.innerText = team.badge;
      highestBidderPill.style.borderColor = team.primaryColor;
    } else {
      highestBidderName.innerText = 'None (Opening at Base Price)';
      highestBidderBadge.innerText = '⏳';
      highestBidderPill.style.borderColor = 'var(--border-subtle)';
    }

    // Reset timer graphics
    updateTimerCircle(TIMER_DEFAULT, TIMER_DEFAULT);
  }

  // =========================================================================
  // LIVE COUNTDOWN TIMER & GAVEL SYSTEM
  // =========================================================================

  function startCountdown() {
    clearInterval(state.timerInterval);
    state.timerRemaining = TIMER_DEFAULT;
    updateTimerDisplay();

    const intervalMs = 1000 / state.speedMultiplier;
    state.timerInterval = setInterval(() => {
      if (state.isPaused || !state.isBiddingActive) return;

      state.timerRemaining--;
      updateTimerDisplay();

      // Audio & Status Cues
      if (state.timerRemaining === 3) {
        setStatusMessage('GOING ONCE... 🔨');
        if (window.auctionSounds) window.auctionSounds.playTick();
      } else if (state.timerRemaining === 2) {
        setStatusMessage('GOING TWICE... 🔨🔨');
        if (window.auctionSounds) window.auctionSounds.playTick();
      } else if (state.timerRemaining === 1) {
        setStatusMessage('FINAL CALL! ⚠️');
        if (window.auctionSounds) window.auctionSounds.playTick();
      } else if (state.timerRemaining <= 0) {
        clearInterval(state.timerInterval);
        onCountdownComplete();
      }
    }, intervalMs);
  }

  function resetCountdown() {
    state.timerRemaining = TIMER_DEFAULT;
    updateTimerDisplay();
    setStatusMessage('NEW BID PLACED! ⚡');
    startCountdown();
  }

  function updateTimerDisplay() {
    const numDisplay = document.getElementById('timerNumber');
    if (numDisplay) {
      numDisplay.innerText = state.timerRemaining < 10 ? `0${state.timerRemaining}` : state.timerRemaining;
    }
    updateTimerCircle(state.timerRemaining, TIMER_DEFAULT);
  }

  function updateTimerCircle(remaining, total) {
    const circle = document.getElementById('timerCircle');
    if (!circle) return;

    const circumference = 264; // 2 * pi * 42
    const offset = circumference - (remaining / total) * circumference;
    circle.style.strokeDashoffset = offset;

    if (remaining <= 2) {
      circle.style.stroke = 'var(--rose)';
    } else if (remaining <= 3) {
      circle.style.stroke = 'var(--gold)';
    } else {
      circle.style.stroke = 'var(--cyan)';
    }
  }

  function setStatusMessage(msg) {
    const elem = document.getElementById('statusMessage');
    if (elem) elem.innerText = msg;
  }

  function onCountdownComplete() {
    state.isBiddingActive = false;
    clearTimeout(state.aiTimeout);

    const player = getCurrentPlayer();
    if (!player) return;

    if (state.highestBidderId) {
      // Player is SOLD!
      sellPlayer(player, state.highestBidderId, state.currentBid);
    } else {
      // Player is UNSOLD!
      markUnsold(player);
    }
  }

  // =========================================================================
  // BIDDING SYSTEM & VALIDATION
  // =========================================================================

  function placeBid(newAmount, bidderTeamId) {
    if (!state.isBiddingActive || state.isPaused) return false;

    const team = state.teams[bidderTeamId];
    if (!team) return false;

    const player = getCurrentPlayer();
    if (!player) return false;

    // Validation 1: Purse limit check
    if (team.purse < newAmount) {
      if (bidderTeamId === state.userTeamId) {
        showBidError('INSUFFICIENT PURSE: You cannot bid more than your remaining purse!');
      }
      return false;
    }

    // Validation 2: Squad size cap (25 players)
    if (team.squad.length >= MAX_SQUAD_SIZE) {
      if (bidderTeamId === state.userTeamId) {
        showBidError('SQUAD FULL: Maximum squad size of 25 players reached!');
      }
      return false;
    }

    // Validation 3: Overseas limit (8 overseas)
    if (player.isOverseas && team.overseasCount >= MAX_OVERSEAS) {
      if (bidderTeamId === state.userTeamId) {
        showBidError('OVERSEAS CAP REACHED: Maximum 8 overseas players allowed!');
      }
      return false;
    }

    // Hide user error
    hideBidError();

    // Accept bid
    state.currentBid = Math.round(newAmount * 100) / 100;
    state.highestBidderId = bidderTeamId;

    // Sound effect
    if (window.auctionSounds) window.auctionSounds.playBid();

    // Visual pulse on digital board
    const board = document.getElementById('currentBidDisplay');
    board.innerText = `₹${state.currentBid.toFixed(2)} Cr`;
    board.classList.add('bid-pulse');
    setTimeout(() => board.classList.remove('bid-pulse'), 300);

    // Update highest bidder banner
    const highestBidderName = document.getElementById('highestBidderName');
    const highestBidderBadge = document.getElementById('highestBidderBadge');
    const highestBidderPill = document.getElementById('highestBidderPill');
    const mgr = state.managerAssignments[team.id];
    const mgrLabel = mgr ? `${mgr} (${team.name})` : `${team.name} (${team.shortName})`;
    highestBidderName.innerText = mgrLabel;
    highestBidderBadge.innerText = team.badge;
    highestBidderPill.style.borderColor = team.primaryColor;

    // Log to Activity Feed
    const feedTag = mgr ? `${team.shortName} [${mgr}]` : team.shortName;
    logAuctionEvent(`${feedTag} bid ₹${state.currentBid.toFixed(2)} Cr for ${player.name}`, team.primaryColor);

    // Update user controls & paddles
    renderManagerPaddles();
    updateUserBidControls();

    // Reset countdown
    resetCountdown();

    // In Solo Mode, let AI evaluate next response. In Party Mode, friends place bids!
    if (state.playMode === 'solo') {
      scheduleNextAIBid((1200 + Math.random() * 1000) / state.speedMultiplier);
    }

    return true;
  }

  // User Bidding Action Handlers
  function userPlaceBid(increment) {
    if (!state.isBiddingActive || state.isPaused) return;

    const biddingTeamId = state.activeBiddingTeamId || state.userTeamId;
    const team = state.teams[biddingTeamId];
    if (!team) return;

    // Calculate new bid amount
    let targetBid;
    if (state.highestBidderId === null) {
      // Opening bid
      targetBid = state.currentBid; // Opens at base price
      if (state.highestBidderId === biddingTeamId) {
        targetBid = state.currentBid + increment;
      }
    } else {
      targetBid = state.currentBid + increment;
    }

    const success = placeBid(targetBid, biddingTeamId);
    if (!success) {
      const mgr = state.managerAssignments[biddingTeamId] || team.name;
      showToast(`Bid not placed: check purse or team limits for ${mgr}`, 'error');
    }
  }

  function userPassPlayer() {
    if (!state.isBiddingActive) return;
    showToast('Passed on current player.', 'info');
    if (state.playMode === 'solo') {
      scheduleNextAIBid(400 / state.speedMultiplier);
    }
  }

  function updateUserBidControls() {
    const biddingTeamId = state.activeBiddingTeamId || state.userTeamId;
    const team = state.teams[biddingTeamId];
    if (!team) return;

    const mgr = state.managerAssignments[team.id];
    const displayLabel = mgr ? `${mgr} (${team.shortName})` : team.shortName;

    const codeElem = document.getElementById('userControlsTeamCode');
    if (codeElem) codeElem.innerText = displayLabel;

    const purseElem = document.getElementById('userControlsPurse');
    if (purseElem) purseElem.innerText = `₹${team.purse.toFixed(2)} Cr`;

    const isUserLeading = state.highestBidderId === biddingTeamId;

    // Buttons
    const b25 = document.getElementById('btnBid25');
    const b50 = document.getElementById('btnBid50');
    const b100 = document.getElementById('btnBid100');
    const b200 = document.getElementById('btnBid200');

    const nextBase = isUserLeading ? state.currentBid : (state.highestBidderId ? state.currentBid : state.currentBid - 0.25);

    if (b25) b25.disabled = (nextBase + 0.25 > team.purse) || isUserLeading || !state.isBiddingActive;
    if (b50) b50.disabled = (nextBase + 0.50 > team.purse) || isUserLeading || !state.isBiddingActive;
    if (b100) b100.disabled = (nextBase + 1.00 > team.purse) || isUserLeading || !state.isBiddingActive;
    if (b200) b200.disabled = (nextBase + 2.00 > team.purse) || isUserLeading || !state.isBiddingActive;
  }

  function showBidError(msg) {
    const errBox = document.getElementById('bidErrorMsg');
    if (errBox) {
      errBox.innerText = `⚠️ ${msg}`;
      errBox.style.display = 'block';
    }
  }

  function hideBidError() {
    const errBox = document.getElementById('bidErrorMsg');
    if (errBox) errBox.style.display = 'none';
  }

  // =========================================================================
  // AI TEAMS BIDDING INTELLIGENCE
  // =========================================================================

  function scheduleNextAIBid(delayMs) {
    clearTimeout(state.aiTimeout);
    if (!state.isBiddingActive || state.isPaused) return;

    state.aiTimeout = setTimeout(() => {
      evaluateAIBids();
    }, delayMs);
  }

  function evaluateAIBids() {
    if (!state.isBiddingActive || state.isPaused) return;
    if (state.playMode === 'party') return; // In 10-friends party mode, bidding is 100% human-driven among friends!

    const player = getCurrentPlayer();
    if (!player) return;

    // Find all eligible AI teams interested in this player
    const eligibleBidders = [];

    Object.values(state.teams).forEach(team => {
      if (team.id === state.userTeamId) return; // Skip user team
      if (team.id === state.highestBidderId) return; // Already leading bidder

      // Squad capacity check
      if (team.squad.length >= MAX_SQUAD_SIZE) return;

      // Overseas limit check
      if (player.isOverseas && team.overseasCount >= MAX_OVERSEAS) return;

      // Budget reserve: Must keep minimum ₹0.50 Cr for remaining slots up to 18
      const slotsNeeded = Math.max(0, MIN_SQUAD_SIZE - (team.squad.length + 1));
      const requiredReserve = slotsNeeded * 0.50;
      const maxAffordable = team.purse - requiredReserve;

      // Increments: Realistic scaling
      let inc = 0.25;
      if (state.currentBid >= 10.0) inc = 1.00;
      else if (state.currentBid >= 5.0) inc = 0.50;

      const proposedBid = state.highestBidderId ? (state.currentBid + inc) : state.currentBid;

      if (proposedBid > maxAffordable) return;

      // Calculate AI's subjective valuation for this player
      const valuation = computeAIValuation(team, player);

      if (proposedBid <= valuation) {
        // AI is interested!
        eligibleBidders.push({
          teamId: team.id,
          proposedBid: proposedBid,
          desireScore: (valuation - proposedBid) + (Math.random() * 2)
        });
      }
    });

    if (eligibleBidders.length > 0) {
      // Pick team with highest desire/probability
      eligibleBidders.sort((a, b) => b.desireScore - a.desireScore);
      const chosen = eligibleBidders[0];
      placeBid(chosen.proposedBid, chosen.teamId);
    }
  }

  function computeAIValuation(team, player) {
    // 1. Base valuation from player rating
    // Rating 95-99: ₹16 - ₹26 Cr
    // Rating 90-94: ₹9 - ₹16 Cr
    // Rating 85-89: ₹4 - ₹9 Cr
    // Rating < 85:  ₹1 - ₹4 Cr
    let baseVal = player.basePrice;
    const rating = player.overallRating;

    if (rating >= 96) {
      baseVal = 18.0 + (rating - 96) * 3.0;
    } else if (rating >= 92) {
      baseVal = 11.0 + (rating - 92) * 1.6;
    } else if (rating >= 88) {
      baseVal = 6.0 + (rating - 88) * 1.2;
    } else if (rating >= 82) {
      baseVal = 2.5 + (rating - 82) * 0.6;
    } else {
      baseVal = player.basePrice * 1.2;
    }

    // 2. Role Scarcity & Squad Need Multipliers
    let needMultiplier = 1.0;
    const squadRoles = { Batter: 0, Bowler: 0, 'All-rounder': 0, Wicketkeeper: 0 };
    team.squad.forEach(p => {
      squadRoles[p.role] = (squadRoles[p.role] || 0) + 1;
    });

    if (player.role === 'Wicketkeeper') {
      if (squadRoles.Wicketkeeper === 0) needMultiplier += 0.35; // Desperate for WK!
      else if (squadRoles.Wicketkeeper >= 2) needMultiplier -= 0.3;
    } else if (player.role === 'Bowler') {
      if (squadRoles.Bowler < 4) needMultiplier += 0.25;
      else if (squadRoles.Bowler >= 8) needMultiplier -= 0.2;
    } else if (player.role === 'Batter') {
      if (squadRoles.Batter < 4) needMultiplier += 0.2;
      else if (squadRoles.Batter >= 8) needMultiplier -= 0.2;
    } else if (player.role === 'All-rounder') {
      if (squadRoles['All-rounder'] < 2) needMultiplier += 0.25;
    }

    // 3. Franchise Wealth factor
    const wealthFactor = Math.min(1.25, team.purse / 60.0);

    const finalVal = baseVal * needMultiplier * wealthFactor;
    return Math.round(finalVal * 100) / 100;
  }

  // =========================================================================
  // SOLD & UNSOLD COMPLETION HANDLERS
  // =========================================================================

  function sellPlayer(player, winningTeamId, winningBid) {
    const team = state.teams[winningTeamId];
    if (!team) return;

    // Deduct Purse
    updatePurse(winningTeamId, winningBid);

    // Add player to team squad
    const acquiredPlayer = {
      ...player,
      soldPrice: winningBid,
      soldTeam: team.shortName,
      soldTeamId: winningTeamId
    };
    team.squad.push(acquiredPlayer);
    if (player.isOverseas) {
      team.overseasCount++;
    }

    // Update Team Strength
    team.rating = calculateSquadRating(team.squad);

    // Record in global history
    state.soldHistory.push(acquiredPlayer);
    state.totalSpent += winningBid;

    // Check Highest Sale
    if (winningBid > state.highestSale.amount) {
      state.highestSale = {
        player: player.name,
        amount: winningBid,
        team: team.name
      };
    }

    // Log event
    const winningMgr = state.managerAssignments[winningTeamId];
    const winTag = winningMgr ? ` (${winningMgr})` : '';
    logAuctionEvent(`🔥 SOLD TO ${team.shortName}${winTag} — ₹${winningBid.toFixed(2)} Cr`, team.primaryColor);

    // Audio Sold Fanfare
    if (window.auctionSounds) window.auctionSounds.playSold();

    // Show SOLD Modal
    const modal = document.getElementById('soldOverlay');
    const modalIcon = document.getElementById('soldModalIcon');
    const modalTitle = document.getElementById('soldModalTitle');
    const modalPlayer = document.getElementById('soldModalPlayer');
    const modalPrice = document.getElementById('soldModalPrice');
    const modalTeam = document.getElementById('soldModalTeam');

    modalIcon.innerText = '🔥';
    modalTitle.innerText = 'SOLD!';
    modalPlayer.innerText = player.name;
    modalPrice.innerText = `₹${winningBid.toFixed(2)} Cr`;
    modalTeam.innerText = `${team.badge} ${team.name} ${winTag}`;

    modal.style.display = 'flex';

    // Update UI components
    updatePurseHeader();
    updateTeamsPurseList();
    renderManagerPaddles();
    updateUserTeamSummaryCard();
    saveGame();

    // Auto Advance after 2.8s if enabled
    if (state.autoAdvance) {
      setTimeout(() => {
        nextPlayer();
      }, 2800 / state.speedMultiplier);
    }
  }

  function markUnsold(player) {
    const unsoldPlayer = {
      ...player,
      soldPrice: 0,
      soldTeam: null,
      soldTeamId: null,
      isUnsold: true
    };
    state.unsoldPool.push(unsoldPlayer);

    logAuctionEvent(`❌ UNSOLD — ${player.name} (Base: ₹${player.basePrice.toFixed(2)} Cr)`, '#ef4444');

    // Audio Unsold Buzz
    if (window.auctionSounds) window.auctionSounds.playUnsold();

    // Show UNSOLD Modal
    const modal = document.getElementById('soldOverlay');
    const modalIcon = document.getElementById('soldModalIcon');
    const modalTitle = document.getElementById('soldModalTitle');
    const modalPlayer = document.getElementById('soldModalPlayer');
    const modalPrice = document.getElementById('soldModalPrice');
    const modalTeam = document.getElementById('soldModalTeam');

    modalIcon.innerText = '🚫';
    modalTitle.innerText = 'UNSOLD';
    modalPlayer.innerText = player.name;
    modalPrice.innerText = `Base Price: ₹${player.basePrice.toFixed(2)} Cr`;
    modalTeam.innerText = 'Moved to Unsold Pool for Re-Auction';

    modal.style.display = 'flex';

    saveGame();

    // Auto Advance after 2.4s if enabled
    if (state.autoAdvance) {
      setTimeout(() => {
        nextPlayer();
      }, 2400 / state.speedMultiplier);
    }
  }

  function nextPlayer() {
    state.currentPlayerIndex++;
    loadCurrentPlayer();
  }

  function nextPlayerManual() {
    document.getElementById('soldOverlay').style.display = 'none';
    nextPlayer();
  }

  function onAuctionRoundComplete() {
    state.isBiddingActive = false;
    state.roundCompleted = true;
    clearInterval(state.timerInterval);
    clearTimeout(state.aiTimeout);

    console.log('Auction round complete.');
    const completeBar = document.getElementById('roundCompleteBar');
    completeBar.style.display = 'flex';

    const unsoldBtn = document.getElementById('btnReauctionUnsold');
    const unsoldCounter = document.getElementById('unsoldCounter');
    unsoldCounter.innerText = state.unsoldPool.length;

    if (state.unsoldPool.length === 0) {
      unsoldBtn.style.display = 'none';
      document.getElementById('roundCompleteSummary').innerText =
        'All players in this season have been successfully SOLD! View final championship rankings.';
    } else {
      unsoldBtn.style.display = 'inline-flex';
      document.getElementById('roundCompleteSummary').innerText =
        `Round finished! ${state.unsoldPool.length} players remain unsold. You can re-auction them or proceed to final rankings.`;
    }

    if (window.auctionSounds) window.auctionSounds.playFanfare();
    saveGame();
  }

  function startUnsoldRound() {
    if (state.unsoldPool.length === 0) {
      showToast('No unsold players remaining!', 'info');
      return;
    }

    state.isUnsoldRound = true;
    state.auctionPool = [...state.unsoldPool];
    state.unsoldPool = [];
    state.currentPlayerIndex = 0;
    state.roundCompleted = false;

    document.getElementById('roundCompleteBar').style.display = 'none';
    showToast('Starting Re-Auction Round for Unsold Players!', 'gold');
    loadCurrentPlayer();
  }

  function finishAuctionAndShowResults() {
    navigateTo('results');
  }

  // =========================================================================
  // PURSE & RATINGS CALCULATION
  // =========================================================================

  function updatePurse(teamId, amountDeducted) {
    const team = state.teams[teamId];
    if (!team) return;

    team.purse = Math.max(0, Math.round((team.purse - amountDeducted) * 100) / 100);
    team.spent = Math.round((team.spent + amountDeducted) * 100) / 100;
  }

  function updatePurseHeader() {
    if (!state.userTeamId) return;
    const team = state.teams[state.userTeamId];
    if (!team) return;

    const pill = document.getElementById('headerPursePill');
    pill.style.display = 'flex';
    document.getElementById('headerPurseAmount').innerText = `₹${team.purse.toFixed(2)} Cr`;
    document.getElementById('navSquadCount').innerText = `${team.squad.length}/25`;
  }

  function updateUserTeamSummaryCard() {
    if (!state.userTeamId) return;
    const team = state.teams[state.userTeamId];
    if (!team) return;

    document.getElementById('myTeamBadge').innerText = team.badge;
    document.getElementById('myTeamName').innerText = team.name;
    document.getElementById('myTeamPurseRemaining').innerText = `₹${team.purse.toFixed(2)} Cr`;
    document.getElementById('myTeamPurseSpent').innerText = `₹${team.spent.toFixed(2)} Cr`;
    document.getElementById('myTeamSquadSize').innerText = `${team.squad.length} / 25`;
    document.getElementById('myTeamOverseasSize').innerText = `${team.overseasCount} / 8`;
    document.getElementById('myTeamSquadRating').innerText = team.rating > 0 ? `${team.rating} / 100` : '--';
  }

  function updateTeamsPurseList() {
    const list = document.getElementById('teamsPurseList');
    if (!list) return;
    list.innerHTML = '';

    const teams = Object.values(state.teams);
    teams.sort((a, b) => b.purse - a.purse);

    document.getElementById('aiTeamsCountTag').innerText = `${teams.length} Franchises`;

    teams.forEach(t => {
      const isUser = t.id === state.userTeamId;
      const mgr = state.managerAssignments[t.id];
      const mgrTag = mgr ? `<span class="gold-badge" style="font-size: 0.65rem; margin-left: 4px;">${mgr}</span>` : '';
      const row = document.createElement('div');
      row.className = `rival-team-row ${isUser ? 'highlighted' : ''}`;
      row.onclick = () => openTeamSquadModal(t.id);

      row.innerHTML = `
        <div class="rival-team-info">
          <span class="rival-badge">${t.badge}</span>
          <div class="rival-name-group">
            <span class="rival-name">${t.shortName} ${mgrTag} ${isUser && state.playMode === 'solo' ? '<strong class="text-gold">(MY TEAM)</strong>' : ''}</span>
            <span class="rival-squad-count">${t.squad.length} players • Rating: ${t.rating || '--'}</span>
          </div>
        </div>
        <div class="rival-purse-group">
          <span class="rival-purse-val">₹${t.purse.toFixed(2)} Cr</span>
          <span class="rival-spent-val">Spent: ₹${t.spent.toFixed(2)} Cr</span>
        </div>
      `;

      list.appendChild(row);
    });
  }

  function calculateSquadRating(squad) {
    if (!squad || squad.length === 0) return 0;

    // Weight top 11 players heavily (70%), remainder (30%)
    const sorted = [...squad].sort((a, b) => b.overallRating - a.overallRating);
    const top11 = sorted.slice(0, 11);
    const bench = sorted.slice(11);

    const top11Avg = top11.reduce((sum, p) => sum + p.overallRating, 0) / top11.length;
    let benchAvg = top11Avg;
    if (bench.length > 0) {
      benchAvg = bench.reduce((sum, p) => sum + p.overallRating, 0) / bench.length;
    }

    const composite = (top11Avg * 0.75) + (benchAvg * 0.25);
    return Math.round(composite);
  }

  function calculateSquadBalanceMeters(squad) {
    let batRating = 0, batCount = 0;
    let bowlRating = 0, bowlCount = 0;
    let arRating = 0, arCount = 0;
    let wkRating = 0, wkCount = 0;

    squad.forEach(p => {
      if (p.role === 'Batter') {
        batRating += p.battingRating;
        batCount++;
      } else if (p.role === 'Bowler') {
        bowlRating += p.bowlingRating;
        bowlCount++;
      } else if (p.role === 'All-rounder') {
        arRating += (p.battingRating + p.bowlingRating) / 2;
        arCount++;
      } else if (p.role === 'Wicketkeeper') {
        wkRating += p.overallRating;
        wkCount++;
      }
    });

    return {
      battingScore: batCount > 0 ? Math.round(batRating / batCount) : 0,
      batCount,
      bowlingScore: bowlCount > 0 ? Math.round(bowlRating / bowlCount) : 0,
      bowlCount,
      arScore: arCount > 0 ? Math.round(arRating / arCount) : 0,
      arCount,
      wkScore: wkCount > 0 ? Math.round(wkRating / wkCount) : 0,
      wkCount
    };
  }

  // =========================================================================
  // VIEW: MY SQUAD
  // =========================================================================

  function renderSquadManagerTabs(activeId) {
    const tabsContainer = document.getElementById('squadManagerTabs');
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';

    Object.values(state.teams).forEach(t => {
      const btn = document.createElement('button');
      const mgr = state.managerAssignments[t.id] || t.shortName;
      btn.className = `squad-tab-btn ${t.id === activeId ? 'active' : ''}`;
      btn.onclick = () => {
        state.squadViewingTeamId = t.id;
        renderMySquadView();
      };
      btn.innerHTML = `${t.badge} ${mgr} (${t.shortName}) <span class="paddle-purse-chip">₹${t.purse.toFixed(1)}Cr</span>`;
      tabsContainer.appendChild(btn);
    });
  }

  function renderMySquadView() {
    const viewTeamId = state.squadViewingTeamId || state.userTeamId || Object.keys(state.teams)[0];
    const team = state.teams[viewTeamId];
    if (!team) return;

    renderSquadManagerTabs(viewTeamId);

    const mgr = state.managerAssignments[team.id];
    const mgrTitle = mgr ? `${team.name} — ${mgr}` : `${team.name} Squad`;
    document.getElementById('squadPageTitle').innerText = mgrTitle;
    document.getElementById('squadPageSubtitle').innerText =
      `Franchise Code: ${team.shortName} • Remaining Purse: ₹${team.purse.toFixed(2)} Cr`;

    document.getElementById('squadTotalPlayers').innerText = `${team.squad.length} / ${MAX_SQUAD_SIZE}`;
    document.getElementById('squadOverseasCount').innerText = `${team.overseasCount} / ${MAX_OVERSEAS}`;
    document.getElementById('squadTotalSpent').innerText = `₹${team.spent.toFixed(2)} Cr`;
    document.getElementById('squadPurseLeft').innerText = `₹${team.purse.toFixed(2)} Cr`;

    const squadRating = calculateSquadRating(team.squad);
    document.getElementById('squadOverallRating').innerText = squadRating > 0 ? `${squadRating} / 100` : '-- / 100';

    const gradeTag = document.getElementById('squadGradeTag');
    if (team.squad.length >= MIN_SQUAD_SIZE) {
      gradeTag.innerText = squadRating >= 90 ? '🌟 Championship Contender' : '✅ Match Ready';
      gradeTag.className = 'metric-sub text-emerald';
    } else {
      gradeTag.innerText = `Needs ${MIN_SQUAD_SIZE - team.squad.length} more players to reach min 18`;
      gradeTag.className = 'metric-sub text-rose';
    }

    // Squad Balance Meters
    const meters = calculateSquadBalanceMeters(team.squad);
    document.getElementById('battersCountLabel').innerText = `${meters.batCount} Batters (Avg: ${meters.battingScore})`;
    document.getElementById('barBatting').style.width = `${meters.battingScore}%`;

    document.getElementById('bowlersCountLabel').innerText = `${meters.bowlCount} Bowlers (Avg: ${meters.bowlingScore})`;
    document.getElementById('barBowling').style.width = `${meters.bowlingScore}%`;

    document.getElementById('allRoundersCountLabel').innerText = `${meters.arCount} All-Rounders (Avg: ${meters.arScore})`;
    document.getElementById('barAllRound').style.width = `${meters.arScore}%`;

    document.getElementById('keepersCountLabel').innerText = `${meters.wkCount} Wicketkeepers (Avg: ${meters.wkScore})`;
    document.getElementById('barKeeper').style.width = `${meters.wkScore}%`;

    // Render Players Grid
    const grid = document.getElementById('squadPlayersGrid');
    grid.innerHTML = '';

    if (team.squad.length === 0) {
      grid.innerHTML = `
        <div class="empty-squad-notice">
          <div class="empty-icon">🏏</div>
          <h3>No Players Acquired Yet</h3>
          <p>Head to the live auction room and bid for players to fill your ₹120 Cr roster!</p>
          <button class="btn btn-gold" onclick="window.iplApp.navigateTo('auction')">ENTER AUCTION ROOM</button>
        </div>
      `;
      return;
    }

    team.squad.forEach(p => {
      const card = document.createElement('div');
      card.className = 'squad-player-card';

      card.innerHTML = `
        <div class="squad-card-top">
          <span class="role-badge" style="font-size: 0.72rem; padding: 2px 10px;">${p.role}</span>
          <span class="squad-card-rating">${p.overallRating}</span>
        </div>
        <h4 class="squad-card-name">${p.name}</h4>
        <div class="squad-card-meta">
          <span>${p.isOverseas ? '✈️ ' : '🇮🇳 '}${p.nationality}</span>
          <span>• Ex-${p.originalTeam}</span>
        </div>
        <div class="squad-card-price-row">
          <span style="color: var(--text-dim);">Purchase Price:</span>
          <strong class="text-gold">₹${p.soldPrice.toFixed(2)} Cr</strong>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // =========================================================================
  // VIEW: PLAYER DATABASE & FILTERS
  // =========================================================================

  function populateOriginalTeamFilter() {
    const select = document.getElementById('filterOriginalTeam');
    if (!select) return;

    select.innerHTML = '<option value="all">All Teams</option>';
    const seasonData = window.IPL_SEASONS[state.selectedSeason];
    if (!seasonData) return;

    const uniqueTeams = new Set();
    seasonData.players.forEach(p => {
      if (p.originalTeam) uniqueTeams.add(p.originalTeam);
    });

    uniqueTeams.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.innerText = t;
      select.appendChild(opt);
    });
  }

  function filterPlayersDatabase() {
    const tbody = document.getElementById('playersTableBody');
    if (!tbody) return;

    const seasonData = window.IPL_SEASONS[state.selectedSeason];
    if (!seasonData) return;

    const query = (document.getElementById('playerSearchInput').value || '').toLowerCase().trim();
    const role = document.getElementById('filterRole').value;
    const nationality = document.getElementById('filterNationality').value;
    const price = document.getElementById('filterPrice').value;
    const status = document.getElementById('filterStatus').value;
    const origTeam = document.getElementById('filterOriginalTeam').value;
    const sort = document.getElementById('sortPlayers').value;

    // Build searchable master list
    const allPlayers = seasonData.players.map(p => {
      // Find sold status if any
      const soldItem = state.soldHistory.find(s => s.name === p.name);
      const isUnsold = state.unsoldPool.some(u => u.name === p.name);

      let currentStatus = 'Available';
      let soldPrice = '-';
      let soldTeam = '-';

      if (soldItem) {
        currentStatus = 'Sold';
        soldPrice = `₹${soldItem.soldPrice.toFixed(2)} Cr`;
        soldTeam = soldItem.soldTeam;
      } else if (isUnsold) {
        currentStatus = 'Unsold';
      }

      return {
        ...p,
        currentStatus,
        soldPriceVal: soldItem ? soldItem.soldPrice : 0,
        soldPrice,
        soldTeam
      };
    });

    // Apply filters
    const filtered = allPlayers.filter(p => {
      // Search
      if (query && !p.name.toLowerCase().includes(query)) return false;

      // Role
      if (role !== 'all' && p.role !== role) return false;

      // Nationality
      if (nationality === 'Indian' && p.isOverseas) return false;
      if (nationality === 'Overseas' && !p.isOverseas) return false;

      // Price
      if (price === 'under1' && p.basePrice >= 1.0) return false;
      if (price === '1to5' && (p.basePrice < 1.0 || p.basePrice > 5.0)) return false;
      if (price === '5to10' && (p.basePrice < 5.0 || p.basePrice > 10.0)) return false;
      if (price === 'above10' && p.basePrice < 10.0) return false;

      // Status
      if (status === 'available' && p.currentStatus !== 'Available') return false;
      if (status === 'sold' && p.currentStatus !== 'Sold') return false;
      if (status === 'unsold' && p.currentStatus !== 'Unsold') return false;

      // Original Team
      if (origTeam !== 'all' && p.originalTeam !== origTeam) return false;

      return true;
    });

    // Apply Sorting
    filtered.sort((a, b) => {
      if (sort === 'ratingDesc') return b.overallRating - a.overallRating;
      if (sort === 'priceDesc') return b.basePrice - a.basePrice;
      if (sort === 'priceAsc') return a.basePrice - b.basePrice;
      if (sort === 'nameAsc') return a.name.localeCompare(b.name);
      return 0;
    });

    document.getElementById('playersMatchingCount').innerText = filtered.length;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 30px;">No players match the selected filters.</td></tr>`;
      return;
    }

    filtered.forEach(p => {
      const tr = document.createElement('tr');

      let statusBadgeClass = 'status-available';
      if (p.currentStatus === 'Sold') statusBadgeClass = 'status-sold';
      if (p.currentStatus === 'Unsold') statusBadgeClass = 'status-unsold';

      tr.innerHTML = `
        <td><strong>${p.name}</strong></td>
        <td><span class="role-badge" style="font-size: 0.7rem; padding: 2px 8px;">${p.role}</span></td>
        <td>${p.isOverseas ? '✈️ ' : '🇮🇳 '}${p.nationality}</td>
        <td><strong class="text-emerald" style="font-family: var(--font-board); font-size: 1.1rem;">${p.overallRating}</strong></td>
        <td>₹${p.basePrice.toFixed(2)} Cr</td>
        <td>${p.originalTeam}</td>
        <td><span class="status-badge ${statusBadgeClass}">${p.currentStatus}</span></td>
        <td class="text-gold font-board"><strong>${p.soldPrice}</strong></td>
        <td><strong>${p.soldTeam}</strong></td>
      `;

      tbody.appendChild(tr);
    });
  }

  // =========================================================================
  // VIEW: ALL TEAMS DIRECTORY
  // =========================================================================

  function renderAllTeamsView() {
    const grid = document.getElementById('allTeamsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const teams = Object.values(state.teams);
    teams.forEach(t => {
      const isUser = t.id === state.userTeamId;
      const card = document.createElement('div');
      card.className = `team-dashboard-card ${isUser ? 'user-team' : ''}`;
      card.onclick = () => openTeamSquadModal(t.id);

      card.innerHTML = `
        <div class="team-card-header">
          <div class="team-badge-large">${t.badge}</div>
          <div class="team-info-group">
            <h3>${t.name}</h3>
            <span class="team-city-tag">${t.city} • Code: <strong>${t.shortName}</strong> ${isUser ? '⭐ MY TEAM' : ''}</span>
          </div>
        </div>
        <div class="team-stats-box" style="grid-template-columns: repeat(3, 1fr);">
          <div class="team-stat-cell">
            <span>PURSE</span>
            <strong class="text-gold">₹${t.purse.toFixed(2)} Cr</strong>
          </div>
          <div class="team-stat-cell">
            <span>SPENT</span>
            <strong>₹${t.spent.toFixed(2)} Cr</strong>
          </div>
          <div class="team-stat-cell">
            <span>SQUAD</span>
            <strong>${t.squad.length} / 25</strong>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--border-subtle); font-size: 0.85rem;">
          <span>Squad Rating: <strong class="text-emerald">${t.rating || '--'}</strong></span>
          <span class="text-cyan">Inspect Squad →</span>
        </div>
      `;

      grid.appendChild(card);
    });
  }

  // =========================================================================
  // VIEW: STATISTICS & ANALYTICS
  // =========================================================================

  function renderStatisticsView() {
    const totalPlayers = state.auctionPool.length + state.soldHistory.length + state.unsoldPool.length;
    const auctionedCount = state.soldHistory.length + state.unsoldPool.length;
    const soldCount = state.soldHistory.length;
    const unsoldCount = state.unsoldPool.length;
    const remainingCount = Math.max(0, totalPlayers - auctionedCount);

    document.getElementById('statAuctionedCount').innerText = auctionedCount;
    document.getElementById('statRemainingCount').innerText = `${remainingCount} Remaining`;
    document.getElementById('statSoldCount').innerText = soldCount;

    const soldPct = auctionedCount > 0 ? Math.round((soldCount / auctionedCount) * 100) : 0;
    document.getElementById('statSoldPct').innerText = `${soldPct}% Sold Rate`;
    document.getElementById('statUnsoldCount').innerText = unsoldCount;

    document.getElementById('statTotalSpent').innerText = `₹${state.totalSpent.toFixed(2)} Cr`;

    const avgPrice = soldCount > 0 ? (state.totalSpent / soldCount) : 0;
    document.getElementById('statAvgPrice').innerText = `₹${avgPrice.toFixed(2)} Cr`;

    // Total Remaining Purse across all teams
    let totalPurseRemaining = 0;
    Object.values(state.teams).forEach(t => { totalPurseRemaining += t.purse; });
    document.getElementById('statTotalRemainingPurse').innerText = `₹${totalPurseRemaining.toFixed(2)} Cr`;

    // Highest Bid Spotlight
    if (state.highestSale && state.highestSale.amount > 0) {
      document.getElementById('highestBidPlayerName').innerText = state.highestSale.player;
      document.getElementById('highestBidPlayerTeam').innerText = `Acquired by ${state.highestSale.team}`;
      document.getElementById('highestBidAmount').innerText = `₹${state.highestSale.amount.toFixed(2)} Cr`;
    } else {
      document.getElementById('highestBidPlayerName').innerText = 'No Sales Yet';
      document.getElementById('highestBidPlayerTeam').innerText = 'Waiting for auction bids';
      document.getElementById('highestBidAmount').innerText = '₹0.00 Cr';
    }

    // Top 5 Buys Leaderboard
    const topBuysBody = document.getElementById('topBuysTableBody');
    topBuysBody.innerHTML = '';

    const sortedBuys = [...state.soldHistory].sort((a, b) => b.soldPrice - a.soldPrice).slice(0, 5);

    if (sortedBuys.length === 0) {
      topBuysBody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 24px;">No players sold yet.</td></tr>`;
      return;
    }

    sortedBuys.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong class="text-gold">#${idx + 1}</strong></td>
        <td><strong>${p.name}</strong></td>
        <td><span class="role-badge" style="font-size: 0.7rem; padding: 2px 8px;">${p.role}</span></td>
        <td><strong>${p.soldTeam}</strong></td>
        <td class="text-gold font-board"><strong>₹${p.soldPrice.toFixed(2)} Cr</strong></td>
        <td><strong class="text-emerald">${p.overallRating}</strong></td>
      `;
      topBuysBody.appendChild(tr);
    });
  }

  // =========================================================================
  // VIEW: IPL HISTORY TIMELINE (2008 - 2026)
  // =========================================================================

  function renderHistoryTimeline() {
    const container = document.getElementById('historyTimeline');
    if (!container) return;
    container.innerHTML = '';

    const seasons = window.IPL_SEASONS || {};
    const years = Object.keys(seasons).map(Number).sort((a, b) => b - a);

    years.forEach(year => {
      const s = seasons[year];
      if (!s) return;

      const entry = document.createElement('div');
      entry.className = 'timeline-entry';

      entry.innerHTML = `
        <div class="timeline-year-pin">${year}</div>
        <div class="timeline-content-card">
          <div class="timeline-header">
            <h3>${s.title}</h3>
            <span class="season-champ-pill">🏆 ${s.champions}</span>
          </div>
          <p class="timeline-desc">${s.description}</p>
          <div class="timeline-footer">
            <span style="font-size: 0.85rem; color: var(--text-muted);">
              ${s.teams.length} Franchises • ${s.players.length} Verified Star Players
            </span>
            <button class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.82rem;" onclick="window.iplApp.launchSeasonFromHistory(${year})">
              PLAY SEASON ${year} →
            </button>
          </div>
        </div>
      `;

      container.appendChild(entry);
    });
  }

  function launchSeasonFromHistory(year) {
    selectSeasonCard(year);
    confirmSeasonAndProceed();
  }

  // =========================================================================
  // VIEW: FINAL RESULTS & AUCTION WINNER
  // =========================================================================

  function calculateTeamRanking() {
    const teams = Object.values(state.teams);

    // Scoring formula:
    // Score = SquadRating (weighted 60%) + BalanceScore (25%) + PurseEfficiency (15%)
    // Penalty if squad < 18 (-15 pts)
    const ranked = teams.map(t => {
      const squadRating = calculateSquadRating(t.squad);
      const balance = calculateSquadBalanceMeters(t.squad);

      let balanceScore = 0;
      if (balance.batCount >= 5) balanceScore += 25;
      if (balance.bowlCount >= 5) balanceScore += 25;
      if (balance.arCount >= 2) balanceScore += 25;
      if (balance.wkCount >= 1) balanceScore += 25;

      // Purse efficiency: Having utilized purse reasonably without overspending early
      const spentPct = (t.spent / STARTING_PURSE) * 100;
      const purseScore = Math.min(100, spentPct * 1.1);

      let finalScore = (squadRating * 0.6) + (balanceScore * 0.25) + (purseScore * 0.15);

      if (t.squad.length < MIN_SQUAD_SIZE) {
        finalScore -= 20; // incomplete squad penalty
      }

      return {
        ...t,
        squadRating,
        finalScore: Math.round(finalScore)
      };
    });

    ranked.sort((a, b) => b.finalScore - a.finalScore);
    return ranked;
  }

  function renderResultsView() {
    const rankings = calculateTeamRanking();
    if (rankings.length === 0) return;

    const winner = rankings[0];

    // Winner Banner
    const winMgr = state.managerAssignments[winner.id];
    const winMgrTag = winMgr ? ` — Manager: ${winMgr}` : '';
    document.getElementById('winnerBadge').innerText = winner.badge;
    document.getElementById('winnerTeamName').innerText = `${winner.name} (${winner.shortName})${winMgrTag}`;
    document.getElementById('winnerRating').innerText = `${winner.squadRating} / 100`;
    document.getElementById('winnerSpent').innerText = `₹${winner.spent.toFixed(2)} Cr`;
    document.getElementById('winnerPurse').innerText = `₹${winner.purse.toFixed(2)} Cr`;
    document.getElementById('winnerSquadCount').innerText = `${winner.squad.length} Players`;

    // User Team Stats
    const userTeam = state.teams[state.userTeamId];
    if (userTeam) {
      const userRank = rankings.findIndex(r => r.id === state.userTeamId) + 1;
      const userMgr = state.managerAssignments[userTeam.id];
      const userTitle = userMgr ? `${userTeam.name} (${userMgr})` : userTeam.name;
      document.getElementById('resultMyTeamName').innerText = `${userTeam.badge} ${userTitle}`;
      document.getElementById('resultMySquadCount').innerText = userTeam.squad.length;
      document.getElementById('resultMyTotalSpent').innerText = `₹${userTeam.spent.toFixed(2)} Cr`;
      document.getElementById('resultMyPurseLeft').innerText = `₹${userTeam.purse.toFixed(2)} Cr`;
      document.getElementById('resultMyRating').innerText = `${calculateSquadRating(userTeam.squad)} / 100`;
      document.getElementById('resultMyRank').innerText = `#${userRank} of ${rankings.length}`;
    }

    // Rankings Table
    const tbody = document.getElementById('finalRankingsTableBody');
    tbody.innerHTML = '';

    rankings.forEach((t, idx) => {
      const isUser = t.id === state.userTeamId;
      const mgr = state.managerAssignments[t.id];
      const mgrTag = mgr ? `<span class="gold-badge" style="margin-left: 6px;">${mgr}</span>` : '';
      const tr = document.createElement('tr');
      if (isUser && state.playMode === 'solo') tr.style.background = 'rgba(245, 158, 11, 0.08)';

      let medal = `#${idx + 1}`;
      if (idx === 0) medal = '🥇 #1';
      if (idx === 1) medal = '🥈 #2';
      if (idx === 2) medal = '🥉 #3';

      let statusMsg = 'Complete Squad';
      if (t.squad.length < MIN_SQUAD_SIZE) {
        statusMsg = `<span class="text-rose">Under Min Squad (${t.squad.length}/18)</span>`;
      } else {
        statusMsg = '<span class="text-emerald">Championship Eligible</span>';
      }

      tr.innerHTML = `
        <td><strong class="text-gold font-board" style="font-size: 1.1rem;">${medal}</strong></td>
        <td>
          <strong>${t.badge} ${t.name} (${t.shortName})</strong>
          ${mgrTag}
          ${isUser && state.playMode === 'solo' ? '<strong class="text-gold" style="font-size: 0.8rem; margin-left: 6px;">[MY TEAM]</strong>' : ''}
        </td>
        <td><strong class="text-emerald font-board" style="font-size: 1.1rem;">${t.squadRating} / 100</strong></td>
        <td><strong>${t.squad.length} / 25</strong></td>
        <td class="text-gold font-board">₹${t.spent.toFixed(2)} Cr</td>
        <td>₹${t.purse.toFixed(2)} Cr</td>
        <td>${statusMsg}</td>
      `;

      tbody.appendChild(tr);
    });

    if (window.auctionSounds) window.auctionSounds.playFanfare();
  }

  // =========================================================================
  // LOGS & ACTIVITY FEED
  // =========================================================================

  function logAuctionEvent(text, color = '#38bdf8') {
    const feed = document.getElementById('bidHistoryFeed');
    if (!feed) return;

    // Remove placeholder
    const placeholder = feed.querySelector('.placeholder-entry');
    if (placeholder) placeholder.remove();

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0]; // "10:42:15"

    const entry = document.createElement('div');
    entry.className = 'feed-entry';

    entry.innerHTML = `
      <span class="feed-time">${timeStr}</span>
      <span class="feed-text" style="color: ${color};">${text}</span>
    `;

    feed.prepend(entry);

    // Keep max 50 entries
    while (feed.children.length > 50) {
      feed.removeChild(feed.lastChild);
    }
  }

  // =========================================================================
  // SPEED, PAUSE & CONTROLS
  // =========================================================================

  function setAuctionSpeed(multiplier) {
    state.speedMultiplier = multiplier;
    document.getElementById('speed1x').classList.toggle('active', multiplier === 1);
    document.getElementById('speed2x').classList.toggle('active', multiplier === 2);
    showToast(`Auction Pace set to ${multiplier}x`, 'info');
  }

  function togglePauseAuction() {
    state.isPaused = !state.isPaused;
    const btn = document.getElementById('btnPauseAuction');
    if (state.isPaused) {
      btn.innerText = '▶ Resume';
      btn.classList.add('btn-warning');
      setStatusMessage('AUCTION PAUSED ⏸');
      showToast('Auction paused', 'info');
    } else {
      btn.innerText = '⏸ Pause';
      btn.classList.remove('btn-warning');
      setStatusMessage('BIDDING ACTIVE 🔨');
      showToast('Auction resumed', 'info');
    }
  }

  function toggleSound() {
    if (!window.auctionSounds) return;
    const enabled = window.auctionSounds.toggle();
    const icon = document.getElementById('soundIcon');
    const text = document.querySelector('#soundToggleBtn .btn-text');

    if (enabled) {
      icon.innerText = '🔊';
      text.innerText = 'Sound ON';
      showToast('Audio effects enabled', 'info');
    } else {
      icon.innerText = '🔇';
      text.innerText = 'Sound OFF';
      showToast('Audio effects muted', 'info');
    }
  }

  // =========================================================================
  // MODALS & INSPECTORS
  // =========================================================================

  function openTeamSquadModal(teamId) {
    const team = state.teams[teamId];
    if (!team) return;

    const modal = document.getElementById('teamSquadModal');
    document.getElementById('modalTeamBadge').innerText = team.badge;
    document.getElementById('modalTeamName').innerText = `${team.name} (${team.shortName})`;
    document.getElementById('modalTeamSubtitle').innerText =
      `Purse: ₹${team.purse.toFixed(2)} Cr | Spent: ₹${team.spent.toFixed(2)} Cr | Squad: ${team.squad.length}/25 | Overseas: ${team.overseasCount}/8`;

    const body = document.getElementById('modalTeamSquadBody');
    body.innerHTML = '';

    if (team.squad.length === 0) {
      body.innerHTML = `<p style="text-align: center; padding: 30px;">No players acquired yet by ${team.name}.</p>`;
    } else {
      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'players-table-wrapper';
      tableWrapper.innerHTML = `
        <table class="players-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Role</th>
              <th>Nationality</th>
              <th>Rating</th>
              <th>Winning Bid</th>
            </tr>
          </thead>
          <tbody>
            ${team.squad.map(p => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td><span class="role-badge" style="font-size: 0.7rem; padding: 2px 8px;">${p.role}</span></td>
                <td>${p.isOverseas ? '✈️ ' : '🇮🇳 '}${p.nationality}</td>
                <td><strong class="text-emerald">${p.overallRating}</strong></td>
                <td class="text-gold font-board"><strong>₹${p.soldPrice.toFixed(2)} Cr</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      body.appendChild(tableWrapper);
    }

    modal.style.display = 'flex';
  }

  function closeTeamSquadModal() {
    const modal = document.getElementById('teamSquadModal');
    if (modal) modal.style.display = 'none';
  }

  function promptReset() {
    const modal = document.getElementById('resetModal');
    if (modal) modal.style.display = 'flex';
  }

  function closeResetModal() {
    const modal = document.getElementById('resetModal');
    if (modal) modal.style.display = 'none';
  }

  function confirmReset() {
    resetAuction();
    closeResetModal();
  }

  function resetAuction() {
    localStorage.removeItem(STORAGE_KEY);
    clearTimeout(state.aiTimeout);
    clearInterval(state.timerInterval);

    state.userTeamId = null;
    state.currentBid = 0;
    state.highestBidderId = null;
    state.isBiddingActive = false;
    state.roundCompleted = false;

    // Reload active season data fresh
    loadSeason(state.selectedSeason);

    // Hide Header Purse
    document.getElementById('headerPursePill').style.display = 'none';
    document.getElementById('homeResumeBanner').style.display = 'none';

    navigateTo('seasons');
    showToast('Auction reset successfully!', 'info');
  }

  // =========================================================================
  // LOCAL STORAGE PERSISTENCE
  // =========================================================================

  function saveGame() {
    if (!state.userTeamId) return;

    try {
      const snapshot = {
        selectedSeason: state.selectedSeason,
        userTeamId: state.userTeamId,
        playMode: state.playMode,
        activeBiddingTeamId: state.activeBiddingTeamId,
        managerAssignments: state.managerAssignments,
        teams: state.teams,
        auctionPool: state.auctionPool,
        currentPlayerIndex: state.currentPlayerIndex,
        unsoldPool: state.unsoldPool,
        soldHistory: state.soldHistory,
        highestSale: state.highestSale,
        totalSpent: state.totalSpent,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw);
      if (!data || !data.selectedSeason || !data.userTeamId) return false;

      state.selectedSeason = data.selectedSeason;
      state.userTeamId = data.userTeamId;
      state.playMode = data.playMode || 'solo';
      state.activeBiddingTeamId = data.activeBiddingTeamId || data.userTeamId;
      state.managerAssignments = data.managerAssignments || { ...DEFAULT_10_FRIENDS };
      state.teams = data.teams;
      state.auctionPool = data.auctionPool;
      state.currentPlayerIndex = data.currentPlayerIndex;
      state.unsoldPool = data.unsoldPool;
      state.soldHistory = data.soldHistory;
      state.highestSale = data.highestSale || { player: null, amount: 0, team: null };
      state.totalSpent = data.totalSpent || 0;

      // Update Season Header
      document.getElementById('currentSeasonBadge').style.display = 'flex';
      document.getElementById('badgeSeasonText').innerText = `IPL ${state.selectedSeason}`;

      updatePurseHeader();
      updateUserTeamSummaryCard();
      updateTeamsPurseList();
      populateOriginalTeamFilter();

      return true;
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
      return false;
    }
  }

  function updateHomeResumeBanner() {
    const banner = document.getElementById('homeResumeBanner');
    if (!banner || !state.userTeamId) return;

    const team = state.teams[state.userTeamId];
    if (!team) return;

    banner.style.display = 'flex';
    document.getElementById('resumeTitle').innerText =
      `Resume IPL ${state.selectedSeason} Auction as ${team.name}`;
    document.getElementById('resumeSubtitle').innerText =
      `Purse: ₹${team.purse.toFixed(2)} Cr | Players Bought: ${team.squad.length} | Season: ${state.selectedSeason}`;
  }

  function resumeSavedGame() {
    initializeAuction();
    navigateTo('auction');
    showToast('Auction session resumed!', 'gold');
  }

  function startNewOrGoToSeasons() {
    navigateTo('seasons');
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  function getInitials(name) {
    if (!name) return 'PL';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function start10Friends2021Mode() {
    startAuctionFlow('party');
  }

  // =========================================================================
  // PUBLIC API EXPOSURE TO WINDOW
  // =========================================================================

  window.iplApp = {
    navigateTo,
    selectSeasonCard,
    filterSeasonCards,
    confirmSeasonAndProceed,
    selectUserTeam,
    confirmTeamAndStartAuction,
    userPlaceBid,
    userPassPlayer,
    nextPlayerManual,
    startUnsoldRound,
    finishAuctionAndShowResults,
    setAuctionSpeed,
    togglePauseAuction,
    toggleSound,
    openTeamSquadModal,
    closeTeamSquadModal,
    promptReset,
    closeResetModal,
    confirmReset,
    resetAuction,
    resumeSavedGame,
    startNewOrGoToSeasons,
    filterPlayersDatabase,
    launchSeasonFromHistory,
    startAuctionFlow,
    confirmFriendsAndStart,
    start10Friends2021Mode,
    setPlayMode,
    updateManagerName,
    confirm10FriendsAndStart,
    selectActiveBiddingTeam
  };

  // Launch on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
