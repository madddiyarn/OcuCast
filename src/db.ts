import { Fisherman, CatchRecord, QuotaLimit, AnomalyLog, SpeciesLimit } from './types';

export const API_BASE = 'http://localhost:3001/api';

export const DB = {
  fishermen: [] as Fisherman[],
  speciesLimits: {
    roach: { max_weight_kg: 3.0, typical_weight: '0.3–1.5 кг', name_ru: 'Вобла' },
    carp: { max_weight_kg: 35.0, typical_weight: '1–8 кг', name_ru: 'Сазан' },
    sturgeon: { max_weight_kg: 120.0, typical_weight: '10–60 кг', name_ru: 'Осётр' }
  } as Record<string, SpeciesLimit>,
  
  quotas: {
    sturgeon: { species: 'sturgeon', allocated: 5000, used: 1243, unit: 'кг', icon: '🐟', label: 'Осётр' },
    carp: { species: 'carp', allocated: 45000, used: 18764, unit: 'кг', icon: '🐠', label: 'Сазан' },
    roach: { species: 'roach', allocated: 80000, used: 31882, unit: 'кг', icon: '🐡', label: 'Вобла' }
  } as Record<string, QuotaLimit>,

  catches: [] as CatchRecord[],
  antifrodLog: [] as AnomalyLog[],

  ecoMarkers: [
    { id: 'ECO-001', lat: 43.6521, lng: 51.1753, type: 'catch', label: 'OC-2026-000184', weight: 11.8, legal: true },
    { id: 'ECO-002', lat: 44.1234, lng: 50.8876, type: 'catch', label: 'OC-2026-000201', weight: 6.2, legal: true },
    { id: 'ECO-003', lat: 43.2341, lng: 51.5432, type: 'oil', label: 'Разлив #ОЙЛ-003', oil_detected: true },
    { id: 'ECO-004', lat: 44.8765, lng: 51.2341, type: 'seal', label: 'Каспийский тюлень #37', seal: true },
    { id: 'ECO-005', lat: 43.9876, lng: 50.5678, type: 'catch', label: 'OC-2026-000167', weight: 4.1, legal: true }
  ],

  monthlyCatch: [
    { month: 'Янв', catch_kg: 2341, forecast: 2100 },
    { month: 'Фев', catch_kg: 3120, forecast: 2800 },
    { month: 'Мар', catch_kg: 4560, forecast: 4200 },
    { month: 'Апр', catch_kg: 6780, forecast: 6500 },
    { month: 'Май', catch_kg: 8920, forecast: 8100 },
    { month: 'Июн', catch_kg: 5430, forecast: 7800, current: true },
    { month: 'Июл', catch_kg: null as number | null, forecast: 9200 },
    { month: 'Авг', catch_kg: null as number | null, forecast: 10100 },
    { month: 'Сен', catch_kg: null as number | null, forecast: 9400 },
    { month: 'Окт', catch_kg: null as number | null, forecast: 7600 },
    { month: 'Ноя', catch_kg: null as number | null, forecast: 5100 },
    { month: 'Дек', catch_kg: null as number | null, forecast: 3200 }
  ],

  async init() {
    try {
      const catchesRes = await fetch(`${API_BASE}/catches`);
      if (catchesRes.ok) {
        this.catches = await catchesRes.json();
      }
      const fishermenRes = await fetch(`${API_BASE}/fishermen`);
      if (fishermenRes.ok) {
        const rawFishermen = await fishermenRes.json();
        this.fishermen = rawFishermen.map((f: any) => ({
          id: f.id,
          name: f.name,
          vessel: f.vessel,
          status: f.status,
          greenScore: f.green_score,
          login: f.login,
          password: f.password
        }));
      }
      const antifrodRes = await fetch(`${API_BASE}/antifrod`);
      if (antifrodRes.ok) {
        const rawLog = await antifrodRes.json();
        this.antifrodLog = rawLog.map((x: any) => ({
          id: x.id,
          timestamp: x.ts,
          vessel: x.vessel,
          species: x.species,
          weight: parseFloat(x.weight),
          description: x.reason,
          status: x.status,
          sent_to_moderator: x.sent_to_moderator
        }));
      }
    } catch (e) {
      console.warn('Postgres connection failed. Fallback to LocalStorage ledger and static data.');
      
      // Fallback fishermen
      this.fishermen = [
        { id: 'fisher1', name: 'Капитан Ivanov', vessel: 'ТМ-081', status: 'approved', greenScore: 98, login: 'fisher1', password: 'demo' },
        { id: 'fisher2', name: 'Болат Жунисов', vessel: 'Мангистау', status: 'pending', greenScore: 71, login: 'fisher2', password: 'demo' },
        { id: 'fisher3', name: 'Серік Аблаев', vessel: 'Ак-Жол', status: 'approved', greenScore: 88, login: 'fisher3', password: 'demo' }
      ];

      // Fallback catches
      this.catches = [
        {
          id: 'OC-2026-000184',
          fisherman_id: 'fisher1',
          vessel: 'ТМ-081',
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
          quota_share_partner_name: 'Каспий-Стар',
          hash: 'sha256:a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9',
          supply_chain: [
            { stage: 'sea', label: '⚓ Море (Вылов)', done: true, time: '2026-06-10T07:32:14Z', inspector: 'GPS автофиксация', temp: null, multisig: 'auto' },
            { stage: 'port', label: '🏗️ Порт Баутино', done: true, time: '2026-06-10T09:15:00Z', inspector: 'Айгерим Бекова (INS-01)', temp: 2, multisig: 'confirmed' },
            { stage: 'factory', label: '🏭 Завод (-4°C Guard)', done: true, time: '2026-06-10T11:40:00Z', inspector: 'Дамир Нурмагамбетов', temp: -4, multisig: 'confirmed' },
            { stage: 'retail', label: '🛒 Ритейл в Актау', done: false, time: null, inspector: null, temp: null, multisig: null }
          ]
        }
      ];

      // Fallback antifrod logs
      this.antifrodLog = [
        { id: 'AF-0041', timestamp: '2026-06-10T06:12:00Z', vessel: 'ТМ-081', species: 'roach', weight: 4.6, description: 'Превышен биологический максимум (>3 кг)', status: 'blocked', sent_to_moderator: false }
      ];
    }
  }
};

export const OcuChain = {
  STORAGE_KEY: 'ocuchain_ledger',

  getChain(): any[] {
    try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]'); }
    catch { return []; }
  },

  _simHash(data: any): string {
    const str = JSON.stringify(data);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return 'sha256:' + (h >>> 0).toString(16).padStart(8, '0') +
           (Math.abs(h * 31) >>> 0).toString(16).padStart(8, '0') +
           'ocuchain' + Date.now().toString(16);
  },

  addEntry(catchRecord: any): { index: number, timestamp: string, data: any, prevHash: string, hash: string } {
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

  verify(): { valid: boolean, brokenAt?: number, entry?: any, entries: number } {
    const chain = this.getChain();
    if (!chain.length) return { valid: true, entries: 0 };
    for (let i = 1; i < chain.length; i++) {
      if (chain[i].prevHash !== chain[i - 1].hash) {
        return { valid: false, brokenAt: i, entry: chain[i], entries: chain.length };
      }
    }
    return { valid: true, entries: chain.length };
  }
};
