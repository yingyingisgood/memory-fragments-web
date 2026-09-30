(() => {
  'use strict';

  const stage = document.getElementById('stage');
  const bgA = document.getElementById('backgroundVideoA');
  const bgB = document.getElementById('backgroundVideoB');
  const soundtrack = document.getElementById('soundtrack');
  const fragmentsLayer = document.getElementById('fragments');
  const startHint = document.getElementById('startHint');
  const localTime = document.getElementById('localTime');
  const memoryStatus = document.getElementById('memoryStatus');
  const sceneStatus = document.getElementById('sceneStatus');
  const audioStatus = document.getElementById('audioStatus');

  const BASE = [
    'assets/C4D_01.mp4', 'assets/C4D_02.mp4', 'assets/C4D_03.mp4', 'assets/C4D_04.mp4'
  ];
  const TD = [
    'assets/TD_01.mp4', 'assets/TD_02.mp4', 'assets/TD_03.mp4', 'assets/TD_04.mp4'
  ];
  const AIGC = [
    'assets/AIGC_01.mp4', 'assets/AIGC_02.mp4', 'assets/AIGC_03.mp4', 'assets/AIGC_04.mp4'
  ];

  const MEMORY_NAMES = {
    'C4D_01': 'SYNTHETIC PICNIC',
    'C4D_02': 'GARDEN BEHIND THE CURTAIN',
    'C4D_03': 'WHITE ROOM RESIDUE',
    'C4D_04': 'UNMADE BED',
    'TD_01': 'FRACTURED PASSAGE',
    'TD_02': 'RECURSIVE SURFACE',
    'TD_03': 'WHITE SPIRAL',
    'TD_04': 'AMBER LOOP',
    'AIGC_01': 'INSIDE THE BUBBLE',
    'AIGC_02': 'ROOM OF COLLECTED THINGS',
    'AIGC_03': 'LIBRARY IN BLOOM',
    'AIGC_04': 'THE RED CABINET'
  };

  const MAX_FRAGMENTS = 10;
  const BG_CROSSFADE_MS = 1800;
  const BG_MIN_HOLD_MS = 18000;
  const BG_MAX_HOLD_MS = 28000;
  const MUSIC_VOLUME = 0.34;

  const active = [];
  let clickCount = 0;
  let backgroundIndex = 0;
  let backgroundQueue = [];
  let activeBackground = bgA;
  let standbyBackground = bgB;
  let backgroundTimer = null;
  let zCounter = 10;
  let fragmentSerial = 0;
  let audioCtx = null;
  let audioStarted = false;

  const rand = (min, max) => Math.random() * (max - min) + min;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const pad = n => String(n).padStart(2, '0');

  function filename(src) {
    return src.split('/').pop().replace('.mp4', '');
  }

  function memoryName(src) {
    return MEMORY_NAMES[filename(src)] || 'UNTITLED MEMORY';
  }

  function shuffle(array) {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function updateClock() {
    const d = new Date();
    localTime.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  function updateStatus() {
    const count = active.filter(x => !x.removing).length;
    memoryStatus.textContent = `ACTIVE FRAGMENTS ${pad(count)} / RECALLS ${String(clickCount).padStart(3, '0')}`;
  }

  function refillBackgroundQueue() {
    let next = shuffle(BASE.map((_, i) => i));
    if (next[0] === backgroundIndex && next.length > 1) {
      [next[0], next[1]] = [next[1], next[0]];
    }
    backgroundQueue = next;
  }

  function nextBackgroundIndex() {
    if (!backgroundQueue.length) refillBackgroundQueue();
    let idx = backgroundQueue.shift();
    if (idx === backgroundIndex) {
      if (!backgroundQueue.length) refillBackgroundQueue();
      idx = backgroundQueue.shift();
    }
    return idx;
  }

  function setSceneStatus() {
    sceneStatus.textContent = `BASE MEMORY ${String(backgroundIndex + 1).padStart(2, '0')} / ${memoryName(BASE[backgroundIndex])}`;
  }

  function scheduleBackgroundChange() {
    clearTimeout(backgroundTimer);
    backgroundTimer = setTimeout(changeBackground, rand(BG_MIN_HOLD_MS, BG_MAX_HOLD_MS));
  }

  function startBackground() {
    backgroundIndex = Math.floor(Math.random() * BASE.length);
    refillBackgroundQueue();
    activeBackground.src = BASE[backgroundIndex];
    activeBackground.currentTime = 0;
    activeBackground.play().catch(() => {});
    setSceneStatus();
    scheduleBackgroundChange();
  }

  function changeBackground() {
    const nextIndex = nextBackgroundIndex();
    const nextSrc = BASE[nextIndex];
    const incoming = standbyBackground;
    const outgoing = activeBackground;

    incoming.classList.remove('is-active');
    incoming.src = nextSrc;
    incoming.currentTime = 0;

    const reveal = () => {
      incoming.play().catch(() => {});
      requestAnimationFrame(() => {
        incoming.classList.add('is-active');
        outgoing.classList.remove('is-active');
      });

      setTimeout(() => {
        try { outgoing.pause(); } catch (_) {}
      }, BG_CROSSFADE_MS + 120);

      activeBackground = incoming;
      standbyBackground = outgoing;
      backgroundIndex = nextIndex;
      setSceneStatus();
      scheduleBackgroundChange();
    };

    if (incoming.readyState >= 2) reveal();
    else incoming.addEventListener('canplay', reveal, { once: true });
  }

  function ensureAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  }

  function startSoundtrack() {
    if (audioStarted) return;
    audioStarted = true;
    soundtrack.volume = 0;
    soundtrack.play().then(() => {
      audioStatus.textContent = 'AUDIO / ON / LOOP';
      const start = performance.now();
      const fadeMs = 1800;
      const fade = now => {
        const t = Math.min(1, (now - start) / fadeMs);
        soundtrack.volume = MUSIC_VOLUME * t;
        if (t < 1) requestAnimationFrame(fade);
      };
      requestAnimationFrame(fade);
    }).catch(() => {
      audioStarted = false;
      audioStatus.textContent = 'AUDIO / CLICK TO START';
    });
  }

  function playRecallClick() {
    ensureAudioContext();
    if (!audioCtx) return;

    // Short system-error style signal: two clipped, slightly dissonant pulses.
    // Synthesised in-browser so every click stays immediate and lightweight.
    const now = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.17, now + 0.004);
    master.gain.setValueAtTime(0.17, now + 0.16);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    master.connect(audioCtx.destination);

    const makePulse = (startAt, baseFreq, duration, volume) => {
      const oscA = audioCtx.createOscillator();
      const oscB = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      oscA.type = 'square';
      oscB.type = 'square';
      oscA.frequency.setValueAtTime(baseFreq, startAt);
      oscB.frequency.setValueAtTime(baseFreq * 1.18, startAt); // deliberate digital dissonance
      oscA.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, startAt + duration);
      oscB.frequency.exponentialRampToValueAtTime(baseFreq * 0.78, startAt + duration);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, startAt);
      filter.frequency.exponentialRampToValueAtTime(1150, startAt + duration);
      filter.Q.value = 1.2;

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(volume, startAt + 0.004);
      gain.gain.setValueAtTime(volume, startAt + Math.max(0.01, duration - 0.025));
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      oscA.connect(gain);
      oscB.connect(gain);
      gain.connect(filter).connect(master);
      oscA.start(startAt); oscB.start(startAt);
      oscA.stop(startAt + duration + 0.01); oscB.stop(startAt + duration + 0.01);
    };

    // First pulse is sharper; second is lower, like a failed operation acknowledgement.
    makePulse(now, 860 + rand(-25, 25), 0.095, 0.13);
    makePulse(now + 0.135, 610 + rand(-20, 20), 0.14, 0.12);

    // Tiny burst of digital noise gives it a broken-interface texture without becoming harsh.
    const noiseDur = 0.045;
    const buffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * noiseDur), audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = audioCtx.createBufferSource();
    const noiseFilter = audioCtx.createBiquadFilter();
    const noiseGain = audioCtx.createGain();
    noise.buffer = buffer;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1850;
    noiseFilter.Q.value = 2.4;
    noiseGain.gain.setValueAtTime(0.035, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDur);
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start(now);
  }

  function weightedPick(items) {
    const total = items.reduce((sum, x) => sum + x.weight, 0);
    let r = Math.random() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item.value;
    }
    return items[items.length - 1].value;
  }

  function chooseSource() {
    const intensity = Math.min(clickCount / 14, 1);
    const category = weightedPick([
      { value: 'c4d', weight: 0.55 - 0.20 * intensity },
      { value: 'td', weight: 0.35 + 0.15 * intensity },
      { value: 'aigc', weight: 0.10 + 0.05 * intensity }
    ]);

    if (category === 'c4d') {
      const choices = BASE.filter((_, i) => i !== backgroundIndex);
      return { category, src: pick(choices) };
    }
    if (category === 'td') return { category, src: pick(TD) };
    return { category, src: pick(AIGC) };
  }

  function categoryLabel(category) {
    if (category === 'c4d') return 'SPATIAL';
    if (category === 'td') return 'INTERRUPT';
    return 'SYNTHETIC';
  }

  function chooseBehaviour() {
    return weightedPick([
      { value: 'emergence', weight: 35 },
      { value: 'drift', weight: 30 },
      { value: 'interruption', weight: 20 },
      { value: 'persistence', weight: 15 }
    ]);
  }

  function sizeFor(category) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const monumental = Math.random() < (category === 'aigc' ? 0.24 : 0.18);
    const geometry = weightedPick([
      { value: { name: 'panoramic', ratio: rand(2.15, 3.15), w: [0.34, 0.66] }, weight: 25 },
      { value: { name: 'landscape', ratio: rand(1.45, 1.90), w: [0.25, 0.50] }, weight: 35 },
      { value: { name: 'compact', ratio: rand(0.92, 1.25), w: [0.18, 0.34] }, weight: 18 },
      { value: { name: 'portrait', ratio: rand(0.52, 0.78), w: [0.13, 0.25] }, weight: 22 }
    ]);

    let width;
    if (monumental) {
      if (geometry.ratio < 0.9) width = rand(vw * 0.30, vw * 0.42);
      else width = rand(vw * 0.58, vw * 0.90);
    } else {
      width = rand(vw * geometry.w[0], vw * geometry.w[1]);
    }

    let height = width / geometry.ratio;
    const maxH = vh * (monumental ? 0.82 : 0.66);
    if (height > maxH) {
      height = maxH;
      width = height * geometry.ratio;
    }
    width = Math.min(width, vw * 0.93);
    return { width, height, monumental, shape: geometry.name };
  }

  function clampPosition(x, y, w, h) {
    const edge = 14;
    return {
      left: Math.max(edge, Math.min(window.innerWidth - w - edge, x - w / 2)),
      top: Math.max(28, Math.min(window.innerHeight - h - edge, y - h / 2))
    };
  }

  function clearRecord(record) {
    try { record.video.pause(); } catch (_) {}
    record.video.removeAttribute('src');
    try { record.video.load(); } catch (_) {}
    record.el.remove();
    const idx = active.indexOf(record);
    if (idx >= 0) active.splice(idx, 1);
    updateStatus();
  }

  function fadeAndRemove(record, duration = 500) {
    if (!record || record.removing) return;
    record.removing = true;
    if (record.timer) clearTimeout(record.timer);
    if (record.loadGuard) clearTimeout(record.loadGuard);
    record.shell.animate([
      { opacity: Number(getComputedStyle(record.shell).opacity) || .9, filter: 'blur(0px)' },
      { opacity: 0, filter: 'blur(4px)' }
    ], { duration, easing: 'ease-in', fill: 'forwards' });
    setTimeout(() => clearRecord(record), duration + 40);
  }

  function enforceLimit() {
    while (active.filter(x => !x.removing).length >= MAX_FRAGMENTS) {
      const oldest = active.find(x => !x.removing);
      if (!oldest) break;
      fadeAndRemove(oldest, 380);
    }
  }

  function categoryOpacity(category) {
    if (category === 'aigc') return rand(.74, .92);
    if (category === 'td') return rand(.82, 1);
    return rand(.88, 1);
  }

  function animateFragment(record, behaviour, lifetime, monumental) {
    if (record.loadGuard) {
      clearTimeout(record.loadGuard);
      record.loadGuard = null;
    }
    const el = record.el;
    const shell = record.shell;
    const startScale = monumental ? rand(1.03, 1.10) : rand(.96, 1.04);
    const endScale = monumental ? rand(.10, .18) : rand(.16, .30);
    const peakOpacity = categoryOpacity(record.category);

    record.lifeAnim = shell.animate([
      { offset: 0, opacity: 0, transform: `scale(${startScale * 1.04})`, filter: 'blur(5px)' },
      { offset: .07, opacity: peakOpacity, transform: `scale(${startScale})`, filter: 'blur(0px)' },
      { offset: .72, opacity: peakOpacity * .94, transform: `scale(${Math.max(endScale * 2.1, .42)})`, filter: 'blur(0px)' },
      { offset: 1, opacity: 0, transform: `scale(${endScale})`, filter: 'blur(3px)' }
    ], { duration: lifetime, easing: 'cubic-bezier(.18,.72,.20,1)', fill: 'forwards' });

    const dx = behaviour === 'interruption' ? rand(-45, 45) : rand(-150, 150);
    const dy = behaviour === 'interruption' ? rand(-35, 35) : rand(-105, 105);
    record.motion = el.animate([
      { transform: 'translate3d(0,0,0)' },
      { transform: `translate3d(${dx}px, ${dy}px, 0)` }
    ], { duration: lifetime, easing: behaviour === 'drift' ? 'ease-in-out' : 'cubic-bezier(.2,.6,.2,1)', fill: 'forwards' });

    if (behaviour === 'interruption') {
      const flashes = Math.floor(rand(2, 5));
      const keyframes = [{ opacity: peakOpacity }];
      for (let i = 0; i < flashes; i++) {
        keyframes.push({ opacity: rand(.22, .5) });
        keyframes.push({ opacity: peakOpacity });
      }
      shell.animate(keyframes, { duration: rand(650, 1250), delay: rand(180, 700), easing: 'steps(1, end)' });
    }
    record.timer = setTimeout(() => clearRecord(record), lifetime + 80);
  }

  function fragmentMarkup(category, src, serial) {
    const recall = rand(31, 96);
    const decay = 100 - recall;
    const id = `M-${String(serial).padStart(3, '0')}`;
    return `
      <div class="fragment-shell">
        <div class="fragment-data">
          <span class="memory-name">${memoryName(src)}</span>
          <span class="memory-id">${id}</span>
          <span class="memory-kind">${categoryLabel(category)}</span>
          <span class="memory-pct">RECALL ${recall.toFixed(1)}%</span>
          <span class="memory-decay">DECAY ${decay.toFixed(1)}%</span>
        </div>
        <div class="fragment-media">
          <video muted loop playsinline preload="auto"></video>
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner br"></i><i class="corner bl"></i>
          <i class="scanline"></i>
        </div>
      </div>`;
  }

  function spawnFragment(clientX, clientY) {
    clickCount += 1;
    fragmentSerial += 1;
    startHint.classList.add('hidden');
    enforceLimit();

    const { category, src } = chooseSource();
    const behaviour = chooseBehaviour();
    const size = sizeFor(category);
    const centreBias = size.monumental ? .68 : .10;
    const targetX = clientX * (1 - centreBias) + (window.innerWidth / 2) * centreBias;
    const targetY = clientY * (1 - centreBias) + (window.innerHeight / 2) * centreBias;
    const offset = Math.min(window.innerWidth, window.innerHeight) * (size.monumental ? .025 : .075);
    const pos = clampPosition(targetX + rand(-offset, offset), targetY + rand(-offset, offset), size.width, size.height);

    const el = document.createElement('div');
    el.className = `fragment ${category} shape-${size.shape}`;
    el.style.width = `${size.width}px`;
    el.style.height = `${size.height}px`;
    el.style.left = `${pos.left}px`;
    el.style.top = `${pos.top}px`;
    el.style.zIndex = String(++zCounter);
    el.innerHTML = fragmentMarkup(category, src, fragmentSerial);

    const shell = el.querySelector('.fragment-shell');
    const video = el.querySelector('video');

    // GitHub Pages / network-safe fragment playback:
    // append first, request the file, wait until the first frame is available,
    // then start the visual lifetime. This avoids showing a black fragment while
    // the browser is still fetching or seeking the MP4 over HTTP.
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'auto';

    fragmentsLayer.appendChild(el);

    let lifetime;
    if (behaviour === 'persistence') lifetime = rand(12500, 18000);
    else if (behaviour === 'interruption') lifetime = rand(5200, 8800);
    else if (category === 'aigc') lifetime = rand(6500, 10500);
    else lifetime = rand(8000, 14500);

    const record = { el, shell, video, category, behaviour, removing: false, timer: null, started: false };
    active.push(record);
    updateStatus();

    const startFragment = () => {
      if (record.removing || record.started) return;
      record.started = true;
      video.play().then(() => {
        // Start the shrink / decay only after playback has actually begun.
        animateFragment(record, behaviour, lifetime, size.monumental);
      }).catch(() => {
        // A muted video should normally autoplay after a pointer interaction,
        // but if a browser still refuses it, keep the frame visible and retry
        // briefly rather than leaving a permanent black rectangle.
        setTimeout(() => {
          if (record.removing) return;
          video.play().then(() => {
            animateFragment(record, behaviour, lifetime, size.monumental);
          }).catch(() => fadeAndRemove(record, 450));
        }, 250);
      });
    };

    const failFragment = () => {
      console.warn('Memory fragment failed to load:', src, video.error || 'unknown media error');
      fadeAndRemove(record, 350);
    };

    video.addEventListener('error', failFragment, { once: true });
    video.addEventListener('loadeddata', startFragment, { once: true });
    video.addEventListener('canplay', startFragment, { once: true });

    // Use the beginning of the clip for the first network frame. Random seeking
    // immediately after metadata can trigger an additional HTTP range request and
    // is a common cause of temporary black frames on static hosts.
    video.src = src;
    video.currentTime = 0;
    video.load();

    if (video.readyState >= 2) startFragment();

    // If a slow connection never reaches loadeddata/canplay, remove the fragment
    // cleanly instead of leaving a black box on screen indefinitely.
    record.loadGuard = setTimeout(() => {
      if (!record.started && !record.removing) {
        console.warn('Memory fragment timed out while loading:', src);
        fadeAndRemove(record, 350);
      }
    }, 10000);
  }

  stage.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    ensureAudioContext();
    startSoundtrack();
    playRecallClick();
    spawnFragment(event.clientX, event.clientY);
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      activeBackground.pause();
      standbyBackground.pause();
      soundtrack.pause();
      active.forEach(x => x.video.pause());
    } else {
      activeBackground.play().catch(() => {});
      if (audioStarted) soundtrack.play().catch(() => {});
      active.forEach(x => x.video.play().catch(() => {}));
    }
  });

  window.addEventListener('resize', () => {
    active.forEach(record => {
      const rect = record.el.getBoundingClientRect();
      const pos = clampPosition(rect.left + rect.width / 2, rect.top + rect.height / 2, rect.width, rect.height);
      record.el.style.left = `${pos.left}px`;
      record.el.style.top = `${pos.top}px`;
    });
  });

  startBackground();
  updateStatus();
})();
