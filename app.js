const PLAYERS = ["Sveta", "Aca", "Peca", "Bucki"];
const POINTS_BY_PLACE = [4, 3, 2, 1];
const PLACE_KEYS = ["first", "second", "third", "fourth"];

const STORAGE_KEY_MATCHES = "brass_league_matches_v1";
const OWNER_EMAIL = "aleksandar.parabucki@gmail.com";

// Replace with your Supabase project values.
const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const state = {
  matches: [],
  isEntryUnlocked: false,
  isCloudMode: false,
  session: null,
  supabase: null
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
const ownerEmailNode = document.getElementById("owner-email");
const sendLoginLinkButton = document.getElementById("send-login-link");
const refreshSessionButton = document.getElementById("refresh-session");
const signOutButton = document.getElementById("sign-out");

const selectByPlace = {
  first: document.getElementById("first-place"),
  second: document.getElementById("second-place"),
  third: document.getElementById("third-place"),
  fourth: document.getElementById("fourth-place")
};

initialize().catch(() => {
  accessErrorNode.textContent = "Initialization failed. Please refresh the page.";
});

async function initialize() {
  ownerEmailNode.textContent = OWNER_EMAIL;
  setDefaultDate();
  populatePlayerOptions();
  wireAccessControls();
  wireForm();

  if (canUseCloudMode()) {
    await initializeCloudMode();
  } else {
    initializeLocalMode();
  }

  applyEntryLock();
  renderAll();
}

function canUseCloudMode() {
  const looksConfigured =
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("YOUR_PROJECT_REF") &&
    !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY");

  return typeof window.supabase !== "undefined" && looksConfigured;
}

async function initializeCloudMode() {
  const { createClient } = window.supabase;

  state.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  state.isCloudMode = true;

  state.supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    applyAccessFromAuthSession();
  });

  const {
    data: { session }
  } = await state.supabase.auth.getSession();

  state.session = session;
  applyAccessFromAuthSession();

  const remoteMatches = await fetchMatchesFromCloud();
  if (remoteMatches) {
    state.matches = remoteMatches;
  }
}

function initializeLocalMode() {
  state.isCloudMode = false;
  state.matches = loadMatchesFromStorage();
  state.isEntryUnlocked = true;

  sendLoginLinkButton.disabled = true;
  refreshSessionButton.disabled = true;
  signOutButton.disabled = true;

  entryLockStatus.textContent = "Local Mode (Not Shared)";
  accessErrorNode.textContent =
    "Supabase is not configured yet. Data is local to this browser only.";
}

function applyAccessFromAuthSession() {
  if (!state.isCloudMode) {
    return;
  }

  const currentEmail = state.session?.user?.email?.toLowerCase() || "";
  const isOwner = currentEmail === OWNER_EMAIL.toLowerCase();

  state.isEntryUnlocked = isOwner;

  if (isOwner) {
    entryLockStatus.textContent = "Owner Authenticated";
    accessErrorNode.textContent = "";
  } else if (currentEmail) {
    entryLockStatus.textContent = `View-Only (${currentEmail})`;
    accessErrorNode.textContent = "Only owner account can enter matches.";
  } else {
    entryLockStatus.textContent = "View-Only (Owner login required)";
    accessErrorNode.textContent = "Send login link to owner email to unlock match entry.";
  }

  applyEntryLock();
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
  sendLoginLinkButton.addEventListener("click", async () => {
    accessErrorNode.textContent = "";

    if (!state.isCloudMode) {
      accessErrorNode.textContent =
        "Cloud sync disabled. Set SUPABASE_URL and SUPABASE_ANON_KEY in app.js.";
      return;
    }

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await state.supabase.auth.signInWithOtp({
      email: OWNER_EMAIL,
      options: { emailRedirectTo: redirectTo }
    });

    if (error) {
      accessErrorNode.textContent = `Could not send login link: ${error.message}`;
      return;
    }

    accessErrorNode.textContent = `Login link sent to ${OWNER_EMAIL}.`;
  });

  refreshSessionButton.addEventListener("click", async () => {
    if (!state.isCloudMode) {
      return;
    }

    const {
      data: { session }
    } = await state.supabase.auth.getSession();

    state.session = session;
    applyAccessFromAuthSession();

    const remoteMatches = await fetchMatchesFromCloud();
    if (remoteMatches) {
      state.matches = remoteMatches;
      renderAll();
    }
  });

  signOutButton.addEventListener("click", async () => {
    if (!state.isCloudMode) {
      return;
    }

    await state.supabase.auth.signOut();
    state.session = null;
    applyAccessFromAuthSession();
  });
}

function applyEntryLock() {
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
    control.disabled = !state.isEntryUnlocked;
  });
}

function wireForm() {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorNode.textContent = "";

    if (!state.isEntryUnlocked) {
      errorNode.textContent = "Entry is locked for this account.";
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

    const saveOk = await saveMatch(newMatch);
    if (!saveOk) {
      return;
    }

    renderAll();
    resetFormAfterSubmit();
  });
}

async function saveMatch(newMatch) {
  if (state.isCloudMode) {
    const insertPayload = {
      match_date: newMatch.date,
      first_place: newMatch.first,
      second_place: newMatch.second,
      third_place: newMatch.third,
      fourth_place: newMatch.fourth
    };

    const { error } = await state.supabase.from("matches").insert(insertPayload);

    if (error) {
      errorNode.textContent = `Could not save match: ${error.message}`;
      return false;
    }

    const refreshedMatches = await fetchMatchesFromCloud();
    if (!refreshedMatches) {
      return false;
    }

    state.matches = refreshedMatches;
    return true;
  }

  state.matches.push(newMatch);
  saveMatchesToStorage(state.matches);
  return true;
}

async function fetchMatchesFromCloud() {
  const { data, error } = await state.supabase
    .from("matches")
    .select("match_date, first_place, second_place, third_place, fourth_place, created_at")
    .order("match_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    accessErrorNode.textContent = `Could not load cloud data: ${error.message}`;
    return null;
  }

  return data.map((row) => ({
    date: row.match_date,
    first: row.first_place,
    second: row.second_place,
    third: row.third_place,
    fourth: row.fourth_place
  }));
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
  } catch {
    return [];
  }
}

function saveMatchesToStorage(matches) {
  try {
    localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(matches));
  } catch {
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
