/**
 * OcuCast — Database and API Client
 * Seamlessly connects client-side SPA to local Node.js server (PostgreSQL on Neon).
 * Falls back to offline LocalStorage/JSON memory if server is offline.
 */

const API_BASE = 'http://localhost:3001/api';

const DB = {
  // Static fallback values
  fishermen: [
    { id: 'F-001', name: 'Ержан Сейтжанов', login: 'fisher1', password: 'demo', vessel: 'Каспий-Стар', vessel_id: 'KZ-MNG-4412', status: 'approved', green_score: 94, license_expires: '2026-12-31', personal_quota: { sturgeon: 80, carp: 600, roach: 1200 }, used_quota: { sturgeon: 12, carp: 287, roach: 541 } },
    { id: 'F-002', name: 'Болат Жунисов', login: 'fisher2', password: 'demo', vessel: 'Мангистау', vessel_id: 'KZ-MNG-2287', status: 'pending', green_score: 71, license_expires: '2026-06-30', personal_quota: { sturgeon: 60, carp: 450, roach: 900 }, used_quota: { sturgeon: 0, carp: 0, roach: 0 } },
    { id: 'F-003', name: 'Серік Аблаев', login: 'fisher3', password: 'demo', vessel: 'Ак-Жол', vessel_id: 'KZ-MNG-8801', status: 'approved', green_score: 88, license_expires: '2026-12-31', personal_quota: { sturgeon: 100, carp: 700, roach: 1400 }, used_quota: { sturgeon: 8, carp: 312, roach: 688 } }
  ],

  catches: [],

  nationalQuota2026: {
    sturgeon: { total: 5000,  used: 1243,  unit: 'кг', icon: '🐟', label: 'Осётр' },
    carp:     { total: 45000, used: 18764, unit: 'кг', icon: '🐠', label: 'Сазан' },
    roach:    { total: 80000, used: 31882, unit: 'кг', icon: '🐡', label: 'Вобла' }
  },

  ecoMarkers: [
    { id: 'ECO-001', lat: 43.6521, lng: 51.1753, type: 'catch',  label: 'OC-2026-000184', weight: 11.8, legal: true },
    { id: 'ECO-002', lat: 44.1234, lng: 50.8876, type: 'catch',  label: 'OC-2026-000201', weight: 6.2,  legal: true },
    { id: 'ECO-003', lat: 43.2341, lng: 51.5432, type: 'oil',    label: 'Разлив #ОЙЛ-003', oil_detected: true },
    { id: 'ECO-004', lat: 44.8765, lng: 51.2341, type: 'seal',   label: 'Каспийский тюлень #37', seal: true },
    { id: 'ECO-005', lat: 43.9876, lng: 50.5678, type: 'catch',  label: 'OC-2026-000167', weight: 4.1,  legal: true }
  ],

  speciesLimits: {
    roach:    { max_weight_kg: 3.0,    typical_weight: '0.3–1.5 кг',    name_ru: 'Вобла' },
    carp:     { max_weight_kg: 25.0,   typical_weight: '1–8 кг',        name_ru: 'Сазан' },
    sturgeon: { max_weight_kg: 80.0,   typical_weight: '10–60 кг',      name_ru: 'Осётр' },
    bream:    { max_weight_kg: 6.0,    typical_weight: '0.5–3 кг',      name_ru: 'Лещ' },
    pike:     { max_weight_kg: 15.0,   typical_weight: '1–6 кг',        name_ru: 'Щука' }
  },

  antifrodLog: [],

  monthlyCatch: [
    { month: 'Янв', catch_kg: 2341, forecast: 2100 },
    { month: 'Фев', catch_kg: 3120, forecast: 2800 },
    { month: 'Мар', catch_kg: 4560, forecast: 4200 },
    { month: 'Апр', catch_kg: 6780, forecast: 6500 },
    { month: 'Май', catch_kg: 8920, forecast: 8100 },
    { month: 'Июн', catch_kg: 5430, forecast: 7800, current: true },
    { month: 'Июл', catch_kg: null, forecast: 9200 },
    { month: 'Авг', catch_kg: null, forecast: 10100 },
    { month: 'Сен', catch_kg: null, forecast: 9400 },
    { month: 'Окт', catch_kg: null, forecast: 7600 },
    { month: 'Ноя', catch_kg: null, forecast: 5100 },
    { month: 'Дек', catch_kg: null, forecast: 3200 }
  ],

  // Load dynamic data from localhost PostgreSQL server
  async init() {
    try {
      console.log('Synchronizing with localhost backend server...');
      
      const catchesRes = await fetch(`${API_BASE}/catches`);
      if (catchesRes.ok) {
        this.catches = await catchesRes.json();
      }

      const fishermenRes = await fetch(`${API_BASE}/fishermen`);
      if (fishermenRes.ok) {
        this.fishermen = await fishermenRes.json();
      }

      const antifrodRes = await fetch(`${API_BASE}/antifrod`);
      if (antifrodRes.ok) {
        this.antifrodLog = await antifrodRes.json();
      }

      console.log('Database synchronization complete.');
    } catch (err) {
      console.warn('Backend server offline. Running in offline-first mode using local storage & mocks.', err);
      // Generate default offline catches if none loaded
      this.catches = [
        {
          id: 'OC-2026-000184',
          fisherman_id: 'F-001',
          vessel: 'Каспий-Стар',
          species: 'Вобла',
          species_en: 'roach',
          weight_kg: 11.8,
          verified: true,
          hardware_verified: true,
          timestamp: '2026-06-10T07:32:14Z',
          gps_lat: 43.6521,
          gps_lng: 51.1753,
          gps_label: 'Актау, Каспийское море',
          freshness_index: 96,
          oil_detected: false,
          price_per_kg: 1200,
          quota_share_used: true,
          quota_share_partner_vessel: 'EX-992',
          quota_share_partner_name: 'Баутино-Стар',
          hash: 'sha256:a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9',
          supply_chain: [
            { stage: 'sea',     label: '⚓ Море (Вылов)',            done: true,  time: '2026-06-10T07:32:14Z', inspector: 'GPS автофиксация',        temp: null,  multisig: 'auto' },
            { stage: 'port',    label: '🏗️ Порт Баутино',           done: true,  time: '2026-06-10T09:15:00Z', inspector: 'Айгерим Бекова (INS-01)', temp: 2,     multisig: 'confirmed' },
            { stage: 'factory', label: '🏭 Завод (-4°C Guard)',      done: true,  time: '2026-06-10T11:40:00Z', inspector: 'Дамир Нурмагамбетов',     temp: -4,    multisig: 'confirmed' },
            { stage: 'retail',  label: '🛒 Ритейл в Актау',         done: false, time: null,                   inspector: null,                      temp: null,  multisig: null }
          ]
        }
      ];
      this.antifrodLog = [
        { id: 'AF-0041', ts: '2026-06-10T06:12:00Z', vessel: 'Мангистау-2', species: 'roach', weight: 4.6, reason: 'Превышен биологический максимум (>3 кг)', status: 'blocked', sent_to_moderator: false }
      ];
    }
  }
};

// Session wrapper
const Session = {
  get currentUser() { try { return JSON.parse(sessionStorage.getItem('oc_user')); } catch { return null; } },
  set currentUser(u) { if (u) sessionStorage.setItem('oc_user', JSON.stringify(u)); else sessionStorage.removeItem('oc_user'); },
  get role() { const u = this.currentUser; return u ? u.role : null; }
};

// OcuChain Ledger offline blockchain
const OcuChain = {
  STORAGE_KEY: 'ocuchain_ledger',

  getChain() {
    try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || []; }
    catch { return []; }
  },

  _simHash(data) {
    const str = JSON.stringify(data);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return 'sha256:' + (h >>> 0).toString(16).padStart(8,'0') +
           (Math.abs(h * 31) >>> 0).toString(16).padStart(8,'0') +
           'ocuchain' + Date.now().toString(16);
  },

  addEntry(catchRecord) {
    const chain = this.getChain();
    const prevHash = chain.length ? chain[chain.length - 1].hash : '0000000000000000';
    const entry = {
      index: chain.length,
      timestamp: new Date().toISOString(),
      data: catchRecord,
      prevHash,
      hash: this._simHash({ ...catchRecord, prevHash })
    };
    chain.push(entry);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(chain));
    return entry;
  },

  verify() {
    const chain = this.getChain();
    if (!chain.length) return { valid: true, entries: 0 };
    for (let i = 1; i < chain.length; i++) {
      if (chain[i].prevHash !== chain[i-1].hash) {
        return { valid: false, brokenAt: i, entry: chain[i] };
      }
    }
    return { valid: true, entries: chain.length };
  }
};
