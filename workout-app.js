(function(){
  const STORAGE_KEY = 'workout_programs_data_v1';
  const SESSION_KEY = 'workout_programs_session_v1';

  let currentProgram = Object.keys(WORKOUT_PROGRAMS)[0];
  let currentWorkout = Object.keys(WORKOUT_PROGRAMS[currentProgram].workouts)[0];

  let timerIntervals = {};
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
    session.running = !session.running;
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
    }

    updateTimerDisplay(sessionId);
    saveData(SESSION_KEY, sessionData);
  };

  window.resetTimer = function(sessionId) {
    clearInterval(timerIntervals[sessionId]);

    sessionData[sessionId] = {
      date: new Date().toISOString(),
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

    if (isCollapsed) {
      content.style.maxHeight = content.scrollHeight + 'px';
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

    currentProgram = Object.keys(WORKOUT_PROGRAMS)[0];
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

    currentWorkout = Object.keys(programData.workouts)[0];
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
    scheduleText.innerHTML = info.schedule || 'Follow the listed workout days in order.';

    const notes = Array.isArray(info.notes) ? info.notes : [];

    generalNotes.innerHTML = notes.length
      ? notes.map(note => `<li>${note}</li>`).join('')
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
      <h4>${workoutInfo.label || 'Workout'}</h4>
      <p>${workoutInfo.description || ''}</p>
    `;

    let html = `<h2 style="margin:0 0 16px">${programData.name || currentProgram}</h2>`;

    const dayKeys = Object.keys(programData.days || {});

    if (!dayKeys.length) {
      workoutDisplay.innerHTML = '<p class="muted">No workout days found for this program.</p>';
      return;
    }

    dayKeys.forEach(dayKey => {
      const day = programData.days[dayKey];
      const sessionId = getSessionId(currentProgram, currentWorkout, dayKey);

      const session = sessionData[sessionId] || {
        date: new Date().toISOString(),
        elapsed: 0,
        running: false
      };

      const sessionDate = new Date(session.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      html += `
        <div class="day-title">
          <span>${day.name || dayKey}</span>
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
          <div class="section-title" data-section="${sectionId}" onclick="toggleCollapse('${sectionId}')">
            <span>${sectionTitle}</span>
            <span class="arrow">▼</span>
          </div>

          <div class="collapsible-content" id="${sectionId}" style="max-height:none;">
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Done</th>
                    <th>Exercise</th>
                    <th class="input-cell">Weight</th>
                    <th class="input-cell">Sets</th>
                    <th class="input-cell">Reps / Time</th>
                    <th class="notes-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
        `;

        exercises.forEach((ex, idx) => {
          const id = getExerciseId(currentProgram, currentWorkout, dayKey, sectionKey, idx);
          const saved = getUserExerciseData(id);

          html += `
            <tr>
              <td style="text-align:center">
                <input type="checkbox" ${saved.done ? 'checked' : ''} data-id="${id}" data-field="done">
              </td>
              <td>
                <strong>${ex.name || ''}</strong>
                ${ex.notes ? `<br><span class="note">${ex.notes}</span>` : ''}
              </td>
              <td class="input-cell">
                <input type="text" placeholder="0" value="${saved.weight || ''}" data-id="${id}" data-field="weight">
              </td>
              <td class="input-cell">
                <input type="text" placeholder="${ex.sets || ''}" value="${saved.sets || ''}" data-id="${id}" data-field="sets">
              </td>
              <td class="input-cell">
                <input type="text" placeholder="${ex.reps || ''}" value="${saved.reps || ''}" data-id="${id}" data-field="reps">
              </td>
              <td class="notes-cell">
                <input type="text" placeholder="Session notes..." value="${saved.notes || ''}" data-id="${id}" data-field="notes">
              </td>
            </tr>
          `;
        });

        html += `
                </tbody>
              </table>
            </div>
          </div>
        `;
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

    URL.revokeObjectURL(url);
  };

  window.clearWorkoutData = function() {
    const confirmText = prompt('Type DELETE to clear all saved workout data.');

    if (confirmText !== 'DELETE') return;

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_KEY);

    userData = {};
    sessionData = {};

    renderWorkout();
  };

  // =========================
  // EVENTS
  // =========================

  programSelect.addEventListener('change', e => {
    currentProgram = e.target.value;
    updateWorkoutSelector(currentProgram);
    renderWorkout();
  });

  workoutSelect.addEventListener('change', e => {
    currentWorkout = e.target.value;
    renderWorkout();
  });

  // =========================
  // INITIALIZE
  // =========================

  populateProgramSelector();
  updateWorkoutSelector(currentProgram);
  renderWorkout();

})();
