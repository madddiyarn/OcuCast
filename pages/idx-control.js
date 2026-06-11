window.IdxControlPage = function() {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  let currentGyroAngle = 12;

  function render() {
    const chainStatus = OcuChain.verify();
    
    let logLines = '';
    
    DB.antifrodLog.forEach(log => {
      const speciesName = DB.speciesLimits[log.species]?.name_ru || log.species;
      const limitVal = DB.speciesLimits[log.species]?.max_weight_kg || 3.0;
      
      logLines += `
        <div class="terminal-line">
          <span class="ts">[${new Date(log.ts).toLocaleTimeString()}]</span>
          <span class="err">[ANOMALY]</span>
          <span class="msg">Судно "${log.vessel}": Фиксация ${speciesName} весом ${log.weight} кг отклонена. Био-лимит: ≤ ${limitVal} кг</span>
        </div>
      `;
    });

    logLines += `
      <div class="terminal-line">
        <span class="ts">[13:00:02]</span>
        <span class="ok">[SUCCESS]</span>
        <span class="msg">Интерфейс связи с верифицированными IoT весами Актау активирован.</span>
      </div>
      <div class="terminal-line">
        <span class="ts">[13:00:01]</span>
        <span class="info">[INFO]</span>
        <span class="msg">Модуль пространственного позиционирования гироскопа IMU откалиброван.</span>
      </div>
      <div class="terminal-line">
        <span class="ts">[13:00:00]</span>
        <span class="info">[INFO]</span>
        <span class="msg">OcuChain Ledger инициализирован. Интегрировано блоков в цепь: ${DB.catches.length}.</span>
      </div>
    `;

    container.innerHTML = `
      <style>
        .cyber-panel {
          background: #090d16 !important;
          border: 1px solid rgba(6, 182, 212, 0.15) !important;
          color: #f8fafc !important;
        }
        .cyber-title {
          color: #06b6d4 !important;
          font-family: 'Courier New', monospace;
          text-shadow: 0 0 10px rgba(6, 182, 212, 0.4);
        }
        .cyber-alert-red {
          background: rgba(239, 68, 68, 0.08) !important;
          border: 1.5px solid #ef4444 !important;
          color: #fecaca !important;
        }
        .cyber-alert-green {
          background: rgba(16, 185, 129, 0.08) !important;
          border: 1.5px solid #10b981 !important;
          color: #d1fae5 !important;
        }
      </style>

      <div style="background: #020617; border-radius: 24px; padding: 32px; border: 1px solid #1e293b; color: #f8fafc;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
          <div>
            <h1 class="cyber-title" style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin: 0;">
              📡 Кибер-Центр Технологического Надзора и Антифрода
            </h1>
            <p style="color: #94a3b8; font-size: 13.5px; margin-top: 4px; font-family: monospace;">
              Служба контроля физико-цифровой инфраструктуры OcuCast
            </p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.6fr 1fr; gap: 32px;" class="passport-grid">
          
          <!-- Left: Logs -->
          <div style="display: flex; flex-direction: column; gap: 32px;">
            <div class="card cyber-panel">
              <div class="card-header" style="border-bottom: 1px solid #1e293b; padding-bottom: 16px;">
                <div class="card-title" style="color: #fff;">🛡️ AI Cross-Check Anomaly Detector Logs</div>
              </div>
              <div class="card-body" style="padding: 0;">
                <div class="terminal" style="border-radius: 0; border: none;">
                  <div class="terminal-bar" style="background: #0f172a;">
                    <div class="terminal-dot red"></div>
                    <div class="terminal-dot amber"></div>
                    <div class="terminal-dot green"></div>
                    <div class="terminal-title">antifrod_neural_model.log</div>
                  </div>
                  <div class="terminal-body" style="height: 300px; background: #030712;">
                    ${logLines}
                  </div>
                </div>
              </div>
            </div>

            <!-- Active incident resolutions -->
            <div class="card cyber-panel">
              <div class="card-header" style="border-bottom: 1px solid #1e293b; padding-bottom: 16px;">
                <div class="card-title" style="color:#fff;">⚠️ Активные инциденты блокировок AntiGravity</div>
              </div>
              <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
                ${DB.antifrodLog.map(log => {
                  const isPending = log.status === 'pending_review' || log.status === 'blocked';
                  return `
                    <div class="alert cyber-alert-red">
                      <span style="font-size:24px;">🚫</span>
                      <div style="width: 100%;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                          <strong style="color: #f87171;">Инцидент #${log.id} — Блокировка AntiGravity</strong>
                          <span class="badge badge-red">${log.status}</span>
                        </div>
                        <p style="font-size:12.5px; margin-top:6px; line-height:1.5;">
                          Судно: <strong>"${log.vessel}"</strong> | Вес улова: <strong>${log.weight} кг</strong> (Лимит вида: ≤ 3.0 кг)<br>
                          Причина: ${log.reason}
                        </p>
                        ${isPending ? `
                          <div style="margin-top:12px; display:flex; gap:8px;">
                            <button class="btn btn-primary btn-sm btn-approve-incident" data-id="${log.id}" style="background: #10b981; box-shadow:none;">Одобрить прилов</button>
                            <button class="btn btn-danger btn-sm btn-reject-incident" data-id="${log.id}" style="box-shadow:none;">Отклонить</button>
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
                ${DB.antifrodLog.length === 0 ? '<p style="color:#94a3b8; text-align:center;">Инцидентов нет.</p>' : ''}
              </div>
            </div>
          </div>

          <!-- Right: Gyro & Blockchain lock -->
          <div style="display: flex; flex-direction: column; gap: 32px;">
            <div class="card cyber-panel">
              <div class="card-header">
                <div class="card-title" style="color:#fff;">📐 Датчик пространственной стабильности</div>
              </div>
              <div class="card-body">
                <div style="text-align: center; padding: 24px 0;">
                  <div style="width: 120px; height: 120px; border-radius: 50%; border: 3px dashed var(--cyan); margin: 0 auto; display: flex; align-items: center; justify-content: center; position: relative;">
                    <div id="gyro-indicator-line" style="width: 100px; height: 3px; background: #ef4444; transform: rotate(${currentGyroAngle}deg);"></div>
                    <div style="position: absolute; width: 10px; height: 10px; background: var(--cyan); border-radius: 50%;"></div>
                  </div>
                  <div style="font-size: 20px; font-weight: 800; font-family: monospace; color: var(--cyan); margin-top: 16px;">
                    <span id="gyro-degree-val">${currentGyroAngle}</span>°
                  </div>
                </div>
                <div style="border-top:1px solid #1e293b; padding-top:16px;">
                  <input type="range" id="idx-gyro-sim" min="0" max="90" value="${currentGyroAngle}" style="width:100%; accent-color: var(--cyan);">
                </div>
              </div>
            </div>

            <div class="card cyber-panel">
              <div class="card-header"><div class="card-title" style="color:#fff;">🔐 LocalStorage Integrity (OcuChain Ledger)</div></div>
              <div class="card-body">
                ${chainStatus.valid 
                  ? `<div class="alert cyber-alert-green" style="margin-bottom: 16px;">
                      <span style="font-size:20px;">✓</span>
                      <div>Цепочка блоков OcuChain валидна. Разрывов хэшей не обнаружено.</div>
                     </div>`
                  : `<div class="alert cyber-alert-red" style="margin-bottom: 16px;">
                      <span style="font-size:20px;">🚨</span>
                      <div><strong>ОБНАРУЖЕН ВЗЛОМ!</strong> Разрыв на блоке #${chainStatus.brokenAt}. OcuLock активирован.</div>
                     </div>`
                }
                <button id="btn-simulate-db-hack" class="btn btn-danger btn-block btn-sm" style="font-family: monospace;">
                  💥 Симулировать ручной взлом JSON рыбаком
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;

    const gyroSlider = container.querySelector('#idx-gyro-sim');
    const gyroLine = container.querySelector('#gyro-indicator-line');
    const gyroVal = container.querySelector('#gyro-degree-val');

    gyroSlider.oninput = (e) => {
      currentGyroAngle = parseInt(e.target.value);
      gyroLine.style.transform = `rotate(${currentGyroAngle}deg)`;
      gyroVal.textContent = currentGyroAngle;
    };

    container.querySelector('#btn-simulate-db-hack').onclick = () => {
      const chain = OcuChain.getChain();
      if (chain.length > 1) {
        chain[chain.length - 1].prevHash = 'sha256:FAKE_HACK_HASH_123456';
        localStorage.setItem(OcuChain.STORAGE_KEY, JSON.stringify(chain));
        alert('Разрыв спровоцирован. Перезапуск...');
        render();
      } else {
        alert('Недостаточно записей в OcuChain.');
      }
    };

    container.querySelectorAll('.btn-approve-incident').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const log = DB.antifrodLog.find(l => l.id === id);
        if (log) {
          try {
            log.status = 'approved_manually';
            await fetch(`${API_BASE}/antifrod`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(log)
            });

            const newCatch = {
              fisherman_id: 'F-001',
              vessel: log.vessel,
              species: 'Вобла',
              species_en: 'roach',
              weight_kg: parseFloat(log.weight),
              gps_lat: 43.6521,
              gps_lng: 51.1753,
              freshness_index: 90,
              quota_share_used: false,
              supply_chain: [
                { stage: 'sea', label: '⚓ Море (Вылов)', done: true, time: new Date().toISOString(), inspector: 'Ручная модерация Акимата', temp: null, multisig: 'manual' }
              ]
            };
            const ledgerEntry = OcuChain.addEntry(newCatch);
            newCatch.hash = ledgerEntry.hash;

            await fetch(`${API_BASE}/catches`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newCatch)
            });

            await DB.init();
            render();
          } catch(e) {}
        }
      };
    });

    container.querySelectorAll('.btn-reject-incident').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        try {
          await fetch(`${API_BASE}/antifrod/${id}`, { method: 'DELETE' });
          await DB.init();
          render();
        } catch(e) {}
      };
    });
  }

  render();
  return container;
};
