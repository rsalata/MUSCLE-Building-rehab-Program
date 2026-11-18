(function(){
  const STORAGE_KEY = 'workout_programs_data_v1';
  const SESSION_KEY = 'workout_programs_session_v1';
  const PREF_KEY = 'workout_programs_active_v1';

  let currentProgram = WORKOUT_PROGRAMS.atg_program_1 ? 'atg_program_1' : Object.keys(WORKOUT_PROGRAMS)[0];
  let currentWorkout = Object.keys(WORKOUT_PROGRAMS[currentProgram].workouts)[0];

  let timerIntervals = {};
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let userData = {};
  let sessionData = {};

  // =========================
  // DOM ELEMENTS
  // =========================

  const programSelect = document.getElementById('program-select');
  const workoutSelect = document.getElementById('workout-select');
  const programBadge = document.getElementById('program-badge');
  const workoutLabel = document.getElementById('workout-label');
  const workoutDisplay = document.getElementById('workout-display');
  const progressionNotesDiv = document.getElementById('progression-notes');
  const programTitle = document.getElementById('program-title');
  const programDescription = document.getElementById('program-description');
  const scheduleText = document.getElementById('schedule-text');
  const generalNotes = document.getElementById('general-notes');

  // =========================
  // LOCAL STORAGE
  // =========================

  function loadData(key) {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Failed to load data:', e);
      return {};
    }
  }

  function saveData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  }

  userData = loadData(STORAGE_KEY);
  sessionData = loadData(SESSION_KEY);
  Object.values(sessionData).forEach(session => { if (session && session.running) { session.running = false; delete session.startTime; } });
  saveData(SESSION_KEY,sessionData);

  // =========================
  // HELPERS
  // =========================

  function getExerciseId(program, workout, dayKey, section, index) {
    return `${program}_${workout}_${dayKey}_${section}_${index}`;
  }

  function getUserExerciseData(id) {
    return userData[id] || {
      weight: '',
      sets: '',
      reps: '',
      notes: '',
      done: false
    };
  }

  function updateUserExerciseData(id, field, value) {
    if (!userData[id]) {
      userData[id] = {
        weight: '',
        sets: '',
        reps: '',
        notes: '',
        done: false
      };
    }

    userData[id][field] = value;
    saveData(STORAGE_KEY, userData);
  }

  function getSessionId(program, workout, dayKey) {
    return `${program}_${workout}_${dayKey}`;
  }

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function prettySectionName(sectionKey) {
    return sectionKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  // =========================
  // TIMERS
  // =========================

  window.toggleTimer = function(sessionId) {
    if (!sessionData[sessionId]) {
      sessionData[sessionId] = {
        date: new Date().toISOString(),
        elapsed: 0,
        running: false
      };
    }

    const session = sessionData[sessionId];
    if (session.running && session.startTime) session.elapsed = Math.floor((Date.now()-session.startTime)/1000);
    session.running = !session.running;
    if (timerIntervals[sessionId]) clearInterval(timerIntervals[sessionId]);
    session.date = new Date().toISOString();

    if (session.running) {
      session.startTime = Date.now() - (session.elapsed * 1000);

      timerIntervals[sessionId] = setInterval(() => {
        session.elapsed = Math.floor((Date.now() - session.startTime) / 1000);
        updateTimerDisplay(sessionId);
        saveData(SESSION_KEY, sessionData);
      }, 1000);
    } else {
      clearInterval(timerIntervals[sessionId]);
      delete timerIntervals[sessionId];
      delete session.startTime;
    }

    updateTimerDisplay(sessionId);
    saveData(SESSION_KEY, sessionData);
  };

  window.resetTimer = function(sessionId) {
    clearInterval(timerIntervals[sessionId]);
    delete timerIntervals[sessionId];

    sessionData[sessionId] = {
      date: sessionData[sessionId]?.date || null,
      elapsed: 0,
      running: false
    };

    updateTimerDisplay(sessionId);
    saveData(SESSION_KEY, sessionData);
  };

  function updateTimerDisplay(sessionId) {
    const timerEl = document.getElementById(`timer-${sessionId}`);
    const btnEl = document.getElementById(`timer-btn-${sessionId}`);

    if (!timerEl || !sessionData[sessionId]) return;

    timerEl.textContent = formatTime(sessionData[sessionId].elapsed);

    if (btnEl) {
      btnEl.textContent = sessionData[sessionId].running ? 'Pause' : 'Start';
      btnEl.classList.toggle('active', sessionData[sessionId].running);
    }
  }

  // =========================
  // COLLAPSE SECTIONS
  // =========================

  window.toggleCollapse = function(sectionId) {
    const content = document.getElementById(sectionId);
    const header = document.querySelector(`[data-section="${sectionId}"]`);

    if (!content || !header) return;

    const isCollapsed = content.classList.contains('collapsed');
    header.setAttribute('aria-expanded', String(isCollapsed));

    if (isCollapsed) {
      content.style.maxHeight = 'none';
      content.classList.remove('collapsed');
      header.classList.remove('collapsed');
    } else {
      content.style.maxHeight = '0';
      content.classList.add('collapsed');
      header.classList.add('collapsed');
    }
  };

  // =========================
  // DROPDOWNS
  // =========================

  function populateProgramSelector() {
    programSelect.innerHTML = '';

    Object.keys(WORKOUT_PROGRAMS).forEach(programKey => {
      const option = document.createElement('option');
      option.value = programKey;
      option.textContent = WORKOUT_PROGRAMS[programKey].name || programKey;
      programSelect.appendChild(option);
    });

    const preferred = localStorage.getItem(PREF_KEY);
    currentProgram = preferred && WORKOUT_PROGRAMS[preferred] ? preferred : (WORKOUT_PROGRAMS.atg_program_1 ? 'atg_program_1' : Object.keys(WORKOUT_PROGRAMS)[0]);
    programSelect.value = currentProgram;
  }

  function updateWorkoutSelector(program) {
    const programData = WORKOUT_PROGRAMS[program];

    workoutSelect.innerHTML = '';

    Object.keys(programData.workouts).forEach(workoutKey => {
      const option = document.createElement('option');
      option.value = workoutKey;
      option.textContent = programData.workouts[workoutKey].label || workoutKey;
      workoutSelect.appendChild(option);
    });

    const preferredWorkout = localStorage.getItem('workout_programs_workout_'+program);
    currentWorkout = preferredWorkout && programData.workouts[preferredWorkout] ? preferredWorkout : Object.keys(programData.workouts)[0];
    workoutSelect.value = currentWorkout;
    workoutLabel.textContent = 'Workout';
  }

  // =========================
  // INFO PANEL
  // =========================

  function updateInfoSection() {
    const programData = WORKOUT_PROGRAMS[currentProgram];
    const info = programData.info || {};

    programTitle.textContent = info.title || programData.name || currentProgram;
    programDescription.textContent = info.description || '';
    scheduleText.textContent = info.schedule || 'Follow the listed workout days in order.';

    const notes = Array.isArray(info.notes) ? info.notes : [];

    generalNotes.innerHTML = notes.length
      ? notes.map(note => `<li>${escapeHtml(note)}</li>`).join('')
      : '<li>Use pain-free range of motion.</li><li>Track your workout notes each session.</li>';
  }

  // =========================
  // INPUT LISTENERS
  // =========================

  function attachInputListeners() {
    workoutDisplay.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', e => {
        const id = e.target.dataset.id;
        const field = e.target.dataset.field;

        if (!id || !field) return;

        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        updateUserExerciseData(id, field, value);
        if (field === 'done') e.target.closest('.exercise-card')?.classList.toggle('completed', Boolean(value));
      });

      input.addEventListener('change', e => {
        const id = e.target.dataset.id;
        const field = e.target.dataset.field;

        if (!id || !field) return;

        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        updateUserExerciseData(id, field, value);
      });
    });
  }

  // =========================
  // RENDER GENERIC PROGRAM
  // =========================

  function renderWorkout() {
    const programData = WORKOUT_PROGRAMS[currentProgram];

    if (!programData) {
      workoutDisplay.innerHTML = '<p class="muted">No workout data found.</p>';
      return;
    }

    const workoutInfo = programData.workouts[currentWorkout] || {
      label: 'Main',
      description: ''
    };

    programBadge.textContent = programData.name || currentProgram;
    updateInfoSection();

    progressionNotesDiv.innerHTML = `
      <h4>${escapeHtml(workoutInfo.label || 'Workout')}</h4>
      <p>${escapeHtml(workoutInfo.description || '')}</p>
    `;

    let html = `<h2 style="margin:0 0 16px">${escapeHtml(programData.name || currentProgram)}</h2>`;

    const dayKeys = Object.keys(programData.days || {});

    if (!dayKeys.length) {
      workoutDisplay.innerHTML = '<p class="muted">No workout days found for this program.</p>';
      return;
    }

    dayKeys.forEach(dayKey => {
      const day = programData.days[dayKey];
      const sessionId = getSessionId(currentProgram, currentWorkout, dayKey);

      const session = sessionData[sessionId] || {
        date: null,
        elapsed: 0,
        running: false
      };

      const sessionDate = session.date ? new Date(session.date).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : 'Not started';

      html += `
        <div class="day-title">
          <span>${escapeHtml(day.name || dayKey)}</span>
          <div class="session-info">
            <span>Last: ${sessionDate}</span>
            <span class="timer" id="timer-${sessionId}">${formatTime(session.elapsed)}</span>
            <button class="timer-btn ${session.running ? 'active' : ''}" id="timer-btn-${sessionId}" onclick="toggleTimer('${sessionId}')">
              ${session.running ? 'Pause' : 'Start'}
            </button>
            <button class="timer-btn" onclick="resetTimer('${sessionId}')">Reset</button>
          </div>
        </div>
      `;

      Object.keys(day).forEach(sectionKey => {
        if (sectionKey === 'name') return;
        if (!Array.isArray(day[sectionKey])) return;

        const exercises = day[sectionKey];
        if (!exercises.length) return;

        const sectionId = `${currentProgram}_${currentWorkout}_${dayKey}_${sectionKey}`;
        const sectionTitle = prettySectionName(sectionKey);

        html += `
          <div class="section-title" role="button" tabindex="0" aria-expanded="true" data-section="${sectionId}" onclick="toggleCollapse('${sectionId}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleCollapse('${sectionId}')}">
            <span>${sectionTitle}</span>
            <span class="arrow">▼</span>
          </div>

          <div class="collapsible-content" id="${sectionId}" style="max-height:none;">
            <div class="exercise-list">
        `;
        exercises.forEach((ex, idx) => {
          const id = getExerciseId(currentProgram, currentWorkout, dayKey, sectionKey, idx);
          const saved = getUserExerciseData(id);
          const field = (key,placeholder) => `<input type="text" aria-label="${escapeHtml(ex.name)} ${key}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(saved[key] || '')}" data-id="${id}" data-field="${key}">`;
          html += `
            <div class="exercise-card ${saved.done ? 'completed' : ''}">
              <div class="exercise-top">
                <input type="checkbox" aria-label="Completed: ${escapeHtml(ex.name)}" ${saved.done ? 'checked' : ''} data-id="${id}" data-field="done">
                <div><strong>${escapeHtml(ex.name || '')}</strong>${ex.notes ? `<div class="note">${escapeHtml(ex.notes)}</div>` : ''}</div>
              </div>
              <div class="exercise-fields">
                <label>Weight ${field('weight','—')}</label>
                <label>Sets ${field('sets',ex.sets || '—')}</label>
                <label>Reps / time ${field('reps',ex.reps || '—')}</label>
              </div>
              <label class="exercise-notes">Session notes ${field('notes','Notes for this exercise')}</label>
            </div>`;
        });
        html += `</div></div>`;
      });
    });

    workoutDisplay.innerHTML = html;
    attachInputListeners();
  }

  // =========================
  // EXPORT / IMPORT / CLEAR DATA
  // =========================

  window.exportWorkoutData = function() {
    const payload = {
      userData,
      sessionData,
      morningData: loadData('morning_mobility_shoulder_v1'),
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `workout-data-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  window.clearWorkoutData = function() {
    const confirmText = prompt('Type DELETE to clear all saved workout data. This cannot be undone without a backup.');

    if (confirmText !== 'DELETE') return;

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_KEY);

    Object.values(timerIntervals).forEach(clearInterval);
    timerIntervals = {};
    userData = {};
    sessionData = {};

    renderWorkout();
  };

  window.importWorkoutData = function(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed.userData !== 'object' || Array.isArray(parsed.userData) || !parsed.userData || typeof parsed.sessionData !== 'object' || Array.isArray(parsed.sessionData) || !parsed.sessionData) throw Error('Invalid backup format');
        if (!confirm('Import this backup? It will replace current workout logs on this device. Export your current data first if needed.')) return;
        userData = parsed.userData;
        sessionData = parsed.sessionData;
        Object.values(sessionData).forEach(session=>{if(session && typeof session==='object'){session.running=false;delete session.startTime;}});
        Object.values(timerIntervals).forEach(clearInterval);
        timerIntervals = {};
        saveData(STORAGE_KEY, userData);
        saveData(SESSION_KEY, sessionData);
        if (parsed.morningData && typeof parsed.morningData === 'object' && !Array.isArray(parsed.morningData)) saveData('morning_mobility_shoulder_v1',parsed.morningData);
        renderWorkout();
        alert('Workout data imported. Reload the app to refresh the morning routine.');
      } catch(error) { alert('Could not import this file: '+error.message); }
      finally { event.target.value = ''; }
    };
    reader.readAsText(file);
  };

  // =========================
  // EVENTS
  // =========================

  programSelect.addEventListener('change', e => {
    currentProgram = e.target.value;
    localStorage.setItem(PREF_KEY,currentProgram);
    updateWorkoutSelector(currentProgram);
    renderWorkout();
  });

  workoutSelect.addEventListener('change', e => {
    currentWorkout = e.target.value;
    localStorage.setItem('workout_programs_workout_'+currentProgram,currentWorkout);
    renderWorkout();
  });

  // =========================
  // INITIALIZE
  // =========================

  populateProgramSelector();
  updateWorkoutSelector(currentProgram);
  renderWorkout();

})();
