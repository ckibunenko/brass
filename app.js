const PLAYERS = ["Sveta", "Aca", "Peca", "Bucki"];
const POINTS_BY_PLACE = [4, 3, 2, 1];
const PLACE_KEYS = ["first", "second", "third", "fourth"];

const STORAGE_KEY_MATCHES = "brass_league_matches_v1";
const OWNER_PIN = "brass-2026";

const state = {
  matches: [],
  isEntryUnlocked: false
};

const form = document.getElementById("match-form");
const dateInput = document.getElementById("match-date");
const errorNode = document.getElementById("form-error");
const accessErrorNode = document.getElementById("access-error");
const historyBody = document.getElementById("match-history-body");
const allTimeBody = document.getElementById("all-time-body");
const rankingCards = document.getElementById("ranking-cards");

const summaryTotalMatches = document.getElementById("summary-total-matches");
const summaryLeader = document.getElementById("summary-leader");
const summaryTopPoints = document.getElementById("summary-top-points");
const summaryBestAverage = document.getElementById("summary-best-average");

const entryLockStatus = document.getElementById("entry-lock-status");
const editorPinInput = document.getElementById("editor-pin");
const unlockEntryButton = document.getElementById("unlock-entry");
const lockEntryButton = document.getElementById("lock-entry");

const selectByPlace = {
  first: document.getElementById("first-place"),
  second: document.getElementById("second-place"),
  third: document.getElementById("third-place"),
  fourth: document.getElementById("fourth-place")
};

initialize();

function initialize() {
  state.matches = loadMatchesFromStorage();
  setDefaultDate();
  populatePlayerOptions();
  wireAccessControls();
  wireForm();
  applyEntryLock();
  renderAll();
}

function setDefaultDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  dateInput.value = local;
}

function populatePlayerOptions() {
  PLACE_KEYS.forEach((placeKey) => {
    const select = selectByPlace[placeKey];
    const title = placeKey[0].toUpperCase() + placeKey.slice(1);

    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = `Select ${title} Place`;
    placeholder.selected = true;
    placeholder.disabled = false;
    select.appendChild(placeholder);

    PLAYERS.forEach((player) => {
      const option = document.createElement("option");
      option.value = player;
      option.textContent = player;
      select.appendChild(option);
    });

    select.addEventListener("change", syncPlayerAvailability);
  });

  syncPlayerAvailability();
}

function wireAccessControls() {
  unlockEntryButton.addEventListener("click", () => {
    accessErrorNode.textContent = "";
    errorNode.textContent = "";

    const enteredPin = editorPinInput.value.trim();
    if (!enteredPin) {
      accessErrorNode.textContent = "Enter owner PIN to unlock match entry.";
      return;
    }

    if (enteredPin !== OWNER_PIN) {
      accessErrorNode.textContent = "Wrong PIN. Entry remains locked.";
      return;
    }

    state.isEntryUnlocked = true;
    editorPinInput.value = "";
    applyEntryLock();
  });

  lockEntryButton.addEventListener("click", () => {
    state.isEntryUnlocked = false;
    editorPinInput.value = "";
    accessErrorNode.textContent = "";
    applyEntryLock();
  });

  editorPinInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      unlockEntryButton.click();
    }
  });
}

function applyEntryLock() {
  const isUnlocked = state.isEntryUnlocked;
  const submitButton = form.querySelector('button[type="submit"]');
  const controls = [
    dateInput,
    selectByPlace.first,
    selectByPlace.second,
    selectByPlace.third,
    selectByPlace.fourth,
    submitButton
  ];

  controls.forEach((control) => {
    control.disabled = !isUnlocked;
  });

  entryLockStatus.textContent = isUnlocked ? "Unlocked (Owner)" : "Locked";
}

function wireForm() {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    errorNode.textContent = "";

    if (!state.isEntryUnlocked) {
      errorNode.textContent = "Entry is locked. Unlock with owner PIN first.";
      return;
    }

    const newMatch = {
      date: dateInput.value,
      first: selectByPlace.first.value,
      second: selectByPlace.second.value,
      third: selectByPlace.third.value,
      fourth: selectByPlace.fourth.value
    };

    const validationMessage = validateMatch(newMatch);
    if (validationMessage) {
      errorNode.textContent = validationMessage;
      return;
    }

    state.matches.push(newMatch);
    saveMatchesToStorage(state.matches);
    renderAll();

    resetFormAfterSubmit();
  });
}

function resetFormAfterSubmit() {
  form.reset();
  setDefaultDate();
  syncPlayerAvailability();
}

function validateMatch(match) {
  if (!match.date || !match.first || !match.second || !match.third || !match.fourth) {
    return "Please fill in date and all 4 placement slots.";
  }

  const picks = [match.first, match.second, match.third, match.fourth];
  if (new Set(picks).size !== PLAYERS.length) {
    return "Each player must appear exactly once in every match.";
  }

  return "";
}

function syncPlayerAvailability() {
  const currentSelections = PLACE_KEYS.map((placeKey) => selectByPlace[placeKey].value);

  PLACE_KEYS.forEach((placeKey, index) => {
    const select = selectByPlace[placeKey];
    const usedByOtherPlaces = new Set(
      currentSelections.filter((value, valueIndex) => value && valueIndex !== index)
    );

    Array.from(select.options).forEach((option) => {
      if (!option.value) {
        return;
      }

      option.disabled = usedByOtherPlaces.has(option.value);
    });
  });
}

function renderAll() {
  const standings = calculateStandings(state.matches);

  renderMatchHistory(state.matches);
  renderAllTimeTable(standings);
  renderSummary(standings, state.matches.length);
  renderRankingCards(standings);
}

function createEmptyPlayerTotals() {
  const totals = {};

  PLAYERS.forEach((playerName) => {
    totals[playerName] = {
      player: playerName,
      totalPoints: 0,
      wins: 0,
      secondPlaces: 0,
      thirdPlaces: 0,
      fourthPlaces: 0,
      gamesPlayed: 0,
      placementSum: 0,
      averagePlacement: 0
    };
  });

  return totals;
}

function calculateStandings(matches) {
  const totals = createEmptyPlayerTotals();

  matches.forEach((match) => {
    const order = [match.first, match.second, match.third, match.fourth];

    order.forEach((playerName, index) => {
      const playerStats = totals[playerName];
      playerStats.totalPoints += POINTS_BY_PLACE[index];
      playerStats.gamesPlayed += 1;
      playerStats.placementSum += index + 1;

      if (index === 0) {
        playerStats.wins += 1;
      }
      if (index === 1) {
        playerStats.secondPlaces += 1;
      }
      if (index === 2) {
        playerStats.thirdPlaces += 1;
      }
      if (index === 3) {
        playerStats.fourthPlaces += 1;
      }
    });
  });

  const ranking = PLAYERS.map((playerName) => {
    const stats = totals[playerName];

    return {
      ...stats,
      averagePlacement:
        stats.gamesPlayed > 0 ? Number((stats.placementSum / stats.gamesPlayed).toFixed(2)) : 0
    };
  }).sort((a, b) => {
    return (
      b.totalPoints - a.totalPoints ||
      b.wins - a.wins ||
      b.secondPlaces - a.secondPlaces ||
      b.thirdPlaces - a.thirdPlaces ||
      a.fourthPlaces - b.fourthPlaces ||
      a.player.localeCompare(b.player)
    );
  });

  ranking.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return ranking;
}

function renderMatchHistory(matches) {
  historyBody.innerHTML = "";

  if (matches.length === 0) {
    historyBody.appendChild(createEmptyRow(5, "No matches entered yet."));
    return;
  }

  const rows = [...matches].reverse();

  rows.forEach((match) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatDate(match.date)}</td>
      <td>${placePill(match.first, "first")}</td>
      <td>${placePill(match.second, "second")}</td>
      <td>${placePill(match.third, "third")}</td>
      <td>${placePill(match.fourth, "fourth")}</td>
    `;
    historyBody.appendChild(row);
  });
}

function renderAllTimeTable(standings) {
  allTimeBody.innerHTML = "";

  standings.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.rank}</td>
      <td>${entry.player}</td>
      <td>${entry.totalPoints}</td>
      <td>${entry.wins}</td>
      <td>${entry.secondPlaces}</td>
      <td>${entry.thirdPlaces}</td>
      <td>${entry.fourthPlaces}</td>
      <td>${entry.gamesPlayed}</td>
      <td>${entry.averagePlacement.toFixed(2)}</td>
    `;
    allTimeBody.appendChild(row);
  });
}

function renderSummary(standings, matchCount) {
  summaryTotalMatches.textContent = String(matchCount);

  if (matchCount === 0) {
    summaryLeader.textContent = "-";
    summaryTopPoints.textContent = "0";
    summaryBestAverage.textContent = "-";
    return;
  }

  const leader = standings[0];
  const played = standings.filter((item) => item.gamesPlayed > 0);
  const bestAverage = Math.min(...played.map((item) => item.averagePlacement));

  summaryLeader.textContent = leader.player;
  summaryTopPoints.textContent = String(leader.totalPoints);
  summaryBestAverage.textContent = bestAverage.toFixed(2);
}

function renderRankingCards(standings) {
  rankingCards.innerHTML = "";

  standings.forEach((entry) => {
    const card = document.createElement("article");
    card.className = `ranking-card podium-${entry.rank}`;

    card.innerHTML = `
      <header>
        <h3>${entry.player}</h3>
        <span class="rank-chip">#${entry.rank}</span>
      </header>
      <dl>
        <dt>Total Points</dt><dd>${entry.totalPoints}</dd>
        <dt>Wins</dt><dd>${entry.wins}</dd>
        <dt>Games Played</dt><dd>${entry.gamesPlayed}</dd>
        <dt>Average Place</dt><dd>${entry.averagePlacement.toFixed(2)}</dd>
      </dl>
    `;

    rankingCards.appendChild(card);
  });
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function createEmptyRow(columnSpan, text) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = columnSpan;
  cell.textContent = text;
  cell.className = "empty-row";
  row.appendChild(cell);

  return row;
}

function placePill(name, place) {
  return `<span class="place-pill place-${place}">${name}</span>`;
}

function loadMatchesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MATCHES);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isStoredMatchValid);
  } catch (error) {
    return [];
  }
}

function saveMatchesToStorage(matches) {
  try {
    localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(matches));
  } catch (error) {
    errorNode.textContent = "Could not save to browser storage.";
  }
}

function isStoredMatchValid(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }

  if (typeof candidate.date !== "string" || candidate.date.length === 0) {
    return false;
  }

  const picks = [candidate.first, candidate.second, candidate.third, candidate.fourth];
  if (new Set(picks).size !== PLAYERS.length) {
    return false;
  }

  return picks.every((name) => PLAYERS.includes(name));
}
