// Progress Tracker — weekly check-ins with a little gamification.
(function () {
  "use strict";

  const DEFAULT_BOYS = [
    { id: "shai", name: "Shai", task: "Math homework", color: "#7c3aed", emoji: "🧮" },
    { id: "calev", name: "Calev", task: "Laining", color: "#0ea5e9", emoji: "📖" },
    { id: "aharon", name: "Aharon", task: "Daily Perek", color: "#f59e0b", emoji: "📜" },
    { id: "itai", name: "Itai", task: "Daily Perek", color: "#22c55e", emoji: "📜" },
  ];

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const STORAGE_KEY = "progressTracker.v1";
  const SESSION_KEY = "progressTracker.session";
  const ROSTER_KEY = "progressTracker.roster.v1";
  const POINTS_PER_DAY = 10;
  const FULL_WEEK_BONUS = 25;
  const PALETTE = ["#7c3aed", "#0ea5e9", "#f59e0b", "#22c55e", "#ef4444", "#ec4899"];

  function loadRoster() {
    try {
      const raw = localStorage.getItem(ROSTER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Could not read saved roster", e);
    }
    return DEFAULT_BOYS.map((b) => ({ ...b }));
  }

  function saveRoster(roster) {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
  }

  function slugify(name, existingIds) {
    let base = (name || "person")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    if (!base) base = "person";
    let id = base;
    let n = 2;
    while (existingIds.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    return id;
  }

  let BOYS = loadRoster();

  // Simple non-cryptographic hash — this is a family-friendly lock to stop
  // siblings from checking off each other's tasks, not real security. Anyone
  // with access to the code/storage can bypass it.
  function hashPin(pin) {
    let h = 0;
    const salted = `pt-salt-${pin}`;
    for (let i = 0; i < salted.length; i++) {
      h = (h << 5) - h + salted.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }

  function getWeekKey(date) {
    // ISO-ish week key: year + week number, anchored to Sunday-start weeks.
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - d.getDay());
    const jan1 = new Date(sunday.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((sunday - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `${sunday.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Could not read saved progress", e);
    }
    return { boys: {} };
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getBoyState(data, boyId) {
    if (!data.boys[boyId]) {
      data.boys[boyId] = { weeks: {}, points: 0, streak: 0 };
    }
    return data.boys[boyId];
  }

  function getWeekEntry(boyState, weekKey) {
    if (!boyState.weeks[weekKey]) {
      boyState.weeks[weekKey] = { days: new Array(7).fill(false), bonusAwarded: false };
    }
    // Migrate old shape (plain array) saved by earlier versions.
    if (Array.isArray(boyState.weeks[weekKey])) {
      boyState.weeks[weekKey] = { days: boyState.weeks[weekKey], bonusAwarded: false };
    }
    return boyState.weeks[weekKey];
  }

  const data = loadData();
  const currentWeekKey = getWeekKey(new Date());

  const board = document.getElementById("board");
  const weekLabel = document.getElementById("weekLabel");
  weekLabel.textContent = `Week of ${currentWeekKey}`;

  function getLoggedInBoyId() {
    return localStorage.getItem(SESSION_KEY) || null;
  }

  function setLoggedInBoyId(boyId) {
    if (boyId) {
      localStorage.setItem(SESSION_KEY, boyId);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  // --- Auth bar ---
  const authBar = document.getElementById("authBar");

  function renderAuthBar() {
    authBar.innerHTML = "";
    const loggedInId = getLoggedInBoyId();
    const loggedInBoy = BOYS.find((b) => b.id === loggedInId);

    if (loggedInBoy) {
      const status = document.createElement("div");
      status.className = "auth-status";
      const statusSpan = document.createElement("span");
      statusSpan.textContent = `${loggedInBoy.emoji} Logged in as ${loggedInBoy.name}`;
      status.appendChild(statusSpan);
      const logoutBtn = document.createElement("button");
      logoutBtn.type = "button";
      logoutBtn.className = "auth-btn secondary";
      logoutBtn.textContent = "Log out";
      logoutBtn.addEventListener("click", () => {
        setLoggedInBoyId(null);
        render();
      });
      status.appendChild(logoutBtn);
      authBar.appendChild(status);
    } else {
      const loginBtn = document.createElement("button");
      loginBtn.type = "button";
      loginBtn.className = "auth-btn";
      loginBtn.textContent = "Log in";
      loginBtn.addEventListener("click", openLoginModal);
      authBar.appendChild(loginBtn);
    }
  }

  // --- Login modal ---
  const loginOverlay = document.getElementById("loginOverlay");
  const loginForm = document.getElementById("loginForm");
  const loginName = document.getElementById("loginName");
  const loginPin = document.getElementById("loginPin");
  const loginHint = document.getElementById("loginHint");
  const loginError = document.getElementById("loginError");
  const loginCancel = document.getElementById("loginCancel");

  loginName.innerHTML = "";
  BOYS.forEach((b) => {
    const option = document.createElement("option");
    option.value = b.id;
    option.textContent = b.name;
    loginName.appendChild(option);
  });

  function updateLoginHint() {
    const boyState = getBoyState(data, loginName.value);
    loginHint.textContent = boyState.pinHash
      ? "Enter your PIN to log in."
      : "First time logging in? Just type a PIN to set it up.";
  }

  loginName.addEventListener("change", updateLoginHint);

  function openLoginModal() {
    loginError.textContent = "";
    loginPin.value = "";
    updateLoginHint();
    loginOverlay.classList.add("show");
    loginOverlay.setAttribute("aria-hidden", "false");
    setTimeout(() => loginPin.focus(), 0);
  }

  function closeLoginModal() {
    loginOverlay.classList.remove("show");
    loginOverlay.setAttribute("aria-hidden", "true");
  }

  loginCancel.addEventListener("click", closeLoginModal);
  loginOverlay.addEventListener("click", (e) => {
    if (e.target === loginOverlay) closeLoginModal();
  });

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const boyId = loginName.value;
    const boy = BOYS.find((b) => b.id === boyId);
    const pin = loginPin.value.trim();

    if (pin.length < 4) {
      loginError.textContent = "PIN needs to be at least 4 digits.";
      return;
    }

    const boyState = getBoyState(data, boyId);
    if (!boyState.pinHash) {
      boyState.pinHash = hashPin(pin);
      saveData(data);
    } else if (boyState.pinHash !== hashPin(pin)) {
      loginError.textContent = "That PIN doesn't match. Try again.";
      return;
    }

    setLoggedInBoyId(boyId);
    closeLoginModal();
    render();
  });

  function render() {
    renderAuthBar();
    const loggedInId = getLoggedInBoyId();
    board.innerHTML = "";
    BOYS.forEach((boy) => {
      const boyState = getBoyState(data, boy.id);
      const week = getWeekEntry(boyState, currentWeekKey);
      const days = week.days;
      const doneCount = days.filter(Boolean).length;
      const isFullWeek = doneCount === 7;
      const isOwner = loggedInId === boy.id;

      const card = document.createElement("div");
      card.className = "card" + (isFullWeek ? " full-week" : "") + (isOwner ? "" : " locked");

      const top = document.createElement("div");
      top.className = "card-top";
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.style.background = boy.color;
      avatar.textContent = boy.emoji;
      const effectiveTask = boyState.task || boy.task;

      const names = document.createElement("div");
      names.className = "names";
      const nameEl = document.createElement("p");
      nameEl.className = "card-name";
      nameEl.textContent = boy.name;
      names.appendChild(nameEl);

      const taskRow = document.createElement("div");
      taskRow.className = "task-row";

      const taskText = document.createElement("p");
      taskText.className = "card-task";
      taskText.textContent = effectiveTask;

      taskRow.appendChild(taskText);

      let editBtn = null;
      if (isOwner) {
        editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "edit-task-btn";
        editBtn.title = `Change ${boy.name}'s task`;
        editBtn.setAttribute("aria-label", `Change ${boy.name}'s task`);
        editBtn.textContent = "✏️";
        taskRow.appendChild(editBtn);
      } else {
        const lockBadge = document.createElement("span");
        lockBadge.className = "lock-badge";
        lockBadge.textContent = "🔒";
        lockBadge.title = `Log in as ${boy.name} to edit`;
        taskRow.appendChild(lockBadge);
      }
      names.appendChild(taskRow);

      if (editBtn) editBtn.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "task-input";
        input.value = effectiveTask;
        input.maxLength = 60;
        taskRow.replaceChild(input, taskText);
        editBtn.style.visibility = "hidden";
        input.focus();
        input.select();

        const commit = () => {
          const value = input.value.trim();
          boyState.task = value.length > 0 ? value : boy.task;
          if (boyState.task === boy.task) {
            delete boyState.task;
          }
          saveData(data);
          render();
        };

        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            input.blur();
          } else if (e.key === "Escape") {
            input.value = effectiveTask;
            input.blur();
          }
        });
        input.addEventListener("blur", commit);
      });

      top.appendChild(avatar);
      top.appendChild(names);
      card.appendChild(top);

      const stats = document.createElement("div");
      stats.className = "stats-row";
      const pointsPill = document.createElement("span");
      pointsPill.className = "stat-pill points";
      pointsPill.textContent = `⭐ ${boyState.points} pts`;
      const streakPill = document.createElement("span");
      streakPill.className = "stat-pill streak";
      streakPill.textContent = `🔥 ${boyState.streak} week streak`;
      const weekPill = document.createElement("span");
      weekPill.className = "stat-pill";
      weekPill.textContent = `${doneCount}/7 this week`;
      stats.appendChild(pointsPill);
      stats.appendChild(streakPill);
      stats.appendChild(weekPill);
      card.appendChild(stats);

      const bar = document.createElement("div");
      bar.className = "progress-bar";
      const fill = document.createElement("div");
      fill.className = "progress-fill";
      fill.style.width = `${(doneCount / 7) * 100}%`;
      bar.appendChild(fill);
      card.appendChild(bar);

      const daysRow = document.createElement("div");
      daysRow.className = "days";

      DAY_LABELS.forEach((label, i) => {
        const dayCol = document.createElement("div");
        dayCol.className = "day";

        const dayLabel = document.createElement("div");
        dayLabel.className = "day-label";
        dayLabel.textContent = label;
        dayCol.appendChild(dayLabel);

        const group = document.createElement("div");
        group.className = "radio-group";
        const groupName = `day-${boy.id}-${i}`;

        const doneWrap = document.createElement("div");
        doneWrap.className = "radio-option done";
        const doneId = `${groupName}-done`;
        const doneInput = document.createElement("input");
        doneInput.type = "radio";
        doneInput.name = groupName;
        doneInput.id = doneId;
        doneInput.value = "done";
        doneInput.checked = !!days[i];
        doneInput.disabled = !isOwner;
        const doneLabel = document.createElement("label");
        doneLabel.setAttribute("for", doneId);
        doneLabel.title = isOwner ? `${boy.name} did it on ${label}` : `Log in as ${boy.name} to update this`;
        doneLabel.textContent = "✓";
        doneWrap.appendChild(doneInput);
        doneWrap.appendChild(doneLabel);

        const pendingWrap = document.createElement("div");
        pendingWrap.className = "radio-option pending";
        const pendingId = `${groupName}-pending`;
        const pendingInput = document.createElement("input");
        pendingInput.type = "radio";
        pendingInput.name = groupName;
        pendingInput.id = pendingId;
        pendingInput.value = "pending";
        pendingInput.checked = !days[i];
        pendingInput.disabled = !isOwner;
        const pendingLabel = document.createElement("label");
        pendingLabel.setAttribute("for", pendingId);
        pendingLabel.title = isOwner ? "Not done yet" : `Log in as ${boy.name} to update this`;
        pendingLabel.textContent = "–";
        pendingWrap.appendChild(pendingInput);
        pendingWrap.appendChild(pendingLabel);

        group.appendChild(doneWrap);
        group.appendChild(pendingWrap);
        dayCol.appendChild(group);
        daysRow.appendChild(dayCol);

        doneInput.addEventListener("change", () => {
          if (doneInput.checked) {
            handleDayToggle(boy, i, true);
          }
        });
        pendingInput.addEventListener("change", () => {
          if (pendingInput.checked) {
            handleDayToggle(boy, i, false);
          }
        });
      });

      card.appendChild(daysRow);
      board.appendChild(card);
    });
  }

  function handleDayToggle(boy, dayIndex, isDone) {
    if (getLoggedInBoyId() !== boy.id) return; // safety net; disabled inputs shouldn't fire this anyway
    const boyState = getBoyState(data, boy.id);
    const week = getWeekEntry(boyState, currentWeekKey);
    const days = week.days;
    const was = days[dayIndex];
    if (was === isDone) return;

    days[dayIndex] = isDone;
    boyState.points = Math.max(0, boyState.points + (isDone ? POINTS_PER_DAY : -POINTS_PER_DAY));

    const doneCount = days.filter(Boolean).length;

    // Bonus/streak state is derived from an explicit per-week flag so toggling
    // a day off/on repeatedly can never re-award (or lose track of) the bonus.
    if (doneCount === 7 && !week.bonusAwarded) {
      week.bonusAwarded = true;
      boyState.streak += 1;
      boyState.points += FULL_WEEK_BONUS;
      celebrate(boy, "full-week");
    } else if (doneCount < 7 && week.bonusAwarded) {
      week.bonusAwarded = false;
      boyState.streak = Math.max(0, boyState.streak - 1);
      boyState.points = Math.max(0, boyState.points - FULL_WEEK_BONUS);
    } else if (isDone) {
      celebrate(boy, "day");
    }

    saveData(data);
    render();
  }

  // --- Celebration + confetti ---
  const celebrationEl = document.getElementById("celebration");
  const celebrationEmoji = document.getElementById("celebrationEmoji");
  const celebrationText = document.getElementById("celebrationText");
  let celebrationTimer = null;

  const DAY_MESSAGES = ["Nice work!", "Way to go!", "Boom! 💪", "That's a win!", "Crushing it!"];
  const WEEK_MESSAGES = ["Full week! Amazing streak!", "7 for 7 — superstar!", "Perfect week!"];

  function celebrate(boy, kind) {
    const isWeek = kind === "full-week";
    celebrationEmoji.textContent = isWeek ? "🏆" : ["🎉", "✨", "🌟", "👏"][Math.floor(Math.random() * 4)];
    const messages = isWeek ? WEEK_MESSAGES : DAY_MESSAGES;
    celebrationText.textContent = `${boy.name}: ${messages[Math.floor(Math.random() * messages.length)]}`;

    celebrationEl.classList.add("show");
    clearTimeout(celebrationTimer);
    celebrationTimer = setTimeout(() => {
      celebrationEl.classList.remove("show");
    }, isWeek ? 1600 : 900);

    burstConfetti(isWeek ? 90 : 35, boy.color);
  }

  // Lightweight canvas confetti — no dependencies.
  const canvas = document.getElementById("confetti");
  const ctx = canvas.getContext("2d");
  let particles = [];
  let rafId = null;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  const CONFETTI_COLORS = ["#7c3aed", "#f59e0b", "#22c55e", "#0ea5e9", "#ef4444", "#ec4899"];

  function burstConfetti(count, accentColor) {
    const colors = [accentColor, ...CONFETTI_COLORS];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 4,
        size: 5 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife: 90 + Math.random() * 40,
      });
    }
    if (!rafId) {
      rafId = requestAnimationFrame(animateConfetti);
    }
  }

  function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter((p) => p.life < p.maxLife);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.rotation += p.vr;
      p.life += 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });

    if (particles.length > 0) {
      rafId = requestAnimationFrame(animateConfetti);
    } else {
      rafId = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // --- Settings: edit names/tasks without touching code ---
  const settingsOverlay = document.getElementById("settingsOverlay");
  const settingsList = document.getElementById("settingsList");
  const openSettingsBtn = document.getElementById("openSettings");
  const closeSettingsBtn = document.getElementById("closeSettings");
  const addPersonBtn = document.getElementById("addPerson");
  const saveSettingsBtn = document.getElementById("saveSettings");

  let draftRoster = [];

  function openSettings() {
    // Work on a copy so cancelling (closing without saving) discards edits.
    draftRoster = BOYS.map((b) => ({ ...b }));
    renderSettingsList();
    settingsOverlay.classList.add("show");
    settingsOverlay.setAttribute("aria-hidden", "false");
  }

  function closeSettings() {
    settingsOverlay.classList.remove("show");
    settingsOverlay.setAttribute("aria-hidden", "true");
  }

  function renderSettingsList() {
    settingsList.innerHTML = "";
    draftRoster.forEach((person, index) => {
      const row = document.createElement("div");
      row.className = "settings-row";

      const emojiColorWrap = document.createElement("div");
      emojiColorWrap.className = "emoji-color";
      const emojiInput = document.createElement("input");
      emojiInput.type = "text";
      emojiInput.className = "emoji-input";
      emojiInput.value = person.emoji;
      emojiInput.maxLength = 4;
      emojiInput.setAttribute("aria-label", "Emoji");
      emojiInput.addEventListener("input", () => {
        draftRoster[index].emoji = emojiInput.value || "⭐";
      });
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = person.color;
      colorInput.setAttribute("aria-label", "Color");
      colorInput.addEventListener("input", () => {
        draftRoster[index].color = colorInput.value;
      });
      emojiColorWrap.appendChild(emojiInput);
      emojiColorWrap.appendChild(colorInput);

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = person.name;
      nameInput.placeholder = "Name";
      nameInput.setAttribute("aria-label", "Name");
      nameInput.addEventListener("input", () => {
        draftRoster[index].name = nameInput.value;
      });

      const taskInput = document.createElement("input");
      taskInput.type = "text";
      taskInput.value = person.task;
      taskInput.placeholder = "Task";
      taskInput.setAttribute("aria-label", "Task");
      taskInput.addEventListener("input", () => {
        draftRoster[index].task = taskInput.value;
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-person";
      removeBtn.textContent = "✕";
      removeBtn.setAttribute("aria-label", `Remove ${person.name || "person"}`);
      removeBtn.addEventListener("click", () => {
        if (draftRoster.length <= 1) {
          alert("You need at least one person.");
          return;
        }
        if (!confirm(`Remove ${person.name || "this person"}? Their saved progress will stay stored but hidden.`)) return;
        draftRoster.splice(index, 1);
        renderSettingsList();
      });

      row.appendChild(emojiColorWrap);
      row.appendChild(nameInput);
      row.appendChild(taskInput);
      row.appendChild(removeBtn);
      settingsList.appendChild(row);
    });
  }

  openSettingsBtn.addEventListener("click", openSettings);
  closeSettingsBtn.addEventListener("click", closeSettings);
  settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });

  addPersonBtn.addEventListener("click", () => {
    const existingIds = new Set(draftRoster.map((p) => p.id));
    draftRoster.push({
      id: slugify("new-person", existingIds),
      name: "",
      task: "",
      color: PALETTE[draftRoster.length % PALETTE.length],
      emoji: "⭐",
    });
    renderSettingsList();
    settingsList.scrollTop = settingsList.scrollHeight;
  });

  saveSettingsBtn.addEventListener("click", () => {
    const existingIds = new Set();
    const cleaned = draftRoster.map((person) => {
      const name = person.name.trim() || "Someone";
      let id = person.id;
      if (!id || existingIds.has(id)) {
        id = slugify(name, existingIds);
      }
      existingIds.add(id);
      return {
        id,
        name,
        task: person.task.trim() || "Task",
        color: person.color || "#7c3aed",
        emoji: person.emoji || "⭐",
      };
    });

    BOYS = cleaned;
    saveRoster(BOYS);
    closeSettings();
    render();
  });

  document.getElementById("resetWeek").addEventListener("click", () => {
    if (!confirm("Reset this week's check-offs for everyone? Points already earned stay banked.")) return;
    BOYS.forEach((boy) => {
      const boyState = getBoyState(data, boy.id);
      const week = getWeekEntry(boyState, currentWeekKey);
      week.days = new Array(7).fill(false);
      // Bonus/streak already banked for this week are intentionally left as-is —
      // only the day check-offs are cleared, per the confirm dialog's wording.
    });
    saveData(data);
    render();
  });

  render();
})();
