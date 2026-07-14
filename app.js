// Progress Tracker — weekly check-ins with a little gamification.
(function () {
  "use strict";

  const BOYS = [
    { id: "shai", name: "Shai", task: "Math homework", color: "#7c3aed", emoji: "🧮" },
    { id: "calev", name: "Calev", task: "Laining", color: "#0ea5e9", emoji: "📖" },
    { id: "aharon", name: "Aharon", task: "Daily Perek", color: "#f59e0b", emoji: "📜" },
    { id: "itai", name: "Itai", task: "Daily Perek", color: "#22c55e", emoji: "📜" },
  ];

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const STORAGE_KEY = "progressTracker.v1";
  const SESSION_KEY = "progressTracker.session";
  const POINTS_PER_DAY = 10;
  const FULL_WEEK_BONUS = 25;

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
      status.innerHTML = `<span>${loggedInBoy.emoji} Logged in as ${loggedInBoy.name}</span>`;
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

  loginName.innerHTML = BOYS.map((b) => `<option value="${b.id}">${b.name}</option>`).join("");

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
      names.innerHTML = `<p class="card-name">${boy.name}</p>`;

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
      stats.innerHTML = `
        <span class="stat-pill points">⭐ ${boyState.points} pts</span>
        <span class="stat-pill streak">🔥 ${boyState.streak} week streak</span>
        <span class="stat-pill">${doneCount}/7 this week</span>
      `;
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

        const disabledAttr = isOwner ? "" : "disabled";

        const doneWrap = document.createElement("div");
        doneWrap.className = "radio-option done";
        const doneId = `${groupName}-done`;
        doneWrap.innerHTML = `<input type="radio" name="${groupName}" id="${doneId}" value="done" ${
          days[i] ? "checked" : ""
        } ${disabledAttr}><label for="${doneId}" title="${
          isOwner ? `${boy.name} did it on ${label}` : `Log in as ${boy.name} to update this`
        }">✓</label>`;

        const pendingWrap = document.createElement("div");
        pendingWrap.className = "radio-option pending";
        const pendingId = `${groupName}-pending`;
        pendingWrap.innerHTML = `<input type="radio" name="${groupName}" id="${pendingId}" value="pending" ${
          !days[i] ? "checked" : ""
        } ${disabledAttr}><label for="${pendingId}" title="${
          isOwner ? "Not done yet" : `Log in as ${boy.name} to update this`
        }">–</label>`;

        group.appendChild(doneWrap);
        group.appendChild(pendingWrap);
        dayCol.appendChild(group);
        daysRow.appendChild(dayCol);

        const doneInput = doneWrap.querySelector("input");
        const pendingInput = pendingWrap.querySelector("input");

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
