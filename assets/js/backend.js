/**
 * OcuCast — Backend Client Controller
 * Translates SPA actions to Express Server API calls.
 */

const OcuQuota = {
  /**
   * Check if fisherman's personal quota is exceeded
   * and automatically find/rent quota shares from other vessels
   */
  checkAndShare(fisherman_id, species_en, additional_kg) {
    const fisherman = DB.fishermen.find(f => f.id === fisherman_id);
    if (!fisherman) return { success: false, error: 'Рыбак не найден' };

    const remaining = fisherman.personal_quota[species_en] - fisherman.used_quota[species_en];

    if (additional_kg <= remaining) {
      return { success: true, quota_ok: true, message: 'Персональный лимит достаточен' };
    }

    const deficit = additional_kg - remaining;

    // Search available quota among other fishermen
    const donors = DB.fishermen.filter(f =>
      f.id !== fisherman_id &&
      f.status === 'approved' &&
      (f.personal_quota[species_en] - f.used_quota[species_en]) >= deficit
    );

    if (!donors.length) {
      return {
        success: false,
        quota_exceeded: true,
        deficit_kg: deficit,
        message: `Превышение квоты: ${deficit} кг. Доноры не найдены.`
      };
    }

    const donor = donors.find(d => d.vessel === 'Каспий-Стар') || donors[0];
    const tx_id = 'EX-' + Math.floor(Math.random() * 1000);

    // Update quota locally
    donor.used_quota[species_en] += deficit;
    fisherman.used_quota[species_en] += additional_kg;

    return {
      success: true,
      quota_ok: true,
      quota_share_used: true,
      deficit_kg: deficit,
      donor_vessel: donor.vessel,
      donor_vessel_id: donor.vessel_id,
      donor_name: donor.name,
      tx_id,
      message: `✅ Прилов легализован через Smart-Exchange с судном "${donor.vessel}" (${tx_id})`
    };
  }
};

const AntiGravity = {
  check(species_en, weight_kg, gyro_angle_deg = 12) {
    const limit = DB.speciesLimits[species_en];
    if (!limit) return { blocked: false, checks: [], warning: 'Вид не определен' };

    const checks = [];
    let blocked = false;

    // 1. Biological maximum weight
    const bioOk = weight_kg <= limit.max_weight_kg;
    checks.push({
      label: `Биологический максимум веса`,
      value: `${weight_kg} кг`,
      limit: `≤ ${limit.max_weight_kg} кг`,
      passed: bioOk,
      critical: !bioOk
    });
    if (!bioOk) blocked = true;

    // 2. Typical weight
    const typicalOk = weight_kg <= limit.max_weight_kg * 0.85;
    checks.push({
      label: `Типичный вес вида`,
      value: `${weight_kg} кг`,
      limit: `≤ ${(limit.max_weight_kg * 0.85).toFixed(1)} кг (умеренное отклонение)`,
      passed: typicalOk,
      critical: !typicalOk && !bioOk
    });

    // 3. Gyroscope angle
    const gyroOk = gyro_angle_deg <= 45;
    checks.push({
      label: `Угол наклона камеры (Гироскоп)`,
      value: `${gyro_angle_deg}°`,
      limit: '≤ 45°',
      passed: gyroOk,
      critical: !gyroOk
    });
    if (!gyroOk) blocked = true;

    // 4. Min weight
    const minOk = weight_kg >= 0.1;
    checks.push({
      label: `Минимальный регистрируемый вес`,
      value: `${weight_kg} кг`,
      limit: '≥ 0.1 кг',
      passed: minOk,
      critical: !minOk
    });
    if (!minOk) blocked = true;

    return { blocked, checks, species: limit.name_ru, weight_kg };
  },

  renderAlert(result) {
    const rows = result.checks.map(c => `
      <div class="check-row" style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(239, 68, 68, 0.1);">
        <span class="check-icon" style="color: ${c.passed ? 'var(--green)' : 'var(--red)'}; font-weight: bold;">
          ${c.passed ? '✓' : '✗'}
        </span>
        <div class="check-text" style="font-size: 13px; color: #7F1D1D;">
          ${c.label}: <strong>${c.value}</strong> (лимит: ${c.limit})
        </div>
      </div>
    `).join('');

    return `
      <div class="antigravity-alert" id="ag-alert" style="border: 2px solid var(--red); border-radius: 12px; background: var(--red-light); overflow: hidden; margin-top: 16px;">
        <div class="antigravity-header" style="background: var(--red); padding: 12px 16px; color: white; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">🛡️</span>
          <h4 style="margin: 0; font-weight: 800; font-size: 14px;">❌ AntiGravity: Транзакция заблокирована</h4>
        </div>
        <div class="antigravity-body" style="padding: 16px;">
          ${rows}
          <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
            <button class="btn btn-danger btn-sm" onclick="AntiGravity.sendToModerator()">
              📨 Отправить на ручную модерацию инспектору Акимата
            </button>
          </div>
        </div>
      </div>
    `;
  },

  async sendToModerator() {
    const w = parseFloat(document.getElementById('sim-weight-slider')?.value || 4.6);
    const pending = {
      id: 'AF-' + Math.floor(1000 + Math.random() * 9000),
      vessel: Session.currentUser?.vessel || 'Неизвестно',
      species: 'roach',
      weight: w,
      reason: 'Превышен биологический максимум — отправлено на модерацию',
      status: 'pending_review',
      sent_to_moderator: true
    };

    try {
      const response = await fetch(`${API_BASE}/antifrod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending)
      });
      if (response.ok) {
        await DB.init(); // Refresh DB
      }
    } catch (e) {
      // Offline fallback
      DB.antifrodLog.unshift({ ...pending, ts: new Date().toISOString() });
    }

    const alertEl = document.getElementById('ag-alert');
    if (alertEl) {
      alertEl.innerHTML = `
        <div class="alert alert-amber" style="margin: 0; padding: 14px;">
          <span class="alert-icon">📨</span>
          <div><strong>Заявка отправлена на модерацию.</strong> Инспектор Акимата рассмотрит ее в ближайшее время. ID: ${pending.id}</div>
        </div>
      `;
    }
  }
};

const OcuLock = {
  isLocked(vessel_id) { 
    return !OcuChain.verify().valid; 
  }
};

const CatchController = {
  async submit({ fisherman_id, species_en, weight_kg, gyro_angle = 12 }) {
    // 1. AntiGravity check
    const agResult = AntiGravity.check(species_en, weight_kg, gyro_angle);
    if (agResult.blocked) {
      return { success: false, stage: 'antifrod', agResult };
    }

    // 2. OcuLock check
    const fisherman = DB.fishermen.find(f => f.id === fisherman_id);
    if (!fisherman) return { success: false, error: 'Рыбак не найден' };
    if (OcuLock.isLocked(fisherman.vessel_id)) {
      return { success: false, error: 'Лицензия заблокирована OcuLock из-за разрыва хэш-цепочки.' };
    }

    // 3. Quota check & lease
    const quotaResult = OcuQuota.checkAndShare(fisherman_id, species_en, weight_kg);

    // 4. Offline blockchain record creation
    const record = {
      fisherman_id,
      vessel: fisherman.vessel,
      species: DB.speciesLimits[species_en]?.name_ru || species_en,
      species_en,
      weight_kg,
      gps_lat: 43.6521 + (Math.random() - 0.5) * 0.1,
      gps_lng: 51.1753 + (Math.random() - 0.5) * 0.1,
      freshness_index: 96,
      quota_share_used: quotaResult.quota_share_used || false,
      quota_share_partner_vessel: quotaResult.tx_id || null,
      quota_share_partner_name: quotaResult.donor_vessel || null,
      supply_chain: [
        { stage: 'sea', label: '⚓ Море (Вылов)', done: true, time: new Date().toISOString(), inspector: 'GPS автофиксация', temp: null, multisig: 'auto' },
        { stage: 'port', label: '🏗️ Порт', done: false, time: null, inspector: null, temp: null, multisig: null },
        { stage: 'factory', label: '🏭 Завод', done: false, time: null, inspector: null, temp: null, multisig: null },
        { stage: 'retail', label: '🛒 Ритейл', done: false, time: null, inspector: null, temp: null, multisig: null }
      ]
    };

    const ledgerEntry = OcuChain.addEntry(record);
    record.hash = ledgerEntry.hash;

    // 5. Submit to backend API
    try {
      const response = await fetch(`${API_BASE}/catches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...record, hash: ledgerEntry.hash })
      });
      if (response.ok) {
        const resultRecord = await response.json();
        await DB.init();
        return { success: true, record: resultRecord, quotaResult };
      }
    } catch (e) {
      console.warn('Backend connection failed. Storing locally.');
    }

    // Fallback offline submission
    record.id = `OC-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    record.timestamp = new Date().toISOString();
    record.gps_label = 'Актау, море (Offline)';
    record.price_per_kg = species_en === 'sturgeon' ? 5000 : 1200;
    record.verified = true;
    record.hardware_verified = true;
    
    DB.catches.unshift(record);
    return { success: true, record, quotaResult };
  }
};

const Auth = {
  login(login, password) {
    const fisherman = DB.fishermen.find(f => f.login === login && f.password === password);
    if (fisherman) {
      const user = { ...fisherman, role: 'fisherman' };
      delete user.password;
      Session.currentUser = user;
      return { success: true, user, role: 'fisherman' };
    }
    const inspector = DB.inspectors.find(i => i.login === login && i.password === password);
    if (inspector) {
      const role = inspector.role === 'admin' ? 'admin' : 'inspector';
      const user = { ...inspector, role };
      delete user.password;
      Session.currentUser = user;
      return { success: true, user, role };
    }
    return { success: false, error: 'Неверный логин или пароль' };
  },

  logout() { Session.currentUser = null; }
};

const CheckpointController = {
  async registerStage({ catch_id, stage, temperature, location, inspector_name, inspector_id }) {
    try {
      const response = await fetch(`${API_BASE}/checkpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catch_id, stage, temperature, location, inspector_name })
      });
      if (response.ok) {
        await DB.init();
        return { success: true };
      }
    } catch (e) {
      console.warn('Backend server unreachable, falling back to local simulation.');
    }

    // Local simulation fallback
    const record = DB.catches.find(c => c.id === catch_id);
    if (!record) return { success: false, error: 'ID улова не найден' };

    const sc = record.supply_chain;
    const idx = sc.findIndex(s => s.stage === stage);
    if (idx !== -1) {
      sc[idx] = {
        ...sc[idx],
        done: true,
        time: new Date().toISOString(),
        inspector: inspector_name,
        temp: temperature,
        location,
        multisig: 'confirmed'
      };
      OcuChain.addEntry({ type: 'checkpoint', catch_id, stage, inspector: inspector_name });
      return { success: true, record };
    }
    return { success: false, error: 'Этап не найден' };
  }
};

const AIAnalysis = {
  async analyze(imageBase64, species_en, weight_kg) {
    try {
      const response = await fetch(`${API_BASE}/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, species_en, weight_kg })
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('AI analysis endpoint failed, returning simulation.');
    }
    return {
      species_confidence: 98,
      anomaly_detection: 94,
      freshness_index: 96,
      bio_status: 'normal'
    };
  }
};
