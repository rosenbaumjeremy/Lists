// Live sports scores ticker — pulls the same leagues shown on ESPN.com's
// front-page scores rail from ESPN's public scoreboard API and scrolls them
// across the top of the page. No API key needed; refreshes periodically.
(function () {
  "use strict";

  // Mirrors ESPN.com's front-page "Top Events" rail rather than every league's
  // full slate — that rail is a hand-curated, ever-changing subset (whatever
  // ESPN is featuring that day: a World Cup, the World Series, summer league,
  // etc.), which has no public API. We approximate it by pulling from the
  // handful of leagues ESPN's rail actually features right now, and only
  // showing today's live/upcoming games from each (never a full schedule).
  const LEAGUES = [
    { path: "soccer/fifa.world", label: "World Cup" },
    { path: "baseball/mlb", label: "MLB" },
    { path: "basketball/wnba", label: "WNBA" },
    { path: "basketball/nba-summer-las-vegas", label: "NBA Summer League" },
  ];

  const MAX_ITEMS = 12;
  const REFRESH_MS = 60000;
  const track = document.getElementById("scoresTrack");
  if (!track) return;

  function formatStatus(event) {
    const status = event.status || {};
    const type = status.type || {};
    if (type.state === "in") {
      return status.type.shortDetail || "Live";
    }
    if (type.state === "post") {
      return "Final";
    }
    // Pre-game: show the scheduled time.
    const date = new Date(event.date);
    return date.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  }

  function buildItem(leagueLabel, event) {
    const competition = (event.competitions && event.competitions[0]) || {};
    const competitors = competition.competitors || [];
    const home = competitors.find((c) => c.homeAway === "home") || competitors[0];
    const away = competitors.find((c) => c.homeAway === "away") || competitors[1];
    if (!home || !away) return null;

    const isFinal = (event.status && event.status.type && event.status.type.state === "post") || false;
    const isLive = (event.status && event.status.type && event.status.type.state === "in") || false;

    const homeAbbr = (home.team && (home.team.abbreviation || home.team.shortDisplayName)) || "?";
    const awayAbbr = (away.team && (away.team.abbreviation || away.team.shortDisplayName)) || "?";
    const homeScore = home.score != null ? home.score : "-";
    const awayScore = away.score != null ? away.score : "-";

    const homeWinner = isFinal && home.winner;
    const awayWinner = isFinal && away.winner;

    const item = document.createElement("div");
    item.className = "score-item" + (isLive ? " live" : "");

    item.innerHTML = `
      <span class="score-league">${leagueLabel}</span>
      <span class="score-matchup">
        <span class="score-team${awayWinner ? " winner" : ""}">${awayAbbr}</span>
        <span class="score-num${awayWinner ? " winner" : ""}">${awayScore}</span>
        <span class="score-at">@</span>
        <span class="score-team${homeWinner ? " winner" : ""}">${homeAbbr}</span>
        <span class="score-num${homeWinner ? " winner" : ""}">${homeScore}</span>
      </span>
      <span class="score-status${isLive ? " live" : ""}">${formatStatus(event)}</span>
    `;
    return item;
  }

  async function fetchLeague(league) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${league.path}/scoreboard`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ESPN request failed for ${league.label}: ${res.status}`);
    const json = await res.json();
    const events = json.events || [];
    return events.map((event) => ({ league, event }));
  }

  async function refresh() {
    const results = await Promise.allSettled(LEAGUES.map(fetchLeague));
    const items = [];
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        result.value.forEach(({ league, event }) => items.push({ league, event }));
      }
    });

    track.innerHTML = "";

    if (items.length === 0) {
      const empty = document.createElement("span");
      empty.className = "scores-loading";
      empty.textContent = "No games today.";
      track.appendChild(empty);
      return;
    }

    // Live and today's games first, so the most relevant scores lead the ticker.
    items.sort((a, b) => {
      const aLive = a.event.status && a.event.status.type && a.event.status.type.state === "in";
      const bLive = b.event.status && b.event.status.type && b.event.status.type.state === "in";
      if (aLive !== bLive) return aLive ? -1 : 1;
      return 0;
    });

    items.slice(0, MAX_ITEMS).forEach(({ league, event }) => {
      const el = buildItem(league.label, event);
      if (el) track.appendChild(el);
    });

    // Duplicate the items so the CSS marquee loop has no visible seam.
    const clone = track.innerHTML;
    track.innerHTML += clone;
  }

  refresh().catch((e) => {
    console.warn("Could not load sports scores", e);
    track.innerHTML = '<span class="scores-loading">Scores unavailable right now.</span>';
  });
  setInterval(() => {
    refresh().catch((e) => console.warn("Could not refresh sports scores", e));
  }, REFRESH_MS);
})();
