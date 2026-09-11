(() => {
  'use strict';

  /* ---------------------------------------------------------------------
   * Storage
   * ------------------------------------------------------------------- */
  const DEFAULT_DIALS = [
    { id: 'd1', name: 'YouTube', url: 'https://youtube.com' },
    { id: 'd2', name: 'GitHub', url: 'https://github.com' },
    { id: 'd3', name: 'Gmail', url: 'https://mail.google.com' },
    { id: 'd4', name: 'Reddit', url: 'https://reddit.com' },
    { id: 'd5', name: 'Wikipedia', url: 'https://wikipedia.org' },
  ];

  const WIDGET_DEFAULTS = {
    weather: { x: 12, y: 8, w: 190, h: 60, enabled: true, anchor: 'topleft' },
    clock: { x: 50, y: 20, w: 560, h: 220, enabled: true, anchor: 'center' },
    worldclock: { x: 50, y: 35, w: 420, h: 76, enabled: false, anchor: 'center' },
    search: { x: 50, y: 44, w: 640, h: 60, enabled: true, anchor: 'center' },
    dials: { x: 50, y: 64, w: 760, h: 240, enabled: true, anchor: 'center' },
    news: { x: 80, y: 26, w: 270, h: 300, enabled: true, anchor: 'center' },
    stocks: { x: 80, y: 64, w: 270, h: 220, enabled: false, anchor: 'center' },
  };
  const WIDGET_LABELS = {
    weather: 'Weather', clock: 'Clock', worldclock: 'World clock', search: 'Search bar',
    dials: 'Speed dial grid', news: 'News', stocks: 'Markets',
  };

  const DEFAULT_SETTINGS = {
    accent: 'magenta',
    customAccentA: '#ff4d8d',
    customAccentB: '#4de8ff',
    background: 'grid',
    engine: 'brave',
    userName: '',
    wallpaperDim: 0.45,
    weatherCity: '',
    weatherLabel: '',
    weatherLat: null,
    weatherLon: null,
    weatherUnit: 'c',
    musicVolume: 0.7,
    musicMuted: false,
    musicIndex: 0,
    clockStyle: 'digital',
    weatherWidgetMode: 'simple',
    fontTheme: 'default',
    dateColor: '',
    greetingColor: '',
    widgets: JSON.parse(JSON.stringify(WIDGET_DEFAULTS)),
    newsFeeds: [
      { label: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
      { label: 'Hacker News', url: 'https://hnrss.org/frontpage' },
    ],
    finnhubKey: '',
    twelvedataKey: '',
    stockProvider: 'finnhub',
    stockRefreshMinutes: 10,
    stockTickers: ['AAPL', 'GOOGL', 'TSLA'],
    weatherSource: 'openmeteo',
    worldClockCities: [],
    worldClockStyle: 'classic',
    currencyProvider: 'frankfurter',
    currencyPairs: [{ from: 'USD', to: 'EUR' }, { from: 'USD', to: 'GBP' }],
    goldProvider: 'goldprice',
    goldCurrency: 'USD',
    goldEnabled: false,
  };

  const DEFAULT_STATE = {
    dials: DEFAULT_DIALS,
    settings: DEFAULT_SETTINGS,
    notes: '',
    todos: [],
    weather: null,
    weatherDetail: null,
    weatherWeek: null,
    tracks: [],
    news: null,
    stocks: null,
    currency: null,
    gold: null,
  };

  const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const STORAGE_KEYS = ['dials', 'settings', 'notes', 'todos', 'weather', 'weatherDetail', 'weatherWeek', 'tracks', 'news', 'stocks', 'currency', 'gold'];

  function storageGet() {
    return new Promise((resolve) => {
      if (hasChromeStorage) {
        chrome.storage.local.get(STORAGE_KEYS, (res) => {
          resolve({
            dials: res.dials || DEFAULT_STATE.dials,
            settings: {
              ...DEFAULT_SETTINGS,
              ...(res.settings || {}),
              widgets: { ...JSON.parse(JSON.stringify(WIDGET_DEFAULTS)), ...((res.settings || {}).widgets || {}) },
            },
            notes: res.notes || '',
            todos: res.todos || [],
            weather: res.weather || null,
            weatherDetail: res.weatherDetail || null,
            weatherWeek: res.weatherWeek || null,
            tracks: res.tracks || [],
            news: res.news || null,
            stocks: res.stocks || null,
            currency: res.currency || null,
            gold: res.gold || null,
          });
        });
      } else {
        // Fallback for previewing outside an installed extension context.
        try {
          const raw = window.localStorage.getItem('gx-dial-state');
          const parsed = raw ? JSON.parse(raw) : {};
          resolve({
            dials: parsed.dials || DEFAULT_STATE.dials,
            settings: {
              ...DEFAULT_SETTINGS,
              ...(parsed.settings || {}),
              widgets: { ...JSON.parse(JSON.stringify(WIDGET_DEFAULTS)), ...((parsed.settings || {}).widgets || {}) },
            },
            notes: parsed.notes || '',
            todos: parsed.todos || [],
            weather: parsed.weather || null,
            weatherDetail: parsed.weatherDetail || null,
            weatherWeek: parsed.weatherWeek || null,
            tracks: parsed.tracks || [],
            news: parsed.news || null,
            stocks: parsed.stocks || null,
            currency: parsed.currency || null,
            gold: parsed.gold || null,
          });
        } catch (e) {
          resolve(DEFAULT_STATE);
        }
      }
    });
  }

  function storageSet(partial) {
    if (hasChromeStorage) {
      chrome.storage.local.set(partial);
    } else {
      try {
        const raw = window.localStorage.getItem('gx-dial-state');
        const current = raw ? JSON.parse(raw) : {};
        window.localStorage.setItem('gx-dial-state', JSON.stringify({ ...current, ...partial }));
      } catch (e) { /* ignore */ }
    }
  }

  let state = DEFAULT_STATE;

  /* ---------------------------------------------------------------------
   * Local asset storage (IndexedDB — wallpaper video/image and music
   * files can be large, so they're kept out of chrome.storage.local
   * and read back as blobs). One DB, two object stores.
   * ------------------------------------------------------------------- */
  const WP_DB_NAME = 'dial-wallpaper-db';
  const WP_STORE = 'wallpaper';
  const TRACKS_STORE = 'tracks';
  let wpDbPromise = null;

  function openWpDb() {
    if (wpDbPromise) return wpDbPromise;
    wpDbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { resolve(null); return; }
      const req = indexedDB.open(WP_DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(WP_STORE)) db.createObjectStore(WP_STORE);
        if (!db.objectStoreNames.contains(TRACKS_STORE)) db.createObjectStore(TRACKS_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return wpDbPromise;
  }

  async function saveWallpaperBlob(blob, kind) {
    const db = await openWpDb();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction(WP_STORE, 'readwrite');
      tx.objectStore(WP_STORE).put({ blob, kind }, 'current');
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  }

  async function loadWallpaperBlob() {
    const db = await openWpDb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(WP_STORE, 'readonly');
      const req = tx.objectStore(WP_STORE).get('current');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async function clearWallpaperBlob() {
    const db = await openWpDb();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction(WP_STORE, 'readwrite');
      tx.objectStore(WP_STORE).delete('current');
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  }

  async function saveTrackBlob(id, blob) {
    const db = await openWpDb();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction(TRACKS_STORE, 'readwrite');
      tx.objectStore(TRACKS_STORE).put(blob, id);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  }

  async function getTrackBlob(id) {
    const db = await openWpDb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(TRACKS_STORE, 'readonly');
      const req = tx.objectStore(TRACKS_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async function deleteTrackBlob(id) {
    const db = await openWpDb();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction(TRACKS_STORE, 'readwrite');
      tx.objectStore(TRACKS_STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  }

  async function clearAllTrackBlobs() {
    const db = await openWpDb();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction(TRACKS_STORE, 'readwrite');
      tx.objectStore(TRACKS_STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  }

  /* ---------------------------------------------------------------------
   * Clock + greeting (with selectable clock-face styles)
   * ------------------------------------------------------------------- */
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('dateLine');
  const greetingEl = document.getElementById('greeting');
  const clockDigitalEl = document.getElementById('clockDigital');
  const clockNixieEl = document.getElementById('clockNixie');
  const clockAnalogEl = document.getElementById('clockAnalog');
  const clockFlipEl = document.getElementById('clockFlip');
  const clockLedEl = document.getElementById('clockLed');
  const clockMinimalEl = document.getElementById('clockMinimal');
  const ledDigitsEl = document.getElementById('ledDigits');
  const minimalTimeEl = document.getElementById('minimalTime');
  const analogHour = document.getElementById('analogHour');
  const analogMinute = document.getElementById('analogMinute');
  const analogSecond = document.getElementById('analogSecond');
  const analogTicksG = document.getElementById('analogTicks');

  // Build the 12 tick marks around the analog face once.
  (function buildAnalogTicks() {
    if (!analogTicksG) return;
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30) * (Math.PI / 180);
      const inner = i % 3 === 0 ? 78 : 86;
      const x1 = 100 + inner * Math.sin(angle);
      const y1 = 100 - inner * Math.cos(angle);
      const x2 = 100 + 92 * Math.sin(angle);
      const y2 = 100 - 92 * Math.cos(angle);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(1));
      line.setAttribute('y1', y1.toFixed(1));
      line.setAttribute('x2', x2.toFixed(1));
      line.setAttribute('y2', y2.toFixed(1));
      line.setAttribute('class', 'analog-tick');
      analogTicksG.appendChild(line);
    }
  })();

  function renderDigitGroups(container, hh, mm, ss, tubeClass, colonClass) {
    container.innerHTML = '';
    const groups = [hh, mm, ss];
    groups.forEach((group, gi) => {
      group.split('').forEach((digit) => {
        const tube = document.createElement('div');
        tube.className = tubeClass;
        tube.textContent = digit;
        container.appendChild(tube);
      });
      if (gi < groups.length - 1) {
        const colon = document.createElement('div');
        colon.className = colonClass;
        colon.textContent = ':';
        container.appendChild(colon);
      }
    });
  }

  function applyClockStyle() {
    const style = state.settings.clockStyle || 'digital';
    document.getElementById('clockFace').dataset.style = style;
    clockDigitalEl.classList.toggle('icon-hidden', style !== 'digital');
    clockNixieEl.classList.toggle('icon-hidden', style !== 'nixie');
    clockAnalogEl.classList.toggle('icon-hidden', style !== 'analog');
    clockFlipEl.classList.toggle('icon-hidden', style !== 'flip');
    clockLedEl.classList.toggle('icon-hidden', style !== 'led');
    clockMinimalEl.classList.toggle('icon-hidden', style !== 'minimal');
  }

  function applyTextColors() {
    dateEl.style.color = state.settings.dateColor || '';
    greetingEl.style.color = state.settings.greetingColor || '';
  }

  function tick() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const style = state.settings.clockStyle || 'digital';

    if (style === 'digital') {
      clockEl.textContent = `${hh}:${mm}:${ss}`;
    } else if (style === 'nixie') {
      renderDigitGroups(clockNixieEl, hh, mm, ss, 'nixie-tube', 'nixie-colon');
    } else if (style === 'flip') {
      renderDigitGroups(clockFlipEl, hh, mm, ss, 'flip-card', 'flip-colon');
    } else if (style === 'led') {
      ledDigitsEl.textContent = `${hh}:${mm}:${ss}`;
    } else if (style === 'minimal') {
      minimalTimeEl.textContent = `${hh}:${mm}:${ss}`;
    } else if (style === 'analog') {
      const secDeg = now.getSeconds() * 6;
      const minDeg = now.getMinutes() * 6 + now.getSeconds() * 0.1;
      const hourDeg = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;
      analogSecond.setAttribute('transform', `rotate(${secDeg} 100 100)`);
      analogMinute.setAttribute('transform', `rotate(${minDeg} 100 100)`);
      analogHour.setAttribute('transform', `rotate(${hourDeg} 100 100)`);
    }

    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    const h = now.getHours();
    const period = h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    const name = state.settings.userName ? `, ${state.settings.userName}` : '';
    greetingEl.textContent = `Good ${period}${name}`;

    if ((state.settings.worldClockStyle || 'classic') === 'classic') renderWorldClock(now);
    else tickCarouselTimes(now);
  }

  /* ---------------------------------------------------------------------
   * World clock — alternate timezones with a simple landmark watermark.
   * Pure client-side (Intl API), no network cost at all.
   * ------------------------------------------------------------------- */
  // Photos are hotlinked from Pexels (images.pexels.com) — free to use,
  // no attribution required per Pexels' license. Browsers cache these
  // aggressively, so after the first load they don't get re-fetched on
  // every new tab.
  function pexelsUrl(id) {
    return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=400`;
  }

  const WORLD_CLOCK_CITIES = {
    newyork: { name: 'New York', tz: 'America/New_York', photoId: 5857663 },
    london: { name: 'London', tz: 'Europe/London', photoId: 19396516 },
    paris: { name: 'Paris', tz: 'Europe/Paris', photoId: 1530259 },
    tokyo: { name: 'Tokyo', tz: 'Asia/Tokyo', photoId: 34225939 },
    sydney: { name: 'Sydney', tz: 'Australia/Sydney', photoId: 31726433 },
    dubai: { name: 'Dubai', tz: 'Asia/Dubai', photoId: 1537493 },
    moscow: { name: 'Moscow', tz: 'Europe/Moscow', photoId: 5851303 },
    riodejaneiro: { name: 'Rio de Janeiro', tz: 'America/Sao_Paulo', photoId: 3607628 },
    singapore: { name: 'Singapore', tz: 'Asia/Singapore', photoId: 2434270 },
    losangeles: { name: 'Los Angeles', tz: 'America/Los_Angeles', photoId: 29148031 },
    beijing: { name: 'Beijing', tz: 'Asia/Shanghai', photoId: 1423579 },
    toronto: { name: 'Toronto', tz: 'America/Toronto', photoId: 457937 },
  };

  const worldClockPanel = document.getElementById('worldClockPanel');
  const worldClockCarousel = document.getElementById('worldClockCarousel');
  const worldClockCarouselTrack = document.getElementById('worldClockCarouselTrack');
  const worldClockCitySelect = document.getElementById('worldClockCitySelect');
  const worldClockChipList = document.getElementById('worldClockChipList');

  function buildWorldClockCitySelect() {
    worldClockCitySelect.innerHTML = '';
    Object.entries(WORLD_CLOCK_CITIES).forEach(([id, city]) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = city.name;
      worldClockCitySelect.appendChild(opt);
    });
  }

  function tzOffsetLabel(tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
      const off = parts.find((p) => p.type === 'timeZoneName');
      return off ? off.value : '';
    } catch (e) { return ''; }
  }

  function cityTimeStr(city, now) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: city.tz, hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(now);
    } catch (e) { return '--:--'; }
  }

  function worldClockCardHTML(city, now) {
    return `
      <span class="worldclock-time">${cityTimeStr(city, now)}</span>
      <span class="worldclock-city">${city.name}</span>
      <span class="worldclock-offset">${tzOffsetLabel(city.tz)}</span>
    `;
  }

  function renderWorldClock(now) {
    if (!worldClockPanel) return;
    worldClockPanel.innerHTML = '';
    state.settings.worldClockCities.forEach((id) => {
      const city = WORLD_CLOCK_CITIES[id];
      if (!city) return;
      const card = document.createElement('div');
      card.className = 'worldclock-card';
      card.dataset.city = id;
      card.style.backgroundImage = `linear-gradient(180deg, rgba(16,14,26,0.35), rgba(16,14,26,0.82)), url('${pexelsUrl(city.photoId)}')`;
      card.innerHTML = worldClockCardHTML(city, now);
      worldClockPanel.appendChild(card);
    });
  }

  /* ---- Rotating-door carousel mode ---- */
  let carouselIndex = 0;
  let carouselAnimating = false;

  function visibleCityIds() {
    const cities = state.settings.worldClockCities;
    if (!cities.length) return [];
    if (cities.length <= 2) return cities;
    const a = cities[carouselIndex % cities.length];
    const b = cities[(carouselIndex + 1) % cities.length];
    return [a, b];
  }

  function makeCarouselCard(id, now, doorClass) {
    const city = WORLD_CLOCK_CITIES[id];
    const card = document.createElement('div');
    card.className = 'worldclock-card' + (doorClass ? ` ${doorClass}` : '');
    card.dataset.city = id;
    card.style.backgroundImage = `linear-gradient(180deg, rgba(16,14,26,0.35), rgba(16,14,26,0.82)), url('${pexelsUrl(city.photoId)}')`;
    card.innerHTML = worldClockCardHTML(city, now);
    return card;
  }

  function renderCarousel(now, doorClass) {
    if (!worldClockCarouselTrack) return;
    const ids = visibleCityIds();
    worldClockCarouselTrack.innerHTML = '';
    if (!ids.length) {
      worldClockCarouselTrack.innerHTML = '<p class="hint" style="margin:auto;">Add cities in Settings → World clock.</p>';
      return;
    }
    ids.forEach((id) => worldClockCarouselTrack.appendChild(makeCarouselCard(id, now, doorClass)));
  }

  function tickCarouselTimes(now) {
    if (!worldClockCarouselTrack) return;
    worldClockCarouselTrack.querySelectorAll('.worldclock-card').forEach((card) => {
      const city = WORLD_CLOCK_CITIES[card.dataset.city];
      if (!city) return;
      const timeEl = card.querySelector('.worldclock-time');
      if (timeEl) timeEl.textContent = cityTimeStr(city, now);
    });
  }

  function advanceCarousel(direction) {
    const cities = state.settings.worldClockCities;
    if (cities.length <= 2 || carouselAnimating) return;
    carouselAnimating = true;
    worldClockCarouselTrack.querySelectorAll('.worldclock-card').forEach((c) => c.classList.add('door-out'));
    setTimeout(() => {
      carouselIndex = ((carouselIndex + direction) % cities.length + cities.length) % cities.length;
      renderCarousel(new Date(), 'door-in');
      setTimeout(() => { carouselAnimating = false; }, 400);
    }, 380);
  }

  worldClockCarousel.addEventListener('wheel', (e) => {
    if (state.settings.worldClockCities.length <= 2) return;
    e.preventDefault();
    advanceCarousel(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  function applyWorldClockStyle() {
    const style = state.settings.worldClockStyle || 'classic';
    worldClockPanel.classList.toggle('icon-hidden', style !== 'classic');
    worldClockCarousel.classList.toggle('icon-hidden', style !== 'carousel');
    if (style === 'classic') renderWorldClock(new Date());
    else renderCarousel(new Date());
  }

  document.getElementById('worldClockStyleOptions').querySelectorAll('[data-wcstyle]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.settings.worldClockStyle = chip.dataset.wcstyle;
      storageSet({ settings: state.settings });
      document.getElementById('worldClockStyleOptions').querySelectorAll('[data-wcstyle]').forEach((c) => {
        c.classList.toggle('active', c.dataset.wcstyle === state.settings.worldClockStyle);
      });
      applyWorldClockStyle();
    });
  });

  function renderWorldClockChips() {
    worldClockChipList.innerHTML = '';
    state.settings.worldClockCities.forEach((id, index) => {
      const city = WORLD_CLOCK_CITIES[id];
      if (!city) return;
      const chip = document.createElement('div');
      chip.className = 'ticker-chip';
      chip.innerHTML = `<span>${city.name}</span>`;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        state.settings.worldClockCities.splice(index, 1);
        storageSet({ settings: state.settings });
        renderWorldClockChips();
        carouselIndex = 0;
        applyWorldClockStyle();
      });
      chip.appendChild(removeBtn);
      worldClockChipList.appendChild(chip);
    });
  }

  document.getElementById('worldClockAdd').addEventListener('click', () => {
    const id = worldClockCitySelect.value;
    if (!id || state.settings.worldClockCities.includes(id)) return;
    state.settings.worldClockCities.push(id);
    storageSet({ settings: state.settings });
    renderWorldClockChips();
    applyWorldClockStyle();
  });

  /* ---------------------------------------------------------------------
   * Command bar
   * ------------------------------------------------------------------- */
  const cmdForm = document.getElementById('cmdForm');
  const cmdInput = document.getElementById('cmdInput');
  const engineSelect = document.getElementById('engineSelect');

  const ENGINE_URLS = {
    brave: 'https://search.brave.com/search?q=',
    google: 'https://www.google.com/search?q=',
    ddg: 'https://duckduckgo.com/?q=',
    bing: 'https://www.bing.com/search?q=',
  };

  function looksLikeUrl(v) {
    if (/^https?:\/\//i.test(v)) return true;
    if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(v) && !v.includes(' ')) return true;
    return false;
  }

  cmdForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = cmdInput.value.trim();
    if (!raw) return;
    if (looksLikeUrl(raw)) {
      window.location.href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    } else {
      const base = ENGINE_URLS[engineSelect.value] || ENGINE_URLS.brave;
      window.location.href = base + encodeURIComponent(raw);
    }
  });

  /* ---------------------------------------------------------------------
   * Dial grid
   * ------------------------------------------------------------------- */
  const dialGrid = document.getElementById('dialGrid');
  let dragFromIndex = null;
  let editingId = null;

  function hostnameOf(url) {
    try { return new URL(url).hostname; } catch (e) { return ''; }
  }

  function faviconFor(url) {
    const host = hostnameOf(url);
    return host ? `https://www.google.com/s2/favicons?sz=64&domain=${host}` : '';
  }

  function renderDials() {
    dialGrid.innerHTML = '';
    state.dials.forEach((dial, index) => {
      const tile = document.createElement('a');
      tile.className = 'dial-tile';
      tile.href = dial.url;
      tile.draggable = true;
      tile.dataset.index = String(index);
      tile.style.animationDelay = `${Math.min(index, 10) * 0.03}s`;

      const favWrap = document.createElement('div');
      favWrap.className = 'dial-favicon';
      const favUrl = faviconFor(dial.url);
      if (favUrl) {
        const img = document.createElement('img');
        img.src = favUrl;
        img.alt = '';
        img.loading = 'lazy';
        img.onerror = () => { favWrap.textContent = (dial.name || '?').charAt(0).toUpperCase(); };
        favWrap.appendChild(img);
      } else {
        favWrap.textContent = (dial.name || '?').charAt(0).toUpperCase();
      }

      const nameEl = document.createElement('div');
      nameEl.className = 'dial-name';
      nameEl.textContent = dial.name || hostnameOf(dial.url) || 'Untitled';

      const editBtn = document.createElement('button');
      editBtn.className = 'dial-edit';
      editBtn.type = 'button';
      editBtn.setAttribute('aria-label', `Edit ${dial.name}`);
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openDialModal(dial);
      });

      tile.appendChild(editBtn);
      tile.appendChild(favWrap);
      tile.appendChild(nameEl);

      tile.addEventListener('dragstart', () => {
        dragFromIndex = index;
        tile.classList.add('dragging');
      });
      tile.addEventListener('dragend', () => tile.classList.remove('dragging'));
      tile.addEventListener('dragover', (e) => e.preventDefault());
      tile.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dragFromIndex === null || dragFromIndex === index) return;
        const moved = state.dials.splice(dragFromIndex, 1)[0];
        state.dials.splice(index, 0, moved);
        dragFromIndex = null;
        storageSet({ dials: state.dials });
        renderDials();
      });

      dialGrid.appendChild(tile);
    });

    const addTile = document.createElement('button');
    addTile.className = 'dial-tile dial-add';
    addTile.type = 'button';
    addTile.setAttribute('aria-label', 'Add shortcut');
    addTile.innerHTML = `<div class="dial-favicon">+</div><div class="dial-name">Add</div>`;
    addTile.addEventListener('click', () => openDialModal(null));
    dialGrid.appendChild(addTile);
  }

  /* ---- Add / edit modal ---- */
  const dialModalOverlay = document.getElementById('dialModalOverlay');
  const dialModalTitle = document.getElementById('dialModalTitle');
  const dialNameInput = document.getElementById('dialName');
  const dialUrlInput = document.getElementById('dialUrl');
  const dialSaveBtn = document.getElementById('dialSave');
  const dialCancelBtn = document.getElementById('dialCancel');
  const dialDeleteBtn = document.getElementById('dialDelete');

  function openDialModal(dial) {
    editingId = dial ? dial.id : null;
    dialModalTitle.textContent = dial ? 'Edit shortcut' : 'Add shortcut';
    dialNameInput.value = dial ? dial.name : '';
    dialUrlInput.value = dial ? dial.url : '';
    dialDeleteBtn.hidden = !dial;
    dialModalOverlay.classList.add('show');
    setTimeout(() => dialNameInput.focus(), 0);
  }

  function closeDialModal() {
    dialModalOverlay.classList.remove('show');
    editingId = null;
  }

  function normalizeUrl(v) {
    v = v.trim();
    if (!v) return '';
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  }

  dialSaveBtn.addEventListener('click', () => {
    const name = dialNameInput.value.trim();
    const url = normalizeUrl(dialUrlInput.value);
    if (!url) { dialUrlInput.focus(); return; }

    if (editingId) {
      const target = state.dials.find((d) => d.id === editingId);
      if (target) {
        target.name = name || hostnameOf(url);
        target.url = url;
      }
    } else {
      state.dials.push({
        id: 'd' + Date.now().toString(36),
        name: name || hostnameOf(url),
        url,
      });
    }
    storageSet({ dials: state.dials });
    renderDials();
    closeDialModal();
  });

  dialDeleteBtn.addEventListener('click', () => {
    state.dials = state.dials.filter((d) => d.id !== editingId);
    storageSet({ dials: state.dials });
    renderDials();
    closeDialModal();
  });

  dialCancelBtn.addEventListener('click', closeDialModal);
  dialModalOverlay.addEventListener('click', (e) => {
    if (e.target === dialModalOverlay) closeDialModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialModalOverlay.classList.contains('show')) closeDialModal();
  });

  /* ---------------------------------------------------------------------
   * Drawers (notes / todo / settings)
   * ------------------------------------------------------------------- */
  const scrim = document.getElementById('scrim');
  const drawers = {
    notes: document.getElementById('notesDrawer'),
    todo: document.getElementById('todoDrawer'),
    music: document.getElementById('musicDrawer'),
    weather: document.getElementById('weatherDrawer'),
    cleaner: document.getElementById('cleanerDrawer'),
    monitor: document.getElementById('monitorDrawer'),
    settings: document.getElementById('settingsDrawer'),
  };

  function openDrawer(key) {
    Object.values(drawers).forEach((d) => d.classList.remove('open'));
    drawers[key].classList.add('open');
    scrim.classList.add('show');
  }
  function closeDrawers() {
    Object.values(drawers).forEach((d) => d.classList.remove('open'));
    scrim.classList.remove('show');
  }

  document.getElementById('openNotes').addEventListener('click', () => openDrawer('notes'));
  document.getElementById('openTodo').addEventListener('click', () => openDrawer('todo'));
  document.getElementById('openMusic').addEventListener('click', () => openDrawer('music'));
  document.getElementById('openCleaner').addEventListener('click', () => openDrawer('cleaner'));
  document.getElementById('openMonitor').addEventListener('click', () => openDrawer('monitor'));
  document.getElementById('openSettings').addEventListener('click', () => openDrawer('settings'));
  scrim.addEventListener('click', closeDrawers);
  document.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', closeDrawers));

  /* ---- Notes ---- */
  const notesArea = document.getElementById('notesArea');
  let notesTimer = null;
  notesArea.addEventListener('input', () => {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => storageSet({ notes: notesArea.value }), 300);
  });

  /* ---- Todo ---- */
  const todoForm = document.getElementById('todoForm');
  const todoInput = document.getElementById('todoInput');
  const todoList = document.getElementById('todoList');

  function renderTodos() {
    todoList.innerHTML = '';
    state.todos.forEach((todo) => {
      const li = document.createElement('li');
      li.className = 'todo-item' + (todo.done ? ' done' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = todo.done;
      checkbox.addEventListener('change', () => {
        todo.done = checkbox.checked;
        storageSet({ todos: state.todos });
        renderTodos();
      });

      const span = document.createElement('span');
      span.textContent = todo.text;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'todo-remove';
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', 'Remove task');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        state.todos = state.todos.filter((t) => t.id !== todo.id);
        storageSet({ todos: state.todos });
        renderTodos();
      });

      li.appendChild(checkbox);
      li.appendChild(span);
      li.appendChild(removeBtn);
      todoList.appendChild(li);
    });
  }

  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = todoInput.value.trim();
    if (!text) return;
    state.todos.push({ id: 't' + Date.now().toString(36), text, done: false });
    todoInput.value = '';
    storageSet({ todos: state.todos });
    renderTodos();
  });

  /* ---------------------------------------------------------------------
   * Music player
   * ------------------------------------------------------------------- */
  const audioEl = document.getElementById('musicPlayer');
  const playlistEl = document.getElementById('playlist');
  const playlistEmptyHint = document.getElementById('playlistEmptyHint');
  const playerTrackName = document.getElementById('playerTrackName');
  const playerSeek = document.getElementById('playerSeek');
  const playerCurrentTime = document.getElementById('playerCurrentTime');
  const playerDuration = document.getElementById('playerDuration');
  const playerPrev = document.getElementById('playerPrev');
  const playerPlay = document.getElementById('playerPlay');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const playerNext = document.getElementById('playerNext');
  const playerMute = document.getElementById('playerMute');
  const volIcon = document.getElementById('volIcon');
  const muteIcon = document.getElementById('muteIcon');
  const playerVolume = document.getElementById('playerVolume');
  const addTracksBtn = document.getElementById('addTracksBtn');
  const tracksFile = document.getElementById('tracksFile');
  const musicDot = document.getElementById('musicDot');

  let currentTrackUrl = null;
  let isSeeking = false;

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function cleanTrackName(filename) {
    return filename.replace(/\.[^./]+$/, '');
  }

  function renderPlaylist() {
    playlistEl.innerHTML = '';
    playlistEmptyHint.hidden = state.tracks.length > 0;
    state.tracks.forEach((track, index) => {
      const li = document.createElement('li');
      li.className = 'playlist-item' + (index === state.settings.musicIndex ? ' active' : '');

      const span = document.createElement('span');
      span.textContent = track.name;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'playlist-remove';
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', `Remove ${track.name}`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteTrackBlob(track.id);
        const wasCurrent = index === state.settings.musicIndex;
        state.tracks.splice(index, 1);
        if (wasCurrent) {
          audioEl.pause();
          releaseTrackUrl();
          audioEl.removeAttribute('src');
          playerTrackName.textContent = 'No track selected';
          state.settings.musicIndex = Math.min(index, state.tracks.length - 1);
        } else if (index < state.settings.musicIndex) {
          state.settings.musicIndex -= 1;
        }
        storageSet({ tracks: state.tracks, settings: state.settings });
        renderPlaylist();
      });

      li.appendChild(span);
      li.appendChild(removeBtn);
      li.addEventListener('click', () => loadTrackAtIndex(index, true));
      playlistEl.appendChild(li);
    });
  }

  function releaseTrackUrl() {
    if (currentTrackUrl) {
      URL.revokeObjectURL(currentTrackUrl);
      currentTrackUrl = null;
    }
  }

  async function loadTrackAtIndex(index, autoplay) {
    if (!state.tracks.length) return;
    if (index < 0) index = state.tracks.length - 1;
    if (index >= state.tracks.length) index = 0;
    const track = state.tracks[index];
    const blob = await getTrackBlob(track.id);
    if (!blob) return;
    releaseTrackUrl();
    currentTrackUrl = URL.createObjectURL(blob);
    audioEl.src = currentTrackUrl;
    playerTrackName.textContent = track.name;
    state.settings.musicIndex = index;
    storageSet({ settings: state.settings });
    renderPlaylist();
    if (autoplay) {
      try { await audioEl.play(); } catch (e) { /* blocked or interrupted */ }
      updatePlayIcon();
    }
  }

  function updatePlayIcon() {
    const playing = !audioEl.paused && !audioEl.ended;
    playIcon.classList.toggle('icon-hidden', playing);
    pauseIcon.classList.toggle('icon-hidden', !playing);
    musicDot.hidden = !playing;
  }

  function updateMuteIcon() {
    volIcon.classList.toggle('icon-hidden', audioEl.muted);
    muteIcon.classList.toggle('icon-hidden', !audioEl.muted);
  }

  playerPlay.addEventListener('click', async () => {
    if (!audioEl.src) {
      if (!state.tracks.length) return;
      await loadTrackAtIndex(state.settings.musicIndex || 0, true);
      return;
    }
    if (audioEl.paused) {
      try { await audioEl.play(); } catch (e) { /* blocked or interrupted */ }
    } else {
      audioEl.pause();
    }
    updatePlayIcon();
  });

  playerNext.addEventListener('click', () => loadTrackAtIndex(state.settings.musicIndex + 1, true));
  playerPrev.addEventListener('click', () => loadTrackAtIndex(state.settings.musicIndex - 1, true));

  audioEl.addEventListener('play', updatePlayIcon);
  audioEl.addEventListener('pause', updatePlayIcon);
  audioEl.addEventListener('ended', () => loadTrackAtIndex(state.settings.musicIndex + 1, true));

  audioEl.addEventListener('loadedmetadata', () => {
    playerDuration.textContent = formatTime(audioEl.duration);
  });

  audioEl.addEventListener('timeupdate', () => {
    if (isSeeking) return;
    playerCurrentTime.textContent = formatTime(audioEl.currentTime);
    if (audioEl.duration) playerSeek.value = (audioEl.currentTime / audioEl.duration) * 100;
  });

  playerSeek.addEventListener('input', () => { isSeeking = true; });
  playerSeek.addEventListener('change', () => {
    if (audioEl.duration) audioEl.currentTime = (playerSeek.value / 100) * audioEl.duration;
    isSeeking = false;
  });

  playerVolume.addEventListener('input', () => {
    audioEl.volume = playerVolume.value / 100;
    state.settings.musicVolume = audioEl.volume;
  });
  playerVolume.addEventListener('change', () => storageSet({ settings: state.settings }));

  playerMute.addEventListener('click', () => {
    audioEl.muted = !audioEl.muted;
    state.settings.musicMuted = audioEl.muted;
    storageSet({ settings: state.settings });
    updateMuteIcon();
  });

  addTracksBtn.addEventListener('click', () => tracksFile.click());

  tracksFile.addEventListener('change', async () => {
    const files = Array.from(tracksFile.files || []);
    if (!files.length) return;
    const wasEmpty = state.tracks.length === 0;
    for (const file of files) {
      const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await saveTrackBlob(id, file);
      state.tracks.push({ id, name: cleanTrackName(file.name) });
    }
    storageSet({ tracks: state.tracks });
    renderPlaylist();
    if (wasEmpty) loadTrackAtIndex(0, false);
    tracksFile.value = '';
  });

  /* ---------------------------------------------------------------------
   * Weather — the compact chip always uses Open-Meteo (fast + reliable
   * for a quick glance); the detail drawer's source is swappable, and
   * air quality + moon phase are computed independently of that choice.
   * ------------------------------------------------------------------- */
  const weatherChip = document.getElementById('weatherChip');
  const weatherIcon = document.getElementById('weatherIcon');
  const weatherTemp = document.getElementById('weatherTemp');
  const weatherLoc = document.getElementById('weatherLoc');
  const weatherCityInput = document.getElementById('weatherCityInput');
  const weatherCitySave = document.getElementById('weatherCitySave');
  const weatherUseLocation = document.getElementById('weatherUseLocation');
  const weatherHint = document.getElementById('weatherHint');
  const weatherUnitChips = document.querySelectorAll('[data-unit]');
  const weatherSourceChips = document.querySelectorAll('[data-wxsource]');
  const wxLoadingHint = document.getElementById('wxLoadingHint');

  const WEATHER_CODES = {
    0: ['☀️', 'Clear'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
    45: ['🌫️', 'Fog'], 48: ['🌫️', 'Fog'],
    51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Heavy drizzle'],
    56: ['🌧️', 'Freezing drizzle'], 57: ['🌧️', 'Freezing drizzle'],
    61: ['🌧️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
    66: ['🌧️', 'Freezing rain'], 67: ['🌧️', 'Freezing rain'],
    71: ['❄️', 'Light snow'], 73: ['❄️', 'Snow'], 75: ['❄️', 'Heavy snow'], 77: ['❄️', 'Snow grains'],
    80: ['🌦️', 'Rain showers'], 81: ['🌦️', 'Rain showers'], 82: ['⛈️', 'Violent showers'],
    85: ['🌨️', 'Snow showers'], 86: ['🌨️', 'Snow showers'],
    95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Thunderstorm'], 99: ['⛈️', 'Thunderstorm'],
  };

  function weatherLookup(code, isDay) {
    const entry = WEATHER_CODES[code] || ['🌡️', 'Unknown'];
    if (code === 0 && isDay === 0) return ['🌙', 'Clear'];
    return entry;
  }

  function renderWeatherChip() {
    if (!state.weather) {
      weatherTemp.textContent = 'Set location';
      weatherLoc.textContent = '';
      weatherIcon.textContent = '🌤️';
      return;
    }
    const [icon] = weatherLookup(state.weather.code, state.weather.isDay);
    const unit = state.settings.weatherUnit === 'f' ? '°F' : '°C';
    weatherIcon.textContent = icon;
    weatherTemp.textContent = `${Math.round(state.weather.temp)}${unit}`;
    weatherLoc.textContent = state.settings.weatherLabel || '';
  }

  async function fetchWeatherNow() {
    const { weatherLat: lat, weatherLon: lon, weatherUnit } = state.settings;
    if (lat == null || lon == null) return;
    try {
      const unitParam = weatherUnit === 'f' ? 'fahrenheit' : 'celsius';
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&temperature_unit=${unitParam}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.current) {
        state.weather = {
          temp: data.current.temperature_2m,
          code: data.current.weather_code,
          isDay: data.current.is_day,
          fetchedAt: Date.now(),
        };
        storageSet({ weather: state.weather });
        renderWeatherChip();
        weatherHint.textContent = '';
      }
    } catch (e) {
      weatherHint.textContent = 'Could not reach the weather service.';
    }
    // The Day/Week widget modes show extra data right on the canvas, so
    // they need to be kept fresh on the same schedule — Simple mode never
    // triggers these, keeping the default experience network-light.
    const mode = state.settings.weatherWidgetMode || 'simple';
    if (mode === 'day') fetchWeatherDetailNow();
    if (mode === 'week') fetchWeatherWeekNow();
  }

  async function fetchWeatherWeekNow() {
    const { weatherLat: lat, weatherLon: lon, weatherUnit } = state.settings;
    if (lat == null || lon == null) return;
    try {
      const unitParam = weatherUnit === 'f' ? 'fahrenheit' : 'celsius';
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=${unitParam}&timezone=auto&forecast_days=7`;
      const res = await fetch(url);
      const data = await res.json();
      const daily = data && data.daily;
      if (daily && Array.isArray(daily.time)) {
        state.weatherWeek = {
          days: daily.time.map((date, i) => ({
            date, code: daily.weather_code[i],
            max: daily.temperature_2m_max[i], min: daily.temperature_2m_min[i],
          })),
          fetchedAt: Date.now(),
        };
        storageSet({ weatherWeek: state.weatherWeek });
        renderWxWeek();
      }
    } catch (e) { /* keep showing whatever we already have cached */ }
  }

  function renderWxDay() {
    const unit = state.settings.weatherUnit === 'f' ? '°F' : '°C';
    const wxDayIcon = document.getElementById('wxDayIcon');
    const wxDayTemp = document.getElementById('wxDayTemp');
    const wxDayCond = document.getElementById('wxDayCond');
    const wxDayFeels = document.getElementById('wxDayFeels');
    const wxDayRecap = document.getElementById('wxDayRecap');
    const wxDayStats = document.getElementById('wxDayStats');

    if (!state.weather) {
      wxDayCond.textContent = 'Set location in Settings';
      return;
    }
    const [icon, label] = weatherLookup(state.weather.code, state.weather.isDay);
    wxDayIcon.textContent = icon;
    wxDayTemp.textContent = `${Math.round(state.weather.temp)}${unit}`;
    wxDayCond.textContent = label;

    const d = state.weatherDetail;
    if (!d) {
      wxDayFeels.textContent = '';
      wxDayRecap.textContent = 'Loading today\'s detail…';
      wxDayStats.innerHTML = '';
      return;
    }
    wxDayFeels.textContent = d.feelsLike != null ? `Feels like ${Math.round(d.feelsLike)}${unit}` : '';

    const bits = [];
    bits.push(`${label} throughout the day`);
    if (d.precipProb != null && d.precipProb >= 30) bits.push(`a ${Math.round(d.precipProb)}% chance of rain`);
    if (d.humidity != null && d.humidity >= 70) bits.push('it\'ll feel humid');
    wxDayRecap.textContent = bits.join(', ') + '.';

    const aqi = d.aqi ? d.aqi.aqi : null;
    const stats = [
      ['AQI', aqi != null ? aqi : '–'],
      ['Wind', d.windSpeed != null ? `${Math.round(d.windSpeed)} km/h` : '–'],
      ['Humidity', d.humidity != null ? `${Math.round(d.humidity)}%` : '–'],
    ];
    wxDayStats.innerHTML = stats.map(([label, val]) => `
      <div class="wx-mini-stat"><span class="wx-mini-label">${label}</span><span class="wx-mini-value">${val}</span></div>
    `).join('');
  }

  function renderWxWeek() {
    const unit = state.settings.weatherUnit === 'f' ? '°' : '°';
    const wxWeekDays = document.getElementById('wxWeekDays');
    const week = state.weatherWeek;
    if (!week || !week.days.length) {
      wxWeekDays.innerHTML = '<span class="hint" style="margin:0;">Loading week…</span>';
      return;
    }
    wxWeekDays.innerHTML = week.days.map((day, i) => {
      const [icon] = weatherLookup(day.code, 1);
      const label = i === 0 ? 'Today' : new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' });
      return `
        <div class="wx-week-day">
          <span class="wxwd-label">${label}</span>
          <span class="wxwd-icon">${icon}</span>
          <span class="wxwd-hi">${Math.round(day.max)}${unit}</span>
          <span class="wxwd-lo">${Math.round(day.min)}${unit}</span>
        </div>
      `;
    }).join('');
  }

  function applyWeatherWidgetMode() {
    const mode = state.settings.weatherWidgetMode || 'simple';
    document.getElementById('wxWidget').dataset.mode = mode;
    if (mode === 'day') renderWxDay();
    if (mode === 'week') renderWxWeek();
  }

  function openWeatherDetail() {
    if (state.settings.weatherLat == null) { openDrawer('settings'); return; }
    openDrawer('weather');
    renderWeatherDetail();
    const stale = !state.weatherDetail || (Date.now() - state.weatherDetail.fetchedAt) > 15 * 60 * 1000;
    if (stale) fetchWeatherDetailNow();
  }

  document.getElementById('weatherWidgetModeOptions').querySelectorAll('[data-wxmode]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.settings.weatherWidgetMode = chip.dataset.wxmode;
      const sizeDefaults = {
        simple: { x: 12, y: 8, w: 190, h: 60 },
        day: { x: 15, y: 18, w: 230, h: 210 },
        week: { x: 22, y: 10, w: 380, h: 100 },
      };
      const size = sizeDefaults[chip.dataset.wxmode];
      if (size && state.settings.widgets.weather) {
        Object.assign(state.settings.widgets.weather, size);
      }
      storageSet({ settings: state.settings });
      document.getElementById('weatherWidgetModeOptions').querySelectorAll('[data-wxmode]').forEach((c) => {
        c.classList.toggle('active', c.dataset.wxmode === state.settings.weatherWidgetMode);
      });
      applyWidgetLayout();
      applyWeatherWidgetMode();
      if (chip.dataset.wxmode === 'day' && !state.weatherDetail) fetchWeatherDetailNow();
      if (chip.dataset.wxmode === 'week' && !state.weatherWeek) fetchWeatherWeekNow();
    });
  });

  document.getElementById('wxDayCard').addEventListener('click', openWeatherDetail);
  document.getElementById('wxWeekCard').addEventListener('click', openWeatherDetail);

  async function geocodeAndFetch(cityName) {
    weatherHint.textContent = 'Looking up city…';
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`;
      const res = await fetch(url);
      const data = await res.json();
      const hit = data && data.results && data.results[0];
      if (!hit) {
        weatherHint.textContent = 'City not found — try a different spelling.';
        return;
      }
      state.settings.weatherCity = cityName;
      state.settings.weatherLat = hit.latitude;
      state.settings.weatherLon = hit.longitude;
      state.settings.weatherLabel = [hit.name, hit.country].filter(Boolean).join(', ');
      storageSet({ settings: state.settings });
      await fetchWeatherNow();
    } catch (e) {
      weatherHint.textContent = 'Could not reach the weather service.';
    }
  }

  weatherCitySave.addEventListener('click', () => {
    const v = weatherCityInput.value.trim();
    if (v) geocodeAndFetch(v);
  });
  weatherCityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); weatherCitySave.click(); }
  });

  weatherUseLocation.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      weatherHint.textContent = 'Location isn\'t available in this browser.';
      return;
    }
    weatherHint.textContent = 'Requesting your location…';
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        state.settings.weatherLat = pos.coords.latitude;
        state.settings.weatherLon = pos.coords.longitude;
        state.settings.weatherLabel = 'My location';
        state.settings.weatherCity = '';
        weatherCityInput.value = '';
        storageSet({ settings: state.settings });
        await fetchWeatherNow();
      },
      () => { weatherHint.textContent = 'Location permission was denied.'; },
      { timeout: 10000 },
    );
  });

  weatherUnitChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.settings.weatherUnit = chip.dataset.unit;
      storageSet({ settings: state.settings });
      applySettingsToDom();
      fetchWeatherNow();
      fetchWeatherDetailNow();
    });
  });

  weatherChip.addEventListener('click', openWeatherDetail);

  document.getElementById('wxRefresh').addEventListener('click', () => {
    fetchWeatherNow();
    fetchWeatherDetailNow();
  });

  weatherSourceChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.settings.weatherSource = chip.dataset.wxsource;
      storageSet({ settings: state.settings });
      weatherSourceChips.forEach((c) => c.classList.toggle('active', c.dataset.wxsource === state.settings.weatherSource));
      fetchWeatherDetailNow();
    });
  });

  /* ---- Detail providers: each normalizes to the same shape ---- */
  async function fetchDetailOpenMeteo(lat, lon, unit) {
    const unitParam = unit === 'f' ? 'fahrenheit' : 'celsius';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,visibility,dew_point_2m&daily=uv_index_max,precipitation_probability_max&temperature_unit=${unitParam}&wind_speed_unit=kmh&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    const c = data && data.current;
    if (!c) return null;
    return {
      feelsLike: c.apparent_temperature, humidity: c.relative_humidity_2m,
      cloudCover: c.cloud_cover, windSpeed: c.wind_speed_10m, windDir: c.wind_direction_10m,
      windGust: c.wind_gusts_10m, pressure: c.surface_pressure,
      visibility: c.visibility != null ? c.visibility / 1000 : null,
      dewPoint: c.dew_point_2m,
      uv: data.daily && data.daily.uv_index_max ? data.daily.uv_index_max[0] : null,
      precipProb: data.daily && data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[0] : null,
    };
  }

  async function fetchDetailWttr(lat, lon, unit) {
    const url = `https://wttr.in/~${lat},${lon}?format=j1`;
    const res = await fetch(url);
    const data = await res.json();
    const cur = data && data.current_condition && data.current_condition[0];
    if (!cur) return null;
    const toF = (c) => (c * 9) / 5 + 32;
    const feelsC = parseFloat(cur.FeelsLikeC);
    const dewC = cur.DewPointC != null ? parseFloat(cur.DewPointC) : null;
    return {
      feelsLike: unit === 'f' ? toF(feelsC) : feelsC,
      humidity: parseFloat(cur.humidity),
      cloudCover: parseFloat(cur.cloudcover),
      windSpeed: parseFloat(cur.windspeedKmph),
      windDir: cur.winddirDegree != null ? parseFloat(cur.winddirDegree) : null,
      windGust: cur.WindGustKmph != null ? parseFloat(cur.WindGustKmph) : null,
      uv: cur.uvIndex != null ? parseFloat(cur.uvIndex) : null,
      pressure: parseFloat(cur.pressure),
      visibility: parseFloat(cur.visibility),
      dewPoint: dewC != null ? (unit === 'f' ? toF(dewC) : dewC) : null,
      precipProb: null,
    };
  }

  async function fetchDetailMetno(lat, lon) {
    // Best-effort: Met.no asks API consumers to identify themselves with a
    // custom User-Agent, which browser fetch() can't set — this may get
    // throttled. Included as a genuine third option, not a primary one.
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
    const res = await fetch(url);
    const data = await res.json();
    const ts = data && data.properties && data.properties.timeseries && data.properties.timeseries[0];
    const details = ts && ts.data && ts.data.instant && ts.data.instant.details;
    if (!details) return null;
    return {
      feelsLike: null,
      humidity: details.relative_humidity,
      cloudCover: details.cloud_area_fraction,
      windSpeed: details.wind_speed != null ? details.wind_speed * 3.6 : null,
      windDir: details.wind_from_direction,
      windGust: details.wind_speed_of_gust != null ? details.wind_speed_of_gust * 3.6 : null,
      uv: null,
      pressure: details.air_pressure_at_sea_level,
      visibility: null,
      dewPoint: details.dew_point_temperature,
      precipProb: null,
    };
  }

  async function fetchAqi(lat, lon) {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5`;
    const res = await fetch(url);
    const data = await res.json();
    const c = data && data.current;
    if (!c) return null;
    return { aqi: c.us_aqi, pm25: c.pm2_5 };
  }

  async function fetchWeatherDetailNow() {
    const { weatherLat: lat, weatherLon: lon, weatherUnit } = state.settings;
    if (lat == null || lon == null) return;
    wxLoadingHint.hidden = false;
    wxLoadingHint.textContent = 'Loading detailed forecast…';
    const source = state.settings.weatherSource || 'openmeteo';
    try {
      let detail = null;
      if (source === 'wttr') detail = await fetchDetailWttr(lat, lon, weatherUnit);
      else if (source === 'metno') detail = await fetchDetailMetno(lat, lon);
      else detail = await fetchDetailOpenMeteo(lat, lon, weatherUnit);

      if (!detail) {
        wxLoadingHint.textContent = 'This source didn\'t return data — try another below.';
        return;
      }
      const aqi = await fetchAqi(lat, lon).catch(() => null);
      state.weatherDetail = { ...detail, aqi, fetchedAt: Date.now() };
      storageSet({ weatherDetail: state.weatherDetail });
      renderWeatherDetail();
      if ((state.settings.weatherWidgetMode || 'simple') === 'day') renderWxDay();
    } catch (e) {
      wxLoadingHint.hidden = false;
      wxLoadingHint.textContent = 'Could not reach this source — try another below.';
    }
  }

  function uvLabel(uv) {
    if (uv == null) return '–';
    if (uv < 3) return 'Low';
    if (uv < 6) return 'Moderate';
    if (uv < 8) return 'High';
    if (uv < 11) return 'Very high';
    return 'Extreme';
  }

  function aqiLabel(aqi) {
    if (aqi == null) return ['–', 'var(--muted)'];
    if (aqi <= 50) return ['Good', '#4dff9d'];
    if (aqi <= 100) return ['Moderate', '#ffe066'];
    if (aqi <= 150) return ['Unhealthy (sensitive)', '#ff9d4d'];
    if (aqi <= 200) return ['Unhealthy', '#ff4d6a'];
    if (aqi <= 300) return ['Very unhealthy', '#b14dff'];
    return ['Hazardous', '#8a2b3a'];
  }

  function windDirLabel(deg) {
    if (deg == null) return '';
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  function moonPhaseInfo(date) {
    const synodic = 29.53058867;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    let days = (date.getTime() - knownNewMoon) / 86400000;
    let phase = (days % synodic) / synodic;
    if (phase < 0) phase += 1;
    const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    const idx = Math.round(phase * 8) % 8;
    const illum = Math.round((phase <= 0.5 ? phase * 2 : (1 - phase) * 2) * 100);
    return { icon: icons[idx], name: names[idx], illum };
  }

  function renderWeatherDetail() {
    const unit = state.settings.weatherUnit === 'f' ? '°F' : '°C';
    document.getElementById('wxSummaryIcon').textContent = state.weather ? weatherLookup(state.weather.code, state.weather.isDay)[0] : '🌤️';
    document.getElementById('wxSummaryTemp').textContent = state.weather ? `${Math.round(state.weather.temp)}${unit}` : '–°';
    document.getElementById('wxSummaryLoc').textContent = state.settings.weatherLabel || 'Set a location in Settings';

    const d = state.weatherDetail;
    wxLoadingHint.hidden = !!d;
    if (!d) return;

    document.getElementById('wxFeelsLike').textContent = d.feelsLike != null ? `${Math.round(d.feelsLike)}${unit}` : '–°';
    document.getElementById('wxFeelsNote').textContent = (state.weather && d.feelsLike != null)
      ? (d.feelsLike > state.weather.temp ? 'Feels warmer — likely humidity.' : d.feelsLike < state.weather.temp ? 'Feels cooler — likely wind.' : 'Feels about the same.')
      : '';
    if (d.feelsLike != null) {
      const feelsC = state.settings.weatherUnit === 'f' ? (d.feelsLike - 32) * 5 / 9 : d.feelsLike;
      const pct = Math.max(0, Math.min(100, (feelsC / 40) * 100));
      document.getElementById('wxFeelsMarker').style.left = pct + '%';
    }

    document.getElementById('wxCloud').textContent = d.cloudCover != null ? `${Math.round(d.cloudCover)}%` : '–%';
    document.getElementById('wxCloudFill').style.width = (d.cloudCover != null ? d.cloudCover : 0) + '%';
    document.getElementById('wxPrecip').textContent = d.precipProb != null ? `${Math.round(d.precipProb)}%` : '–%';
    document.getElementById('wxPrecipFill').style.width = (d.precipProb != null ? d.precipProb : 0) + '%';

    document.getElementById('wxWind').textContent = d.windSpeed != null ? `${Math.round(d.windSpeed)} km/h` : '– km/h';
    document.getElementById('wxWindNote').textContent = d.windGust != null ? `Gusts to ${Math.round(d.windGust)} km/h` : '';
    const arrow = document.getElementById('wxWindArrow');
    arrow.style.transform = d.windDir != null ? `rotate(${d.windDir}deg)` : '';
    arrow.title = windDirLabel(d.windDir);

    document.getElementById('wxHumidity').textContent = d.humidity != null ? `${Math.round(d.humidity)}%` : '–%';
    document.getElementById('wxDewpoint').textContent = d.dewPoint != null ? `Dew point ${Math.round(d.dewPoint)}${unit}` : '';
    const humidityBarsEl = document.getElementById('wxHumidityBars');
    const barCount = 8;
    const filledCount = d.humidity != null ? Math.round((d.humidity / 100) * barCount) : 0;
    humidityBarsEl.innerHTML = Array.from({ length: barCount }).map((_, i) => {
      const h = 8 + (i / (barCount - 1)) * 22;
      return `<div class="wx-humidity-bar${i < filledCount ? ' filled' : ''}" style="height:${h.toFixed(0)}px;"></div>`;
    }).join('');

    const uvRing = document.getElementById('wxUvRing');
    uvRing.style.setProperty('--pct', d.uv != null ? Math.min(100, (d.uv / 12) * 100) : 0);
    uvRing.style.setProperty('--ring-color', 'var(--accent-a)');
    document.getElementById('wxUvVal').textContent = d.uv != null ? Math.round(d.uv) : '–';
    document.getElementById('wxUvNote').textContent = uvLabel(d.uv);

    const aqiVal = d.aqi ? d.aqi.aqi : null;
    const aqiRing = document.getElementById('wxAqiRing');
    const [aqiText, aqiColor] = aqiLabel(aqiVal);
    aqiRing.style.setProperty('--pct', aqiVal != null ? Math.min(100, (aqiVal / 300) * 100) : 0);
    aqiRing.style.setProperty('--ring-color', aqiColor);
    document.getElementById('wxAqiVal').textContent = aqiVal != null ? aqiVal : '–';
    document.getElementById('wxAqiNote').textContent = aqiText;

    document.getElementById('wxVisibility').textContent = d.visibility != null ? `${d.visibility.toFixed(1)} km` : '– km';
    document.getElementById('wxVisFill').style.width = (d.visibility != null ? Math.min(100, (d.visibility / 10) * 100) : 0) + '%';
    document.getElementById('wxPressure').textContent = d.pressure != null ? `${Math.round(d.pressure)} hPa` : '– hPa';
    document.getElementById('wxPressureFill').style.width = (d.pressure != null ? Math.max(0, Math.min(100, ((d.pressure - 970) / 80) * 100)) : 0) + '%';

    const moon = moonPhaseInfo(new Date());
    document.getElementById('wxMoonIcon').textContent = moon.icon;
    document.getElementById('wxMoonNote').textContent = `${moon.name} · ~${moon.illum}% illuminated`;
  }

  /* ---------------------------------------------------------------------
   * Widget layout — drag to move, drag to resize, enable/disable toggles
   * ------------------------------------------------------------------- */
  const widgetEls = {};
  document.querySelectorAll('.widget[data-widget]').forEach((el) => {
    widgetEls[el.dataset.widget] = el;
  });
  const exitLayoutEditBtn = document.getElementById('exitLayoutEdit');

  function applyWidgetLayout() {
    Object.keys(WIDGET_DEFAULTS).forEach((key) => {
      const el = widgetEls[key];
      if (!el) return;
      const cfg = state.settings.widgets[key] || WIDGET_DEFAULTS[key];
      el.style.left = cfg.x + '%';
      el.style.top = cfg.y + '%';
      el.style.width = cfg.w + 'px';
      el.style.height = cfg.h + 'px';
      el.style.transform = 'translate(-50%, -50%)';
      el.dataset.enabled = cfg.enabled !== false ? 'true' : 'false';
    });
  }

  function setLayoutEditMode(on) {
    document.body.classList.toggle('layout-edit', on);
    exitLayoutEditBtn.hidden = !on;
    if (on) closeDrawers();
  }

  document.getElementById('enterLayoutEdit').addEventListener('click', () => setLayoutEditMode(true));
  document.getElementById('enterLayoutEditFromSettings').addEventListener('click', () => setLayoutEditMode(true));
  exitLayoutEditBtn.addEventListener('click', () => setLayoutEditMode(false));

  document.getElementById('resetLayoutBtn').addEventListener('click', () => {
    state.settings.widgets = JSON.parse(JSON.stringify(WIDGET_DEFAULTS));
    storageSet({ settings: state.settings });
    applyWidgetLayout();
    renderWidgetToggleList();
  });

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  // Snap to a 1% grid, with a slightly "magnetic" pull toward the exact
  // center (50%) so widgets are easy to line up symmetrically.
  function snapPct(v) {
    if (Math.abs(v - 50) < 1.5) return 50;
    return Math.round(v);
  }

  // Dragging (moves a widget's center, stored as % of viewport).
  Object.entries(widgetEls).forEach(([key, el]) => {
    const handle = el.querySelector('.widget-drag-handle');
    if (!handle) return;
    handle.addEventListener('pointerdown', (e) => {
      if (!document.body.classList.contains('layout-edit')) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const cfg = state.settings.widgets[key];
      const startXPct = cfg.x;
      const startYPct = cfg.y;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      function onMove(ev) {
        const dxPct = ((ev.clientX - startX) / vw) * 100;
        const dyPct = ((ev.clientY - startY) / vh) * 100;
        cfg.x = snapPct(clamp(startXPct + dxPct, 4, 96));
        cfg.y = snapPct(clamp(startYPct + dyPct, 4, 96));
        el.style.left = cfg.x + '%';
        el.style.top = cfg.y + '%';
      }
      function onUp() {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        storageSet({ settings: state.settings });
      }
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  });

  // Resizing (drag from bottom-right corner; keeps the top-left corner fixed).
  Object.entries(widgetEls).forEach(([key, el]) => {
    const handle = el.querySelector('.widget-resize-handle');
    if (!handle) return;
    handle.addEventListener('pointerdown', (e) => {
      if (!document.body.classList.contains('layout-edit')) return;
      e.preventDefault();
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const cfg = state.settings.widgets[key];
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const startW = cfg.w;
      const startH = cfg.h;
      // Top-left corner in px, derived from the current center-anchored position.
      const startLeft = (cfg.x / 100) * vw - startW / 2;
      const startTop = (cfg.y / 100) * vh - startH / 2;

      function onMove(ev) {
        const newW = clamp(startW + (ev.clientX - startX), 100, 1000);
        const newH = clamp(startH + (ev.clientY - startY), 50, 800);
        cfg.w = newW;
        cfg.h = newH;
        cfg.x = clamp(((startLeft + newW / 2) / vw) * 100, 4, 96);
        cfg.y = clamp(((startTop + newH / 2) / vh) * 100, 4, 96);
        el.style.width = newW + 'px';
        el.style.height = newH + 'px';
        el.style.left = cfg.x + '%';
        el.style.top = cfg.y + '%';
      }
      function onUp() {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        storageSet({ settings: state.settings });
      }
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  });

  const widgetToggleList = document.getElementById('widgetToggleList');
  function renderWidgetToggleList() {
    widgetToggleList.innerHTML = '';
    Object.keys(WIDGET_DEFAULTS).forEach((key) => {
      const cfg = state.settings.widgets[key];
      const row = document.createElement('div');
      row.className = 'widget-toggle-row';
      const span = document.createElement('span');
      span.textContent = WIDGET_LABELS[key];
      const label = document.createElement('label');
      label.className = 'switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = cfg.enabled !== false;
      input.addEventListener('change', () => {
        cfg.enabled = input.checked;
        storageSet({ settings: state.settings });
        applyWidgetLayout();
      });
      label.appendChild(input);
      const track = document.createElement('span');
      track.className = 'switch-track';
      track.innerHTML = '<span class="switch-thumb"></span>';
      label.appendChild(track);
      row.appendChild(span);
      row.appendChild(label);
      widgetToggleList.appendChild(row);
    });
  }

  /* ---------------------------------------------------------------------
   * News widget
   * ------------------------------------------------------------------- */
  const newsList = document.getElementById('newsList');
  const newsEmptyHint = document.getElementById('newsEmptyHint');
  const newsFeedLabel = document.getElementById('newsFeedLabel');
  const newsFeedUrl = document.getElementById('newsFeedUrl');
  const newsFeedAdd = document.getElementById('newsFeedAdd');
  const newsFeedList = document.getElementById('newsFeedList');

  function timeAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (!isFinite(diffMs) || diffMs < 0) return '';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function renderNews() {
    const items = (state.news && state.news.items) || [];
    newsList.innerHTML = '';
    newsEmptyHint.hidden = state.settings.newsFeeds.length > 0;
    items.slice(0, 12).forEach((item) => {
      const li = document.createElement('li');
      li.className = 'news-item';
      const a = document.createElement('a');
      a.href = item.link;
      a.target = '_blank';
      a.rel = 'noopener';

      if (item.thumbnail) {
        const img = document.createElement('img');
        img.className = 'news-thumb';
        img.src = item.thumbnail;
        img.alt = '';
        img.loading = 'lazy';
        img.onerror = () => img.remove();
        a.appendChild(img);
      }

      const textWrap = document.createElement('span');
      textWrap.className = 'news-item-text';
      textWrap.textContent = item.title;
      const meta = document.createElement('span');
      meta.className = 'news-meta';
      meta.textContent = [item.source, timeAgo(item.pubDate)].filter(Boolean).join(' · ');
      textWrap.appendChild(meta);
      a.appendChild(textWrap);

      li.appendChild(a);
      newsList.appendChild(li);
    });
  }

  async function fetchNewsNow() {
    const feeds = state.settings.newsFeeds;
    if (!feeds.length) { renderNews(); return; }
    try {
      const results = await Promise.all(feeds.map(async (feed) => {
        try {
          const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
          const res = await fetch(url);
          const data = await res.json();
          if (!data || !Array.isArray(data.items)) return [];
          return data.items.slice(0, 6).map((it) => ({
            title: it.title,
            link: it.link,
            pubDate: it.pubDate,
            source: feed.label,
            thumbnail: it.thumbnail || (it.enclosure && it.enclosure.link) || null,
          }));
        } catch (e) { return []; }
      }));
      const merged = results.flat().sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      state.news = { items: merged, fetchedAt: Date.now() };
      storageSet({ news: state.news });
      renderNews();
    } catch (e) { /* keep showing whatever we already have cached */ }
  }

  function renderFeedList() {
    newsFeedList.innerHTML = '';
    state.settings.newsFeeds.forEach((feed, index) => {
      const li = document.createElement('li');
      li.className = 'feed-item';
      const label = document.createElement('span');
      label.className = 'feed-label';
      label.textContent = feed.label;
      const url = document.createElement('span');
      url.className = 'feed-url';
      url.textContent = feed.url;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'feed-remove';
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        state.settings.newsFeeds.splice(index, 1);
        storageSet({ settings: state.settings });
        renderFeedList();
        fetchNewsNow();
      });
      li.appendChild(label);
      li.appendChild(url);
      li.appendChild(removeBtn);
      newsFeedList.appendChild(li);
    });
  }

  newsFeedAdd.addEventListener('click', () => {
    const label = newsFeedLabel.value.trim();
    const url = newsFeedUrl.value.trim();
    if (!label || !url) return;
    state.settings.newsFeeds.push({ label, url });
    storageSet({ settings: state.settings });
    newsFeedLabel.value = '';
    newsFeedUrl.value = '';
    renderFeedList();
    fetchNewsNow();
  });

  document.getElementById('newsRefresh').addEventListener('click', fetchNewsNow);

  /* ---------------------------------------------------------------------
   * Markets widget — Stocks / Currency / Gold, each with a swappable,
   * user-editable data source. If any one source goes offline, switching
   * to another needs no code changes — just a settings change.
   * ------------------------------------------------------------------- */
  const stockList = document.getElementById('stockList');
  const currencyList = document.getElementById('currencyList');
  const goldList = document.getElementById('goldList');
  const stocksEmptyHint = document.getElementById('stocksEmptyHint');
  const finnhubKeyInput = document.getElementById('finnhubKeyInput');
  const finnhubKeySave = document.getElementById('finnhubKeySave');
  const twelvedataKeyInput = document.getElementById('twelvedataKeyInput');
  const twelvedataKeySave = document.getElementById('twelvedataKeySave');
  const stockTickerInput = document.getElementById('stockTickerInput');
  const stockTickerAdd = document.getElementById('stockTickerAdd');
  const stockTickerList = document.getElementById('stockTickerList');
  const stockProviderOptions = document.querySelectorAll('[data-stockprovider]');
  const stockRefreshInterval = document.getElementById('stockRefreshInterval');
  const currencyProviderOptions = document.querySelectorAll('[data-currencyprovider]');
  const goldProviderOptions = document.querySelectorAll('[data-goldprovider]');
  const currencyFromInput = document.getElementById('currencyFromInput');
  const currencyToInput = document.getElementById('currencyToInput');
  const currencyAdd = document.getElementById('currencyAdd');
  const currencyPairList = document.getElementById('currencyPairList');
  const goldCurrencySelect = document.getElementById('goldCurrencySelect');
  const goldEnabledInput = document.getElementById('goldEnabled');
  const marketTabs = document.querySelectorAll('.market-tab');

  function activeStockKey() {
    return (state.settings.stockProvider || 'finnhub') === 'twelvedata'
      ? state.settings.twelvedataKey
      : state.settings.finnhubKey;
  }

  marketTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      marketTabs.forEach((t) => t.classList.toggle('active', t === tab));
      stockList.classList.toggle('icon-hidden', tab.dataset.tab !== 'stocks');
      currencyList.classList.toggle('icon-hidden', tab.dataset.tab !== 'currency');
      goldList.classList.toggle('icon-hidden', tab.dataset.tab !== 'gold');
      stocksEmptyHint.classList.toggle('icon-hidden', tab.dataset.tab !== 'stocks');
      const hints = { stocks: renderStocks, currency: renderCurrency, gold: renderGold };
      if (hints[tab.dataset.tab]) hints[tab.dataset.tab]();
    });
  });

  // The sparkline is built from prices *we* sample locally over time —
  // not from a provider's history/candle endpoint. This means it works
  // identically on every source (some free-tier plans, like Finnhub's,
  // don't include historical candles at all) and costs zero extra API
  // calls: one quote request per ticker per refresh, full stop.
  const STOCK_HISTORY_MAX_POINTS = 96;

  function recordStockHistory(ticker, price) {
    if (!state.stocks) state.stocks = { quotes: {}, history: {} };
    if (!state.stocks.history) state.stocks.history = {};
    const hist = state.stocks.history[ticker] || [];
    hist.push(price);
    if (hist.length > STOCK_HISTORY_MAX_POINTS) hist.shift();
    state.stocks.history[ticker] = hist;
  }

  function buildSparkline(history, isUp) {
    if (!history || history.length < 2) return '';
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const n = history.length;
    const pts = history.map((v, i) => {
      const x = (i / (n - 1)) * 100;
      const y = 30 - ((v - min) / range) * 28 - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const color = isUp ? '#4dff9d' : '#ff4d6a';
    const fillPts = `0,30 ${pts.join(' ')} 100,30`;
    return `<svg class="stock-spark" viewBox="0 0 100 30" preserveAspectRatio="none">
      <polygon points="${fillPts}" fill="${color}" opacity="0.12"></polygon>
      <polyline points="${pts.join(' ')}" stroke="${color}"></polyline>
    </svg>`;
  }

  function renderStocks() {
    const quotes = (state.stocks && state.stocks.quotes) || {};
    const history = (state.stocks && state.stocks.history) || {};
    stockList.innerHTML = '';
    if (!activeStockKey()) {
      stocksEmptyHint.hidden = false;
      stocksEmptyHint.textContent = 'Add a free API key for the selected source in Settings → Markets → Stocks to enable this tab.';
      return;
    }
    if (!state.settings.stockTickers.length) {
      stocksEmptyHint.hidden = false;
      stocksEmptyHint.textContent = 'Add a ticker in Settings → Markets → Stocks to track it here.';
      return;
    }
    stocksEmptyHint.hidden = true;
    state.settings.stockTickers.forEach((ticker) => {
      const q = quotes[ticker];
      const dp = q ? q.dp : 0;
      const isUp = dp >= 0;
      const li = document.createElement('li');
      li.className = 'stock-card';
      li.innerHTML = `
        <div class="stock-card-top">
          <span class="stock-symbol">${ticker}</span>
          <span class="stock-change ${isUp ? 'up' : 'down'}">${q ? `${isUp ? '▲' : '▼'} ${Math.abs(dp).toFixed(2)}%` : '–'}</span>
        </div>
        <div class="stock-card-mid">
          ${buildSparkline(history[ticker], isUp)}
          <span class="stock-price">${q ? `$${q.c.toFixed(2)}` : '–'}</span>
        </div>
      `;
      stockList.appendChild(li);
    });
  }

  async function fetchStocksFinnhub(tickers, key) {
    const quotes = {};
    await Promise.all(tickers.map(async (ticker) => {
      try {
        const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(key)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && typeof data.c === 'number') {
          quotes[ticker] = data;
          recordStockHistory(ticker, data.c);
        }
      } catch (e) { /* skip this ticker's quote */ }
    }));
    return quotes;
  }

  async function fetchStocksTwelveData(tickers, key) {
    const quotes = {};
    await Promise.all(tickers.map(async (ticker) => {
      try {
        const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(key)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.close) {
          const c = parseFloat(data.close);
          quotes[ticker] = { c, dp: parseFloat(data.percent_change || 0) };
          recordStockHistory(ticker, c);
        }
      } catch (e) { /* skip this ticker's quote */ }
    }));
    return quotes;
  }

  async function fetchStocksNow() {
    const key = activeStockKey();
    const tickers = state.settings.stockTickers;
    if (!key || !tickers.length) { renderStocks(); return; }
    try {
      const provider = state.settings.stockProvider || 'finnhub';
      const quotes = provider === 'twelvedata'
        ? await fetchStocksTwelveData(tickers, key)
        : await fetchStocksFinnhub(tickers, key);
      state.stocks = { quotes, history: (state.stocks && state.stocks.history) || {}, fetchedAt: Date.now() };
      storageSet({ stocks: state.stocks });
      renderStocks();
    } catch (e) { /* keep showing whatever we already have cached */ }
  }

  let stockPollHandle = null;
  function restartStockPolling() {
    if (stockPollHandle) clearInterval(stockPollHandle);
    const minutes = state.settings.stockRefreshMinutes || 10;
    stockPollHandle = setInterval(fetchStocksNow, minutes * 60 * 1000);
  }

  function renderTickerList() {
    stockTickerList.innerHTML = '';
    state.settings.stockTickers.forEach((ticker, index) => {
      const chip = document.createElement('div');
      chip.className = 'ticker-chip';
      const span = document.createElement('span');
      span.textContent = ticker;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        state.settings.stockTickers.splice(index, 1);
        storageSet({ settings: state.settings });
        renderTickerList();
        fetchStocksNow();
      });
      chip.appendChild(span);
      chip.appendChild(removeBtn);
      stockTickerList.appendChild(chip);
    });
  }

  finnhubKeySave.addEventListener('click', () => {
    state.settings.finnhubKey = finnhubKeyInput.value.trim();
    storageSet({ settings: state.settings });
    if ((state.settings.stockProvider || 'finnhub') === 'finnhub') fetchStocksNow();
  });

  twelvedataKeySave.addEventListener('click', () => {
    state.settings.twelvedataKey = twelvedataKeyInput.value.trim();
    storageSet({ settings: state.settings });
    if (state.settings.stockProvider === 'twelvedata') fetchStocksNow();
  });

  stockProviderOptions.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.settings.stockProvider = chip.dataset.stockprovider;
      storageSet({ settings: state.settings });
      stockProviderOptions.forEach((c) => c.classList.toggle('active', c.dataset.stockprovider === state.settings.stockProvider));
      renderStocks();
      fetchStocksNow();
    });
  });

  stockRefreshInterval.addEventListener('change', () => {
    state.settings.stockRefreshMinutes = parseInt(stockRefreshInterval.value, 10);
    storageSet({ settings: state.settings });
    restartStockPolling();
  });

  stockTickerAdd.addEventListener('click', () => {
    const ticker = stockTickerInput.value.trim().toUpperCase();
    if (!ticker || state.settings.stockTickers.includes(ticker)) return;
    state.settings.stockTickers.push(ticker);
    storageSet({ settings: state.settings });
    stockTickerInput.value = '';
    renderTickerList();
    fetchStocksNow();
  });

  /* ---- Currency ---- */
  function renderCurrency() {
    const rates = (state.currency && state.currency.rates) || {};
    currencyList.innerHTML = '';
    if (!state.settings.currencyPairs.length) {
      currencyList.innerHTML = '<p class="hint">Add a currency pair in Settings → Markets → Currency.</p>';
      return;
    }
    state.settings.currencyPairs.forEach((pair) => {
      const key = `${pair.from}_${pair.to}`;
      const rate = rates[key];
      const li = document.createElement('li');
      li.className = 'stock-card';
      li.innerHTML = `
        <div class="stock-card-top">
          <span class="stock-symbol">${pair.from} → ${pair.to}</span>
        </div>
        <div class="stock-card-mid">
          <span class="stock-price" style="flex:1; text-align:left;">${rate != null ? `1 ${pair.from} = ${rate.toFixed(4)} ${pair.to}` : '–'}</span>
        </div>
      `;
      currencyList.appendChild(li);
    });
  }

  async function fetchCurrencyPairFrankfurter(from, to) {
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data && data.rates ? data.rates[to] : null;
  }

  async function fetchCurrencyPairErApi(from, to) {
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data && data.rates ? data.rates[to] : null;
  }

  async function fetchCurrencyNow() {
    const pairs = state.settings.currencyPairs;
    if (!pairs.length) { renderCurrency(); return; }
    try {
      const provider = state.settings.currencyProvider || 'frankfurter';
      const rates = {};
      await Promise.all(pairs.map(async (pair) => {
        try {
          const rate = provider === 'erapi'
            ? await fetchCurrencyPairErApi(pair.from, pair.to)
            : await fetchCurrencyPairFrankfurter(pair.from, pair.to);
          if (rate != null) rates[`${pair.from}_${pair.to}`] = rate;
        } catch (e) { /* skip this pair */ }
      }));
      state.currency = { rates, fetchedAt: Date.now() };
      storageSet({ currency: state.currency });
      renderCurrency();
    } catch (e) { /* keep showing whatever we already have cached */ }
  }

  function renderCurrencyPairList() {
    currencyPairList.innerHTML = '';
    state.settings.currencyPairs.forEach((pair, index) => {
      const chip = document.createElement('div');
      chip.className = 'ticker-chip';
      const span = document.createElement('span');
      span.textContent = `${pair.from}→${pair.to}`;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        state.settings.currencyPairs.splice(index, 1);
        storageSet({ settings: state.settings });
        renderCurrencyPairList();
        fetchCurrencyNow();
      });
      chip.appendChild(span);
      chip.appendChild(removeBtn);
      currencyPairList.appendChild(chip);
    });
  }

  currencyProviderOptions.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.settings.currencyProvider = chip.dataset.currencyprovider;
      storageSet({ settings: state.settings });
      currencyProviderOptions.forEach((c) => c.classList.toggle('active', c.dataset.currencyprovider === state.settings.currencyProvider));
      fetchCurrencyNow();
    });
  });

  currencyAdd.addEventListener('click', () => {
    const from = currencyFromInput.value.trim().toUpperCase();
    const to = currencyToInput.value.trim().toUpperCase();
    if (!from || !to || from === to) return;
    if (state.settings.currencyPairs.some((p) => p.from === from && p.to === to)) return;
    state.settings.currencyPairs.push({ from, to });
    storageSet({ settings: state.settings });
    currencyFromInput.value = '';
    currencyToInput.value = '';
    renderCurrencyPairList();
    fetchCurrencyNow();
  });

  /* ---- Gold ---- */
  function renderGold() {
    goldList.innerHTML = '';
    if (!state.settings.goldEnabled) {
      goldList.innerHTML = '<p class="hint">Turn on "Show gold price" in Settings → Markets → Gold.</p>';
      return;
    }
    const g = state.gold;
    const li = document.createElement('li');
    li.className = 'stock-card';
    const isUp = g && g.change >= 0;
    li.innerHTML = `
      <div class="stock-card-top">
        <span class="stock-symbol">Gold · ${state.settings.goldCurrency}/oz</span>
        <span class="stock-change ${isUp ? 'up' : 'down'}">${g ? `${isUp ? '▲' : '▼'} ${Math.abs(g.changePct).toFixed(2)}%` : '–'}</span>
      </div>
      <div class="stock-card-mid">
        <span class="stock-price" style="flex:1; text-align:left;">${g ? `${g.price.toFixed(2)} ${state.settings.goldCurrency}` : '–'}</span>
      </div>
    `;
    goldList.appendChild(li);
  }

  async function fetchGoldNow() {
    if (!state.settings.goldEnabled) { renderGold(); return; }
    try {
      const ccy = state.settings.goldCurrency;
      const url = `https://data-asg.goldprice.org/dbXRates/${encodeURIComponent(ccy)}`;
      const res = await fetch(url);
      const data = await res.json();
      const item = data && Array.isArray(data.items) && data.items[0];
      if (item && typeof item.xauPrice === 'number') {
        state.gold = { price: item.xauPrice, change: item.chgXau || 0, changePct: item.pcXau || 0, fetchedAt: Date.now() };
        storageSet({ gold: state.gold });
      }
      renderGold();
    } catch (e) {
      // Free gold-price APIs without a key are the least stable link in
      // this chain — if this one goes down, swap the URL in fetchGoldNow
      // for another source; the settings/UI don't need to change.
      renderGold();
    }
  }

  goldProviderOptions.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.settings.goldProvider = chip.dataset.goldprovider;
      storageSet({ settings: state.settings });
      goldProviderOptions.forEach((c) => c.classList.toggle('active', c.dataset.goldprovider === state.settings.goldProvider));
      fetchGoldNow();
    });
  });

  goldCurrencySelect.addEventListener('change', () => {
    state.settings.goldCurrency = goldCurrencySelect.value;
    storageSet({ settings: state.settings });
    fetchGoldNow();
  });

  goldEnabledInput.addEventListener('change', () => {
    state.settings.goldEnabled = goldEnabledInput.checked;
    storageSet({ settings: state.settings });
    fetchGoldNow();
  });

  document.getElementById('stocksRefresh').addEventListener('click', () => {
    fetchStocksNow();
    fetchCurrencyNow();
    fetchGoldNow();
  });

  /* ---------------------------------------------------------------------
   * Settings
   * ------------------------------------------------------------------- */
  const accentSwatches = document.getElementById('accentSwatches');
  const bgOptions = document.getElementById('bgOptions');
  const engineOptions = document.getElementById('engineOptions');
  const userNameInput = document.getElementById('userName');
  const ACCENTS = ['magenta', 'lime', 'sunset', 'violet', 'ice', 'toxic', 'custom'];
  const customAccentFields = document.getElementById('customAccentFields');
  const customAccentA = document.getElementById('customAccentA');
  const customAccentB = document.getElementById('customAccentB');
  const clockStyleOptions = document.querySelectorAll('[data-clockstyle]');
  const fontOptions = document.querySelectorAll('[data-font]');
  const dateColorInput = document.getElementById('dateColorInput');
  const greetingColorInput = document.getElementById('greetingColorInput');

  const wallpaperControls = document.getElementById('wallpaperControls');
  const wallpaperHint = document.getElementById('wallpaperHint');
  const wallpaperUploadBtn = document.getElementById('wallpaperUploadBtn');
  const wallpaperRemoveBtn = document.getElementById('wallpaperRemoveBtn');
  const wallpaperFile = document.getElementById('wallpaperFile');
  const wallpaperDim = document.getElementById('wallpaperDim');
  const dimValue = document.getElementById('dimValue');
  const bgVideo = document.getElementById('bgVideo');
  const bgImage = document.getElementById('bgImage');

  let currentWallpaperUrl = null;

  function setWallpaperDimVar() {
    document.documentElement.style.setProperty('--wallpaper-dim', state.settings.wallpaperDim);
  }

  function releaseWallpaperUrl() {
    if (currentWallpaperUrl) {
      URL.revokeObjectURL(currentWallpaperUrl);
      currentWallpaperUrl = null;
    }
  }

  function showWallpaperElement(kind, blob) {
    releaseWallpaperUrl();
    currentWallpaperUrl = URL.createObjectURL(blob);
    if (kind === 'video') {
      bgImage.hidden = true;
      bgImage.removeAttribute('src');
      bgVideo.src = currentWallpaperUrl;
      bgVideo.hidden = false;
      bgVideo.play().catch(() => {});
    } else {
      bgVideo.hidden = true;
      bgVideo.removeAttribute('src');
      bgImage.src = currentWallpaperUrl;
      bgImage.hidden = false;
    }
  }

  function hideWallpaperElements() {
    releaseWallpaperUrl();
    bgVideo.hidden = true;
    bgVideo.pause();
    bgVideo.removeAttribute('src');
    bgImage.hidden = true;
    bgImage.removeAttribute('src');
  }

  async function refreshWallpaperFromDb() {
    const bg = state.settings.background;
    if (bg !== 'image' && bg !== 'video') { hideWallpaperElements(); return; }
    const record = await loadWallpaperBlob();
    if (record && record.blob) {
      showWallpaperElement(record.kind, record.blob);
    } else {
      hideWallpaperElements();
    }
  }

  function applyCustomAccentVars() {
    if (state.settings.accent === 'custom') {
      document.body.style.setProperty('--accent-a', state.settings.customAccentA);
      document.body.style.setProperty('--accent-b', state.settings.customAccentB);
      document.body.style.setProperty('--accent-a-dim', hexToRgba(state.settings.customAccentA, 0.16));
      document.body.style.setProperty('--accent-b-dim', hexToRgba(state.settings.customAccentB, 0.16));
    } else {
      document.body.style.removeProperty('--accent-a');
      document.body.style.removeProperty('--accent-b');
      document.body.style.removeProperty('--accent-a-dim');
      document.body.style.removeProperty('--accent-b-dim');
    }
  }

  function hexToRgba(hex, alpha) {
    const m = hex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16);
    const g = parseInt(m.substring(2, 4), 16);
    const b = parseInt(m.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function applySettingsToDom() {
    document.body.dataset.accent = state.settings.accent;
    document.body.dataset.bg = state.settings.background;
    document.body.dataset.font = state.settings.fontTheme || 'default';
    engineSelect.value = state.settings.engine;
    userNameInput.value = state.settings.userName;
    setWallpaperDimVar();
    applyCustomAccentVars();

    accentSwatches.querySelectorAll('.swatch').forEach((s) => {
      s.classList.toggle('active', s.dataset.swatch === state.settings.accent);
    });
    customAccentFields.classList.toggle('icon-hidden', state.settings.accent !== 'custom');
    customAccentA.value = state.settings.customAccentA;
    customAccentB.value = state.settings.customAccentB;

    fontOptions.forEach((c) => {
      c.classList.toggle('active', c.dataset.font === (state.settings.fontTheme || 'default'));
    });

    clockStyleOptions.forEach((c) => {
      c.classList.toggle('active', c.dataset.clockstyle === (state.settings.clockStyle || 'digital'));
    });
    applyClockStyle();
    dateColorInput.value = state.settings.dateColor || '#8a84b0';
    greetingColorInput.value = state.settings.greetingColor || '#edeafb';
    applyTextColors();

    document.getElementById('weatherWidgetModeOptions').querySelectorAll('[data-wxmode]').forEach((c) => {
      c.classList.toggle('active', c.dataset.wxmode === (state.settings.weatherWidgetMode || 'simple'));
    });
    applyWeatherWidgetMode();

    document.getElementById('worldClockStyleOptions').querySelectorAll('[data-wcstyle]').forEach((c) => {
      c.classList.toggle('active', c.dataset.wcstyle === (state.settings.worldClockStyle || 'classic'));
    });
    applyWorldClockStyle();

    bgOptions.querySelectorAll('.option-chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.bg === state.settings.background);
    });
    engineOptions.querySelectorAll('.option-chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.engine === state.settings.engine);
    });

    const isWallpaper = state.settings.background === 'image' || state.settings.background === 'video';
    wallpaperControls.hidden = !isWallpaper;
    if (isWallpaper) {
      wallpaperHint.textContent = state.settings.background === 'video'
        ? 'Choose a video file to loop as your background.'
        : 'Choose an image file as your background.';
      wallpaperFile.accept = state.settings.background === 'video' ? 'video/*' : 'image/*';
    }
    dimValue.textContent = Math.round(state.settings.wallpaperDim * 100) + '%';
    wallpaperDim.value = Math.round(state.settings.wallpaperDim * 100);

    weatherCityInput.value = state.settings.weatherCity || '';
    weatherUnitChips.forEach((c) => {
      c.classList.toggle('active', c.dataset.unit === state.settings.weatherUnit);
    });
    weatherSourceChips.forEach((c) => {
      c.classList.toggle('active', c.dataset.wxsource === (state.settings.weatherSource || 'openmeteo'));
    });

    finnhubKeyInput.value = state.settings.finnhubKey || '';
    twelvedataKeyInput.value = state.settings.twelvedataKey || '';
    stockRefreshInterval.value = String(state.settings.stockRefreshMinutes || 10);
    stockProviderOptions.forEach((c) => {
      c.classList.toggle('active', c.dataset.stockprovider === (state.settings.stockProvider || 'finnhub'));
    });
    currencyProviderOptions.forEach((c) => {
      c.classList.toggle('active', c.dataset.currencyprovider === (state.settings.currencyProvider || 'frankfurter'));
    });
    goldProviderOptions.forEach((c) => {
      c.classList.toggle('active', c.dataset.goldprovider === (state.settings.goldProvider || 'goldprice'));
    });
    goldCurrencySelect.value = state.settings.goldCurrency || 'USD';
    goldEnabledInput.checked = !!state.settings.goldEnabled;

    applyWidgetLayout();
    renderWidgetToggleList();
    renderFeedList();
    renderTickerList();
    renderCurrencyPairList();
    renderWorldClockChips();
  }

  function buildSwatches() {
    accentSwatches.innerHTML = '';
    ACCENTS.forEach((name) => {
      const btn = document.createElement('button');
      btn.className = 'swatch';
      btn.dataset.swatch = name;
      btn.type = 'button';
      btn.setAttribute('aria-label', `${name} accent`);
      btn.addEventListener('click', () => {
        state.settings.accent = name;
        storageSet({ settings: state.settings });
        applySettingsToDom();
      });
      accentSwatches.appendChild(btn);
    });
  }

  bgOptions.querySelectorAll('.option-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.settings.background = chip.dataset.bg;
      storageSet({ settings: state.settings });
      applySettingsToDom();
      refreshWallpaperFromDb();
    });
  });

  customAccentA.addEventListener('input', () => {
    state.settings.customAccentA = customAccentA.value;
    applyCustomAccentVars();
  });
  customAccentA.addEventListener('change', () => storageSet({ settings: state.settings }));
  customAccentB.addEventListener('input', () => {
    state.settings.customAccentB = customAccentB.value;
    applyCustomAccentVars();
  });
  customAccentB.addEventListener('change', () => storageSet({ settings: state.settings }));

  clockStyleOptions.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.settings.clockStyle = chip.dataset.clockstyle;
      storageSet({ settings: state.settings });
      applySettingsToDom();
      tick();
    });
  });

  fontOptions.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.settings.fontTheme = chip.dataset.font;
      storageSet({ settings: state.settings });
      applySettingsToDom();
    });
  });

  dateColorInput.addEventListener('input', () => {
    state.settings.dateColor = dateColorInput.value;
    applyTextColors();
  });
  dateColorInput.addEventListener('change', () => storageSet({ settings: state.settings }));
  greetingColorInput.addEventListener('input', () => {
    state.settings.greetingColor = greetingColorInput.value;
    applyTextColors();
  });
  greetingColorInput.addEventListener('change', () => storageSet({ settings: state.settings }));

  wallpaperUploadBtn.addEventListener('click', () => wallpaperFile.click());

  wallpaperFile.addEventListener('change', async () => {
    const file = wallpaperFile.files[0];
    if (!file) return;
    const kind = state.settings.background === 'video' ? 'video' : 'image';
    await saveWallpaperBlob(file, kind);
    showWallpaperElement(kind, file);
    wallpaperFile.value = '';
  });

  wallpaperRemoveBtn.addEventListener('click', async () => {
    await clearWallpaperBlob();
    hideWallpaperElements();
  });

  wallpaperDim.addEventListener('input', () => {
    state.settings.wallpaperDim = Number(wallpaperDim.value) / 100;
    dimValue.textContent = wallpaperDim.value + '%';
    setWallpaperDimVar();
  });
  wallpaperDim.addEventListener('change', () => {
    storageSet({ settings: state.settings });
  });

  engineOptions.querySelectorAll('.option-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.settings.engine = chip.dataset.engine;
      storageSet({ settings: state.settings });
      applySettingsToDom();
    });
  });

  let nameTimer = null;
  userNameInput.addEventListener('input', () => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => {
      state.settings.userName = userNameInput.value.trim();
      storageSet({ settings: state.settings });
      tick();
    }, 300);
  });

  /* ---- Export / import / reset ---- */
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ dials: state.dials }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dial-shortcuts.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  const importFile = document.getElementById('importFile');
  document.getElementById('importBtn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (Array.isArray(parsed.dials)) {
          state.dials = parsed.dials.map((d, i) => ({
            id: d.id || 'd' + Date.now().toString(36) + i,
            name: d.name || '',
            url: normalizeUrl(d.url || ''),
          })).filter((d) => d.url);
          storageSet({ dials: state.dials });
          renderDials();
        }
      } catch (e) { /* ignore malformed file */ }
      importFile.value = '';
    };
    reader.readAsText(file);
  });

  /* ---- Full backup: settings + widget layout + wallpaper + dials ---- */
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const FULL_BACKUP_WALLPAPER_LIMIT = 15 * 1024 * 1024; // 15MB, keeps the JSON file sane
  const fullBackupHint = document.getElementById('fullBackupHint');
  const fullBackupHintDefault = fullBackupHint.textContent;

  document.getElementById('fullExportBtn').addEventListener('click', async () => {
    const payload = {
      type: 'dial-newtab-full-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      dials: state.dials,
      wallpaper: null,
    };

    const isWallpaper = state.settings.background === 'image' || state.settings.background === 'video';
    if (isWallpaper) {
      try {
        const record = await loadWallpaperBlob();
        if (record && record.blob) {
          if (record.blob.size <= FULL_BACKUP_WALLPAPER_LIMIT) {
            payload.wallpaper = {
              included: true,
              kind: record.kind,
              mimeType: record.blob.type,
              dataUrl: await blobToDataUrl(record.blob),
            };
          } else {
            payload.wallpaper = {
              included: false,
              skippedReason: `File is ${(record.blob.size / 1024 / 1024).toFixed(1)}MB, over the ${FULL_BACKUP_WALLPAPER_LIMIT / 1024 / 1024}MB export limit — re-pick it after importing.`,
            };
          }
        }
      } catch (e) { /* export the rest even if the wallpaper couldn't be read */ }
    }

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dial-full-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    fullBackupHint.textContent = payload.wallpaper && payload.wallpaper.included === false
      ? `Exported — but ${payload.wallpaper.skippedReason}`
      : 'Exported.';
    setTimeout(() => { fullBackupHint.textContent = fullBackupHintDefault; }, 6000);
  });

  async function refreshAllAfterImport() {
    buildSwatches();
    applySettingsToDom();
    await refreshWallpaperFromDb();
    renderDials();

    renderWeatherChip();
    fetchWeatherNow();

    renderNews();
    fetchNewsNow();

    renderStocks();
    if (activeStockKey()) fetchStocksNow();
    restartStockPolling();

    renderCurrency();
    if (state.settings.currencyPairs.length) fetchCurrencyNow();

    renderGold();
    if (state.settings.goldEnabled) fetchGoldNow();
  }

  const fullImportFile = document.getElementById('fullImportFile');
  document.getElementById('fullImportBtn').addEventListener('click', () => fullImportFile.click());
  fullImportFile.addEventListener('change', () => {
    const file = fullImportFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object' || !parsed.settings) {
          fullBackupHint.textContent = 'That file doesn\'t look like a Dial backup.';
          return;
        }

        // Defensive merge: an older backup missing newer fields (or a
        // newer backup opened on an older build) still falls back safely.
        state.settings = {
          ...DEFAULT_SETTINGS,
          ...parsed.settings,
          widgets: { ...JSON.parse(JSON.stringify(WIDGET_DEFAULTS)), ...(parsed.settings.widgets || {}) },
        };

        if (Array.isArray(parsed.dials)) {
          state.dials = parsed.dials.map((d, i) => ({
            id: d.id || 'd' + Date.now().toString(36) + i,
            name: d.name || '',
            url: normalizeUrl(d.url || ''),
          })).filter((d) => d.url);
        }

        let wallpaperNote = '';
        if (parsed.wallpaper && parsed.wallpaper.included && parsed.wallpaper.dataUrl) {
          try {
            const res = await fetch(parsed.wallpaper.dataUrl);
            const blob = await res.blob();
            await saveWallpaperBlob(blob, parsed.wallpaper.kind);
          } catch (e) { wallpaperNote = ' (wallpaper file could not be restored)'; }
        } else if (parsed.wallpaper && parsed.wallpaper.included === false) {
          wallpaperNote = ' (wallpaper wasn\'t in this backup — pick one again if you want it)';
        }

        storageSet({ settings: state.settings, dials: state.dials });
        await refreshAllAfterImport();
        fullBackupHint.textContent = 'Backup imported.' + wallpaperNote;
      } catch (e) {
        fullBackupHint.textContent = 'Could not read that file — is it a valid backup JSON?';
      }
      fullImportFile.value = '';
    };
    reader.readAsText(file);
  });

  document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!confirm('Reset shortcuts, notes, to-dos, wallpaper, weather, layout and the playlist to defaults?')) return;
    audioEl.pause();
    releaseTrackUrl();
    audioEl.removeAttribute('src');
    await clearAllTrackBlobs();
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    storageSet(state);
    await clearWallpaperBlob();
    hideWallpaperElements();
    renderDials();
    renderTodos();
    renderPlaylist();
    playerTrackName.textContent = 'No track selected';
    notesArea.value = '';
    applySettingsToDom();
    renderWeatherChip();
    renderNews();
    renderStocks();
    renderCurrency();
    renderGold();
    renderWorldClock(new Date());
  });

  /* ---------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------- */
  async function init() {
    state = await storageGet();
    buildSwatches();
    buildWorldClockCitySelect();
    applySettingsToDom();
    await refreshWallpaperFromDb();
    renderDials();
    renderTodos();
    notesArea.value = state.notes;

    renderPlaylist();
    audioEl.volume = state.settings.musicVolume;
    audioEl.muted = state.settings.musicMuted;
    playerVolume.value = Math.round(state.settings.musicVolume * 100);
    updateMuteIcon();
    if (state.tracks.length && state.tracks[state.settings.musicIndex]) {
      playerTrackName.textContent = state.tracks[state.settings.musicIndex].name;
    }

    renderWeatherChip();
    if (state.settings.weatherLat != null) {
      const stale = !state.weather || (Date.now() - state.weather.fetchedAt) > 30 * 60 * 1000;
      if (stale) fetchWeatherNow();
      setInterval(fetchWeatherNow, 30 * 60 * 1000);

      const mode = state.settings.weatherWidgetMode || 'simple';
      if (mode === 'day') {
        const staleDetail = !state.weatherDetail || (Date.now() - state.weatherDetail.fetchedAt) > 30 * 60 * 1000;
        if (staleDetail) fetchWeatherDetailNow();
      }
      if (mode === 'week') {
        const staleWeek = !state.weatherWeek || (Date.now() - state.weatherWeek.fetchedAt) > 30 * 60 * 1000;
        if (staleWeek) fetchWeatherWeekNow();
      }
    }
    // Weather DETAIL (feels-like, AQI, moon, etc.) is otherwise intentionally
    // not fetched here — it's lazy-loaded only when the weather drawer is
    // opened, so a fuller dashboard doesn't mean a slower new tab.

    renderNews();
    fetchNewsNow();
    setInterval(fetchNewsNow, 30 * 60 * 1000);

    renderStocks();
    if (activeStockKey()) fetchStocksNow();
    restartStockPolling();

    renderCurrency();
    if (state.settings.currencyPairs.length) fetchCurrencyNow();
    setInterval(fetchCurrencyNow, 15 * 60 * 1000);

    renderGold();
    if (state.settings.goldEnabled) fetchGoldNow();
    setInterval(fetchGoldNow, 15 * 60 * 1000);

    tick();
    setInterval(tick, 1000);
    cmdInput.focus();
  }

  init();
})();
