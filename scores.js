// Top sports events — mirrors ESPN.com's front-page "Top Events" rail rather
// than every league's full slate (that rail is a hand-curated, ever-changing
// subset with no public API). We approximate it with the handful of leagues
// ESPN's rail is actually featuring right now. Each sport gets its own titled
// panel with a dropdown to pick among that sport's games happening today, and
// a Box Score link when ESPN's API provides one (i.e. once the game has
// actually started).
(function () {
  "use strict";

  const LEAGUES = [
    { path: "soccer/fifa.world", label: "World Cup" },
    { path: "baseball/mlb", label: "MLB" },
    { path: "basketball/wnba", label: "WNBA" },
    { path: "basketball/nba-summer-las-vegas", label: "NBA Summer League" },
  ];

  const REFRESH_MS = 60000;
  const inner = document.getElementById("scoresPanelInner");
  if (!inner) return;

  function formatStatus(event) {
    const status = event.status || {};
    const type = status.type || {};
    if (type.state === "in") return type.shortDetail || "Live";
    if (type.state === "post") return "Final";
    const date = new Date(event.date);
    return date.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  }

  function findBoxscoreLink(event) {
    const links = event.links || [];
    const match = links.find((l) => Array.isArray(l.rel) && l.rel.includes("boxscore"));
    return match ? match.href : null;
  }

  function describeEvent(event) {
    const competition = (event.competitions && event.competitions[0]) || {};
    const competitors = competition.competitors || [];
    const home = competitors.find((c) => c.homeAway === "home") || competitors[0];
    const away = competitors.find((c) => c.homeAway === "away") || competitors[1];
    const homeAbbr = (home && home.team && (home.team.abbreviation || home.team.shortDisplayName)) || "?";
    const awayAbbr = (away && away.team && (away.team.abbreviation || away.team.shortDisplayName)) || "?";
    return { home, away, homeAbbr, awayAbbr };
  }

  function renderPanelScore(panelEl, league, events, selectedId) {
    const scoreBox = panelEl.querySelector(".score-display");
    const event = events.find((e) => e.id === selectedId) || events[0];
    if (!event) {
      scoreBox.innerHTML = '<span class="scores-loading">No games today.</span>';
      return;
    }

    const { home, away, homeAbbr, awayAbbr } = describeEvent(event);
    const isFinal = event.status && event.status.type && event.status.type.state === "post";
    const isLive = event.status && event.status.type && event.status.type.state === "in";
    const homeScore = home && home.score != null ? home.score : "-";
    const awayScore = away && away.score != null ? away.score : "-";
    const homeWinner = isFinal && home && home.winner;
    const awayWinner = isFinal && away && away.winner;
    const boxscoreHref = findBoxscoreLink(event);

    scoreBox.innerHTML = `
      <span class="score-matchup">
        <span class="score-team${awayWinner ? " winner" : ""}">${awayAbbr}</span>
        <span class="score-num${awayWinner ? " winner" : ""}">${awayScore}</span>
        <span class="score-at">@</span>
        <span class="score-team${homeWinner ? " winner" : ""}">${homeAbbr}</span>
        <span class="score-num${homeWinner ? " winner" : ""}">${homeScore}</span>
      </span>
      <span class="score-status${isLive ? " live" : ""}">${formatStatus(event)}</span>
      ${boxscoreHref ? `<a class="boxscore-link" href="${boxscoreHref}" target="_blank" rel="noopener">Box Score →</a>` : ""}
    `;
  }

  function buildPanel(league, events) {
    const panel = document.createElement("div");
    panel.className = "sport-panel";

    const title = document.createElement("div");
    title.className = "sport-panel-title";
    title.textContent = league.label;
    panel.appendChild(title);

    if (events.length === 0) {
      const empty = document.createElement("div");
      empty.className = "score-display";
      empty.innerHTML = '<span class="scores-loading">No games today.</span>';
      panel.appendChild(empty);
      return panel;
    }

    const select = document.createElement("select");
    select.className = "sport-panel-select";
    events.forEach((event) => {
      const { awayAbbr, homeAbbr } = describeEvent(event);
      const option = document.createElement("option");
      option.value = event.id;
      option.textContent = `${awayAbbr} @ ${homeAbbr}`;
      select.appendChild(option);
    });
    panel.appendChild(select);

    const scoreDisplay = document.createElement("div");
    scoreDisplay.className = "score-display";
    panel.appendChild(scoreDisplay);

    select.addEventListener("change", () => {
      renderPanelScore(panel, league, events, select.value);
    });

    renderPanelScore(panel, league, events, select.value);
    return panel;
  }

  async function fetchLeague(league) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${league.path}/scoreboard`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ESPN request failed for ${league.label}: ${res.status}`);
    const json = await res.json();
    return json.events || [];
  }

  async function refresh() {
    const results = await Promise.allSettled(LEAGUES.map(fetchLeague));

    inner.innerHTML = "";
    let anyPanels = false;

    results.forEach((result, i) => {
      const league = LEAGUES[i];
      if (result.status !== "fulfilled") return;
      const events = result.value;
      // Keep the currently selected game per panel across refreshes when possible.
      inner.appendChild(buildPanel(league, events));
      anyPanels = true;
    });

    if (!anyPanels) {
      inner.innerHTML = '<span class="scores-loading">Scores unavailable right now.</span>';
    }
  }

  refresh().catch((e) => {
    console.warn("Could not load sports scores", e);
    inner.innerHTML = '<span class="scores-loading">Scores unavailable right now.</span>';
  });
  setInterval(() => {
    refresh().catch((e) => console.warn("Could not refresh sports scores", e));
  }, REFRESH_MS);
})();
