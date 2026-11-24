(function(){
  const STORAGE_KEY = 'workout_programs_data_v1';
  const SESSION_KEY = 'workout_programs_session_v1';
  const PREF_KEY = 'workout_programs_active_v1';

  let currentProgram = WORKOUT_PROGRAMS.atg_program_1 ? 'atg_program_1' : Object.keys(WORKOUT_PROGRAMS)[0];
  let currentWorkout = Object.keys(WORKOUT_PROGRAMS[currentProgram].workouts)[0];
  let currentDay = '';
  const localDate = () => new Date().toLocaleDateString('en-CA');
  let selectedDate = localDate();

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

  function prescribedSetCount(ex) {
    const count = parseInt(ex.sets, 10);
    return Number.isFinite(count) ? Math.min(Math.max(count, 1), 12) : 1;
  }

  function getExerciseEntry(id, ex) {
    const record = userData[id];
    const saved = record?.entries?.[selectedDate];
    if (saved) return saved;
    return {sets: Array.from({length:prescribedSetCount(ex)}, () => ({reps:'',weight:'',notes:'',done:false})), notes:''};
  }

  function editExerciseEntry(id, ex) {
    userData[id] ||= {};
    userData[id].entries ||= {};
    if (!userData[id].entries[selectedDate]) userData[id].entries[selectedDate] = getExerciseEntry(id, ex);
    return userData[id].entries[selectedDate];
  }

  function previousEntry(id) {
    const record = userData[id];
    if (!record) return '';
    const dates = Object.keys(record.entries || {}).filter(date => date < selectedDate).sort().reverse();
    if (dates.length) {
      const entry = record.entries[dates[0]];
      const logged = (entry.sets || []).filter(set => set.done || set.reps || set.weight);
      return logged.length ? `Previous (${dates[0]}): ${logged.map(set => [set.reps || '—', set.weight ? set.weight+' lb' : 'bodyweight'].join(' @ ')).join(' · ')}` : '';
    }
    if (record.sets || record.reps || record.weight || record.notes) return `Earlier entry: ${record.sets || '—'} sets · ${record.reps || '—'} reps/time · ${record.weight || '—'} weight${record.notes ? ' · '+record.notes : ''}`;
    return '';
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


  // Movement preparation is supplementary; original program prescriptions are unchanged.
  const PREP_KEY = 'workout_movement_prep_v1';
  const prepLibrary = {
    ninety: {name:'90/90 breathing (feet on wall or bench)',dose:'3–5 slow breaths',why:'Practice rib and pelvic positioning and gentle trunk control before movement.',how:'Lie on your back with hips and knees about 90 degrees and feet supported. Exhale slowly for 5–6 seconds, let ribs settle, then inhale quietly. Avoid straining or holding your breath.',next:'Keep breathing relaxed and controlled before adding more breaths.'},
    bike: {name:'Stationary bike or easy march',dose:'2–3 minutes',why:'Gradually increase circulation and body temperature.',how:'Start at a comfortable pace; finish feeling warmer, not fatigued.',next:'Increase pace slightly only when the current effort feels comfortable.'},
    ankle: {name:'Supported ankle rocks',dose:'8–10 per side',why:'Prepare ankle motion for stepping and squatting.',how:'With heel down, move knee gently forward over toes; use support.',next:'Move slightly farther without lifting the heel or forcing range.'},
    hip: {name:'Supported hip rotations',dose:'6–8 per side',why:'Practice controlled hip motion before lower-body training or grappling.',how:'Hold a wall or bench and make small smooth circles.',next:'Gradually enlarge the circle while keeping control.'},
    hinge: {name:'Unloaded hip hinges',dose:'8 reps',why:'Rehearse hip movement before loading.',how:'Push hips back with a comfortable neutral trunk and return to standing.',next:'Use a slightly deeper hinge only if comfortable.'},
    scap: {name:'Shoulder blade circles',dose:'8 slow reps',why:'Prepare shoulder blade movement for upper-body work.',how:'Move shoulder blades slowly without shrugging into discomfort.',next:'Try controlled wall slides within a comfortable range.'},
    thoracic: {name:'Gentle thoracic rotations',dose:'5 per side',why:'Prepare upper-back rotation for lifting and grappling.',how:'Rotate through upper back without forcing the neck or lower back.',next:'Increase smooth control before increasing range.'},
    press: {name:'Light movement rehearsal',dose:'1–2 minutes',why:'Practice the first lift without heavy loading.',how:'Use an unloaded or very light version of your first movement.',next:'Build load gradually during your normal warm-up sets.'},
    bridge: {name:'Gentle bridges',dose:'6 reps',why:'Practice controlled hip extension for mat movement.',how:'Lift hips only as far as comfortable, then lower slowly.',next:'Increase control before adding repetitions.'},
    brace: {name:'Gentle abdominal brace with breathing',dose:'5 slow breaths',why:'Practice trunk control before hinging.',how:'Breathe normally while gently tightening your midsection; avoid holding your breath.',next:'Practice the same control in an unloaded hinge.'},
    calfraise: {name:'Supported calf raises',dose:'8 slow reps',why:'Prepare ankle and calf loading.',how:'Hold a support and rise onto toes slowly; keep the motion comfortable.',next:'Add control before adding repetitions.'},
    balance: {name:'Supported single-leg balance',dose:'15 seconds each',why:'Prepare foot and ankle control.',how:'Stand near a stable support and lightly hold it as needed.',next:'Reduce hand support only when steady.'},
    adductor: {name:'Gentle adductor rock-backs',dose:'6 each side',why:'Explore controlled inner-thigh and hip movement.',how:'From hands and knees, extend one leg sideways and rock back slightly within comfort.',next:'Gradually improve control rather than forcing stretch depth.'},
    wallslide: {name:'Comfortable wall slides',dose:'6 slow reps',why:'Practice coordinated shoulder blade motion.',how:'Slide arms up a wall only through a comfortable, non-pinching range.',next:'Increase range only when consistently comfortable.'},
    breathe: {name:'Relaxed breathing',dose:'1 minute',why:'Settle breathing and reduce unnecessary tension.',how:'Breathe slowly in a comfortable position.',next:'Keep this restorative rather than increasing difficulty.'},
    calf: {name:'Gentle calf stretch',dose:'20–30 seconds each',why:'Ease calf tightness after activity.',how:'Hold a comfortable stretch with heel supported; avoid bouncing.',next:'Extend the hold slightly if comfortable.'},
    open: {name:'Supported hip flexor stretch',dose:'20–30 seconds each',why:'Provide gentle hip extension after training.',how:'Use a supported split stance, slight pelvic tuck, and light stretch.',next:'Improve positioning rather than forcing depth.'}
  };
  let prepLog={};
  try{prepLog=JSON.parse(localStorage.getItem(PREP_KEY)||'{}')||{}}catch(e){}
  // Classify by the actual exercise mix first; day titles only break ties.
  const DAY_TYPES=['lower','upper','posterior','ankle','hip','shoulder','mobility','bjj','mixed'];
  function prepDayType(programKey,dayKey,day){
    const title=(dayKey+' '+(day.name||'')).toLowerCase();
    const names=Object.values(day).filter(Array.isArray).flat().map(x=>(x.name||'').toLowerCase());
    const meaningful=names.filter(x=>!/^(rest|stationary bike|stationary bike \\(gym alternative\\)|warm.?up|walking)$/.test(x));
    const count=(rx)=>meaningful.filter(x=>rx.test(x)).length;
    const lower=count(/squat|step.?up|lunge|split squat|calf|tibialis|knee|leg extension|leg curl|poliquin|kot |fhl /);
    const upper=count(/press|pull.?up|chin.?up|row|dip|push.?up|tricep|bicep|shoulder|overhead|pullover/);
    const posterior=count(/deadlift|romanian|nordic|hamstring|back extension|good.?morning|jefferson|hinge|glute|hip thrust/);
    const ankle=count(/ankle|tibialis|calf|foot|toe|achilles/);
    const hip=count(/groin|adductor|pigeon|pancake|hip flexor|copenhagen|butterfly/);
    const shoulder=count(/shoulder|rotator|scapula|overhead/);
    const mobility=count(/stretch|mobility|rotation|pigeon|pancake|couch|floss|pulse|flexibility/);
    const athletic=count(/jump|plyometric|depth drop|power clean|elasticity|rhythm/);
    if(/bjj|grappl|wrestl|martial/.test(title))return 'bjj';
    if(/\brest\b/.test(title) && meaningful.length===0)return 'mobility';
    if(/mobility|weak.links|stretch/.test(title) && mobility>=Math.max(1,meaningful.length*.45))return 'mobility';
    if(/ankle|foot ability/.test(title) && ankle>=2)return 'ankle';
    if(/hip|groin/.test(title) && hip>=2)return 'hip';
    if(/shoulder/.test(title) && shoulder>=2)return 'shoulder';
    if(/posterior|deadlift|hamstring/.test(title) && posterior>=2)return 'posterior';
    if(athletic>=2 && lower>=upper)return 'lower';
    if(lower>=2 && upper>=2 && Math.min(lower,upper)/Math.max(lower,upper)>=.45)return 'mixed';
    if(posterior>=2 && posterior>=lower && posterior>upper)return 'posterior';
    if(lower>upper && lower>0)return 'lower';
    if(upper>lower && upper>0)return shoulder>=2 && shoulder>=upper*.5?'shoulder':'upper';
    if(mobility>=2 && mobility>=meaningful.length*.4)return 'mobility';
    if(ankle>=2)return 'ankle';
    if(hip>=2)return 'hip';
    if(/upper|chest|arms/.test(title))return 'upper';
    if(/lower|leg|knees|dunk/.test(title))return 'lower';
    return 'mixed';
  }
  const PREP_PLANS={
    upper:{warm:['ninety','bike','scap','thoracic','press'],cool:['scap','breathe']},
    lower:{warm:['ninety','bike','ankle','hip','hinge'],cool:['calf','open','breathe']},
    posterior:{warm:['ninety','bike','hinge','hip','brace'],cool:['breathe','open']},
    ankle:{warm:['ninety','bike','ankle','calfraise','balance'],cool:['calf','breathe']},
    hip:{warm:['ninety','bike','hip','adductor','hinge'],cool:['open','breathe']},
    shoulder:{warm:['ninety','bike','scap','thoracic','wallslide'],cool:['scap','breathe']},
    mobility:{warm:['ninety','bike','hip','thoracic','breathe'],cool:['breathe']},
    bjj:{warm:['ninety','bike','hip','thoracic','bridge'],cool:['hip','breathe']},
    mixed:{warm:['ninety','bike','ankle','scap','hinge'],cool:['calf','breathe']}
  };
  function prepSteps(type,phase){return PREP_PLANS[type]?.[phase]||PREP_PLANS.mixed[phase]}
  function prepKey(sessionId,kind){return new Date().toLocaleDateString('en-CA')+'|'+sessionId+'|'+kind}
  function prepEntry(id){return prepLog[id]||{checked:[],notes:''}}
  function savePrep(){try{localStorage.setItem(PREP_KEY,JSON.stringify(prepLog))}catch(e){console.warn('Preparation save failed',e)}}
  function renderPrep(sessionId,type,phase){
    const warm=prepSteps(type,'warm');
    const cool=prepSteps(type,'cool');
    const group=(kind,ids,title,description)=>{
      const key=prepKey(sessionId,kind),state=prepEntry(key);
      return `<details class="prep-group">
        <summary><strong>${title}</strong> <span class="muted">· ${state.checked.length}/${ids.length} checked</span></summary>
        <p class="note">${description}</p>
        ${ids.map((id,i)=>{const ex=prepLibrary[id];return `<div class="prep-move">
          <label class="prep-check"><input type="checkbox" data-prep-key="${escapeHtml(key)}" data-prep-index="${i}" ${state.checked.includes(i)?'checked':''}><span>${escapeHtml(ex.name)} <small class="muted">· ${escapeHtml(ex.dose)}</small></span></label>
          <details class="prep-how"><summary>Why · How · Progress</summary><p><b>Why:</b> ${escapeHtml(ex.why)}</p><p><b>How:</b> ${escapeHtml(ex.how)}</p><p><b>When comfortable:</b> ${escapeHtml(ex.next)}</p></details>
        </div>`}).join('')}
        <label class="prep-note-label">How did it feel? <input type="text" data-prep-note="${escapeHtml(key)}" placeholder="Optional: stiffness, pain, modifications" value="${escapeHtml(state.notes||'')}"></label>
      </details>`;
    };
    return phase==='warm' ? `<div class="prep-wrap">${group('warm',warm,'Prepare · 5–8 min','Suggested preparation for this workout. Skip or modify movements that provoke symptoms.')}<div class="prep-strength-title">Exercises</div></div>` : `<div class="prep-wrap">${group('cool',cool,'Optional cooldown · 3–5 min','Gentle movement after training; not required to complete the workout.')}</div>`;
  }
  function attachPrepListeners(){
    workoutDisplay.querySelectorAll('[data-prep-key]').forEach(el=>el.addEventListener('change',()=>{
      const key=el.dataset.prepKey,index=Number(el.dataset.prepIndex),state=prepEntry(key);
      state.checked=el.checked?[...new Set([...state.checked,index])]:state.checked.filter(i=>i!==index);
      prepLog[key]=state;savePrep();
      const summary=el.closest('.prep-group')?.querySelector('summary .muted');
      if(summary)summary.textContent='· '+state.checked.length+'/'+el.closest('.prep-group').querySelectorAll('[data-prep-key]').length+' checked';
    }));
    workoutDisplay.querySelectorAll('[data-prep-note]').forEach(el=>el.addEventListener('input',()=>{
      const key=el.dataset.prepNote,state=prepEntry(key);state.notes=el.value;prepLog[key]=state;savePrep();
    }));
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
    workoutDisplay.querySelector('#day-select')?.addEventListener('change', e => {
      currentDay = e.target.value;
      localStorage.setItem('workout_programs_day_'+currentProgram+'_'+currentWorkout, currentDay);
      renderWorkout();
    });
    workoutDisplay.querySelector('#log-date')?.addEventListener('change', e => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return;
      selectedDate = e.target.value;
      renderWorkout();
    });
    workoutDisplay.querySelectorAll('[data-id][data-field]').forEach(input => {
      input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', e => {
        const {id,field,index} = e.target.dataset;
        const ex = WORKOUT_PROGRAMS[currentProgram].days[currentDay][e.target.closest('.exercise-card').dataset.section][Number(e.target.closest('.exercise-card').dataset.exerciseIndex)];
        const entry = editExerciseEntry(id, ex);
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        if (index !== undefined) entry.sets[Number(index)][field] = value;
        else entry[field] = value;
        saveData(STORAGE_KEY, userData);
        if (field === 'done') {
          e.target.closest('.set-row')?.classList.toggle('checked', value);
          e.target.closest('.exercise-card')?.classList.toggle('completed', entry.sets.length > 0 && entry.sets.every(set => set.done));
        }
      });
    });
    workoutDisplay.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
      const {id,action,index} = button.dataset;
      const card = button.closest('.exercise-card');
      const ex = WORKOUT_PROGRAMS[currentProgram].days[currentDay][card.dataset.section][Number(card.dataset.exerciseIndex)];
      const entry = editExerciseEntry(id, ex);
      if (action === 'add') entry.sets.push({reps:'',weight:'',notes:'',done:false});
      if (action === 'remove' && entry.sets.length > 1) entry.sets.splice(Number(index),1);
      saveData(STORAGE_KEY,userData);
      renderWorkout();
    }));
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

    let html = `<h2 style="margin:0 0 6px">${escapeHtml(programData.name || currentProgram)}</h2><p class="muted" style="margin:0 0 16px">Choose a day and log each set as you complete it.</p>`;

    const dayKeys = Object.keys(programData.days || {});

    if (!dayKeys.length) {
      workoutDisplay.innerHTML = '<p class="muted">No workout days found for this program.</p>';
      return;
    }

    const preferredDay = localStorage.getItem('workout_programs_day_'+currentProgram+'_'+currentWorkout);
    if (!dayKeys.includes(currentDay)) currentDay = dayKeys.includes(preferredDay) ? preferredDay : dayKeys[0];
    html += `<div class="workout-toolbar"><label for="day-select">Training day<select id="day-select">${dayKeys.map(key => `<option value="${escapeHtml(key)}" ${key===currentDay?'selected':''}>${escapeHtml(programData.days[key].name || key)}</option>`).join('')}</select></label><label for="log-date">Log date<input id="log-date" type="date" value="${selectedDate}"></label></div>`;

    dayKeys.filter(key => key === currentDay).forEach(dayKey => {
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

      html += renderPrep(sessionId,prepDayType(currentProgram,dayKey,day),'warm');

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
          const saved = getExerciseEntry(id, ex);
          const previous = previousEntry(id);
          const field = (key,placeholder,value,index) => `<input type="text" aria-label="${escapeHtml(ex.name)} set ${index+1} ${key}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value || '')}" data-id="${escapeHtml(id)}" data-index="${index}" data-field="${key}">`;
          html += `
            <div class="exercise-card ${saved.sets.length && saved.sets.every(set => set.done) ? 'completed' : ''}" data-section="${escapeHtml(sectionKey)}" data-exercise-index="${idx}">
              <div class="exercise-top">
                <div><strong>${escapeHtml(ex.name || '')}</strong><div class="exercise-target">Target: ${prescribedSetCount(ex)} set${prescribedSetCount(ex)===1?'':'s'} · ${escapeHtml(ex.reps || 'as prescribed')}</div>${ex.notes ? `<div class="note">${escapeHtml(ex.notes)}</div>` : ''}</div>
              </div>
              ${previous ? `<div class="previous-log">${escapeHtml(previous)}</div>` : ''}
              <div class="set-list">${saved.sets.map((set,i) => `<div class="set-row ${set.done?'checked':''}">
                <label class="set-check">${i+1}<input type="checkbox" aria-label="${escapeHtml(ex.name)} set ${i+1} complete" data-id="${escapeHtml(id)}" data-index="${i}" data-field="done" ${set.done?'checked':''}></label>
                <label>Reps / time${field('reps',ex.reps || '—',set.reps,i)}</label>
                <label>Weight (lb)${field('weight','—',set.weight,i)}</label>
                <label class="set-note">Set note${field('notes','Optional',set.notes,i)}</label>
                <button type="button" class="timer-btn remove-set" aria-label="Remove set ${i+1} from ${escapeHtml(ex.name)}" title="Remove set" data-id="${escapeHtml(id)}" data-action="remove" data-index="${i}" ${saved.sets.length===1?'disabled':''}>×</button>
              </div>`).join('')}</div>
              <button type="button" class="timer-btn" data-id="${escapeHtml(id)}" data-action="add">+ Add set</button>
              <label class="exercise-notes">Exercise notes<input type="text" aria-label="${escapeHtml(ex.name)} exercise notes" placeholder="Form, symptoms, or adjustments" value="${escapeHtml(saved.notes || '')}" data-id="${escapeHtml(id)}" data-field="notes"></label>
            </div>`;
        });
        html += `</div></div>`;
      });
      html += renderPrep(sessionId,prepDayType(currentProgram,dayKey,day),'cool');
    });

    workoutDisplay.innerHTML = html;
    attachInputListeners();
    attachPrepListeners();
  }

  // =========================
  // EXPORT / IMPORT / CLEAR DATA
  // =========================

  window.exportWorkoutData = function() {
    const payload = {
      userData,
      sessionData,
      morningData: loadData('morning_mobility_shoulder_v1'),
      mobilityData: loadData('mobility_sessions_v1'),
      prepData: prepLog,
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
        if (parsed.mobilityData && typeof parsed.mobilityData === 'object' && !Array.isArray(parsed.mobilityData)) saveData('mobility_sessions_v1',parsed.mobilityData);
        if (parsed.prepData && typeof parsed.prepData === 'object' && !Array.isArray(parsed.prepData)){prepLog=parsed.prepData;savePrep();}
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
    currentDay = '';
    localStorage.setItem(PREF_KEY,currentProgram);
    updateWorkoutSelector(currentProgram);
    renderWorkout();
  });

  workoutSelect.addEventListener('change', e => {
    currentWorkout = e.target.value;
    currentDay = '';
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
