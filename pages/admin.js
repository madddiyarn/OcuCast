/**
 * OcuCast — Ситуационный центр Акимата (Light Mode)
 * Подключается к Node.js API серверу (PostgreSQL).
 */

window.AdminPage = function() {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  let mapInstance = null;
  let activeTab = 'quotas'; // quotas | anomalies | fishermen

  function render() {
    const user = Session.currentUser;

    if (!user || user.role !== 'admin') {
      renderLogin();
      return;
    }

    renderDashboard();
  }

  function renderLogin() {
    container.innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          <h2 style="font-size: 20px; font-weight: 800; color: var(--navy); text-align: center; margin-bottom: 24px;">Акимат Ситуационный Центр</h2>
          <div id="admin-login-err"></div>
          <form id="form-admin-login">
            <div class="form-group">
              <label class="form-label">Суперадминистратор</label>
              <input type="text" id="adm-u" class="form-input" value="admin" required>
            </div>
            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label">Пароль</label>
              <input type="password" id="adm-p" class="form-input" value="admin" required>
            </div>
            <button class="btn btn-primary btn-block">Авторизоваться</button>
          </form>
        </div>
      </div>
    `;
    container.querySelector('#form-admin-login').onsubmit = (e) => {
      e.preventDefault();
      const res = Auth.login(container.querySelector('#adm-u').value, container.querySelector('#adm-p').value);
      if (res.success && res.role === 'admin') render();
      else container.querySelector('#admin-login-err').innerHTML = `<div class="alert alert-red" style="margin-bottom: 12px;">Отказано в доступе</div>`;
    };
  }

  function renderDashboard() {
    // Calculate quotas
    const currentQuotaUsed = { sturgeon: 1243, carp: 18764, roach: 31882 };
    DB.catches.forEach(c => {
      if (c.species_en === 'sturgeon') currentQuotaUsed.sturgeon += c.weight_kg;
      if (c.species_en === 'carp') currentQuotaUsed.carp += c.weight_kg;
      if (c.species_en === 'roach') currentQuotaUsed.roach += c.weight_kg;
    });

    const sturgeonPct = ((currentQuotaUsed.sturgeon / DB.nationalQuota2026.sturgeon.total) * 100).toFixed(0);
    const carpPct = ((currentQuotaUsed.carp / DB.nationalQuota2026.carp.total) * 100).toFixed(0);
    const roachPct = ((currentQuotaUsed.roach / DB.nationalQuota2026.roach.total) * 100).toFixed(0);

    // Chart configs
    const months = DB.monthlyCatch;
    const maxVal = 12000;
    const width = 600;
    const height = 180;
    const padding = 20;

    const barsHtml = months.map((m, i) => {
      if (m.catch_kg === null) return '';
      const x = padding + i * ((width - 2 * padding) / (months.length - 1));
      const barHeight = (m.catch_kg / maxVal) * (height - 2 * padding);
      const y = height - padding - barHeight;
      return `<rect x="${x - 6}" y="${y}" width="12" height="${barHeight}" fill="rgba(30,58,138,0.7)" rx="3" />`;
    }).join('');

    const points = months.map((m, i) => {
      const x = padding + i * ((width - 2 * padding) / (months.length - 1));
      const val = m.catch_kg !== null ? m.catch_kg : m.forecast;
      const y = height - padding - (val / maxVal) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(' ');

    const labelsHtml = months.map((m, i) => {
      const x = padding + i * ((width - 2 * padding) / (months.length - 1));
      return `<text x="${x}" y="${height - 2}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${m.month}</text>`;
    }).join('');

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h1 style="font-size: 26px; font-weight: 800; color: var(--navy); letter-spacing: -0.5px;">
            Ситуационный дашборд Акимата
          </h1>
          <p style="color: var(--text-secondary); font-size: 13.5px;">Экологический радарный мониторинг и управление квотами</p>
        </div>
        <button id="btn-admin-logout" class="btn btn-outline btn-sm">Выйти</button>
      </div>

      <!-- Quick stats -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 32px;">
        <div class="stat-card">
          <div class="stat-label">Всего судов в системе</div>
          <div class="stat-value">${DB.fishermen.length}<span class="stat-suffix">судов</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Зафиксировано уловов</div>
          <div class="stat-value">${DB.catches.length}<span class="stat-suffix">партий</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Экологические аномалии</div>
          <div class="stat-value" style="color: var(--red);">1<span class="stat-suffix" style="color: var(--red);">активная</span></div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 32px;" class="passport-grid">
        
        <!-- Left: Map and Moderation -->
        <div style="display: flex; flex-direction: column; gap: 32px;">
          <div class="card" style="border-radius: 16px;">
            <div class="card-header"><div class="card-title">Caspian Environmental Heatmap</div></div>
            <div class="card-body" style="padding: 0;">
              <div id="admin-map" style="height: 380px; width: 100%;"></div>
            </div>
          </div>

          <!-- Moderation registry -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">🚤 Модерация флота и Green Captain Score</div>
            </div>
            <div class="card-body" style="padding: 0;">
              <div style="overflow-x: auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Капитан / Судно</th>
                      <th>Эко-Рейтинг</th>
                      <th>Статус</th>
                      <th style="text-align: right;">Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${DB.fishermen.map(f => `
                      <tr>
                        <td><strong>${f.name}</strong><br><span style="font-size:11px; color:var(--text-muted);">${f.vessel}</span></td>
                        <td><strong style="color: ${f.green_score > 80 ? 'var(--green)':'var(--amber)'}">${f.green_score}%</strong></td>
                        <td><span class="badge ${f.status==='approved'?'badge-green':f.status==='pending'?'badge-amber':'badge-red'}">${f.status}</span></td>
                        <td style="text-align: right;">
                          ${f.status !== 'approved' ? `<button class="btn btn-primary btn-sm btn-action-approve" data-id="${f.id}" style="padding: 4px 8px; font-size:11px;">Аппрув</button>` : ''}
                          ${f.status !== 'blocked' ? `<button class="btn btn-danger btn-sm btn-action-block" data-id="${f.id}" style="padding: 4px 8px; font-size:11px; margin-left: 4px;">Блок</button>` : ''}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side: Quotas, Forecast and Anomalies Log -->
        <div style="display: flex; flex-direction: column; gap: 32px;">
          <!-- Tabs Navigation -->
          <div class="tabs">
            <button class="tab-btn ${activeTab === 'quotas' ? 'active' : ''}" data-tab="quotas">Квоты РК</button>
            <button class="tab-btn ${activeTab === 'anomalies' ? 'active' : ''}" data-tab="anomalies">Лог аномалий</button>
          </div>

          <!-- Tab Content 1: Quotas -->
          <div class="tab-panel ${activeTab === 'quotas' ? 'active' : ''}">
            <div class="card" style="padding: 24px; border-radius: 16px; margin-bottom: 24px;">
              <h3 style="font-size: 14px; margin-bottom: 20px; color: var(--navy);">Шкала расхода лимитов на 2026 год</h3>
              <div class="quota-item">
                <div class="quota-header"><span>🐟 Осётр</span><span>${currentQuotaUsed.sturgeon.toFixed(1)} / ${DB.nationalQuota2026.sturgeon.total} кг</span></div>
                <div class="progress-track"><div class="progress-fill progress-red" style="width: ${sturgeonPct}%"></div></div>
              </div>
              <div class="quota-item" style="margin-top: 16px;">
                <div class="quota-header"><span>🐠 Сазан</span><span>${currentQuotaUsed.carp.toFixed(1)} / ${DB.nationalQuota2026.carp.total} кг</span></div>
                <div class="progress-track"><div class="progress-fill progress-navy" style="width: ${carpPct}%"></div></div>
              </div>
              <div class="quota-item" style="margin-top: 16px;">
                <div class="quota-header"><span>🐡 Вобла</span><span>${currentQuotaUsed.roach.toFixed(1)} / ${DB.nationalQuota2026.roach.total} кг</span></div>
                <div class="progress-track"><div class="progress-fill progress-cyan" style="width: ${roachPct}%"></div></div>
              </div>
            </div>

            <!-- SVG Dynamics -->
            <div class="card" style="padding: 20px; border-radius: 16px;">
              <h4 style="font-size: 13px; margin-bottom: 12px;">ИИ-Прогноз истощения ресурсов</h4>
              <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto;">
                <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="#E2E8F0" stroke-dasharray="4" />
                <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#CBD5E1" stroke-width="1.5" />
                ${barsHtml}
                <polyline fill="none" stroke="var(--cyan)" stroke-width="3" stroke-dasharray="4, 4" points="${points}" />
                ${labelsHtml}
              </svg>
            </div>
          </div>

          <!-- Tab Content 2: Anomalies Log -->
          <div class="tab-panel ${activeTab === 'anomalies' ? 'active' : ''}">
            <div class="card" style="padding: 24px; border-radius: 16px;">
              <h3 style="font-size: 14px; color: var(--navy); margin-bottom: 16px;">AI Cross-Check Инциденты</h3>
              <div style="display: flex; flex-direction: column; gap: 14px;">
                ${DB.antifrodLog.map(log => {
                  const isPending = log.status === 'pending_review' || log.status === 'blocked';
                  return `
                    <div style="border: 1.5px solid ${isPending ? 'var(--red)' : '#E2E8F0'}; border-radius: 12px; padding: 14px; background: ${isPending ? 'var(--red-light)' : '#F8FAFC'};">
                      <div style="display: flex; justify-content: space-between; font-size: 11px;">
                        <strong>ID: ${log.id}</strong>
                        <span class="badge ${isPending ? 'badge-red' : 'badge-green'}">${log.status}</span>
                      </div>
                      <p style="font-size: 12.5px; margin: 8px 0; line-height: 1.5;">
                        Судно: <strong>${log.vessel}</strong> | Объект: <strong>Вобла</strong><br>
                        Вес улова: <strong>${log.weight} кг</strong> (Норматив ≤ 3.0 кг)<br>
                        Причина блокировки: ${log.reason}
                      </p>
                      ${isPending ? `
                        <button class="btn btn-cyan btn-sm btn-action-approve-quota" data-id="${log.id}" style="width: 100%; margin-top: 8px;">
                          Легализовать прилов через OcuQuota Share
                        </button>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
                ${DB.antifrodLog.length === 0 ? '<p style="color:var(--text-muted); text-align:center;">Аномалий не обнаружено.</p>' : ''}
              </div>
            </div>
          </div>

        </div>

      </div>
    `;

    // Events
    container.querySelector('#btn-admin-logout').onclick = () => { Auth.logout(); render(); };

    // Tabs
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => {
        activeTab = btn.getAttribute('data-tab');
        renderDashboard();
      };
    });

    // Fisherman Approval status modifier
    container.querySelectorAll('.btn-action-approve').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        try {
          await fetch(`${API_BASE}/fishermen/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: 'approved' })
          });
          await DB.init();
          renderDashboard();
        } catch(e) {}
      };
    });

    container.querySelectorAll('.btn-action-block').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        try {
          await fetch(`${API_BASE}/fishermen/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: 'blocked' })
          });
          await DB.init();
          renderDashboard();
        } catch(e) {}
      };
    });

    // Quota lease approve
    container.querySelectorAll('.btn-action-approve-quota').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const log = DB.antifrodLog.find(x => x.id === id);
        if (log) {
          try {
            log.status = 'approved_manually';
            
            // Post status update
            await fetch(`${API_BASE}/antifrod`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(log)
            });

            // Create approved catch record
            const newCatch = {
              fisherman_id: 'F-001',
              vessel: log.vessel,
              species: 'Вобла',
              species_en: 'roach',
              weight_kg: parseFloat(log.weight),
              gps_lat: 43.6521,
              gps_lng: 51.1753,
              freshness_index: 96,
              quota_share_used: true,
              quota_share_partner_vessel: 'EX-992',
              quota_share_partner_name: 'Каспий-Стар',
              supply_chain: [
                { stage: 'sea', label: '⚓ Море (Вылов)', done: true, time: new Date().toISOString(), inspector: 'Акимат Модерация', temp: null, multisig: 'manual' },
                { stage: 'port', label: '🏗️ Порт Баутино', done: false, time: null, inspector: null, temp: null, multisig: null },
                { stage: 'factory', label: '🏭 Завод', done: false, time: null, inspector: null, temp: null, multisig: null },
                { stage: 'retail', label: '🛒 Ритейл', done: false, time: null, inspector: null, temp: null, multisig: null }
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
            alert(`Прилов судна ${log.vessel} успешно легализован с использованием OcuQuota Share!`);
            renderDashboard();
          } catch (e) {
            console.error(e);
          }
        }
      };
    });

    initMap();
  }

  function initMap() {
    setTimeout(() => {
      const mapDiv = container.querySelector('#admin-map');
      if (!mapDiv) return;
      if (mapInstance) mapInstance.remove();

      mapInstance = L.map(mapDiv).setView([43.85, 51.0], 8);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri Satellite'
      }).addTo(mapInstance);

      DB.ecoMarkers.forEach(m => {
        if (m.type === 'oil') {
          const redIcon = L.divIcon({
            className: 'pulse-red-marker',
            html: '<div style="width: 14px; height: 14px; background-color: #EF4444; border: 2px solid white; border-radius: 50%;"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          });
          L.marker([m.lat, m.lng], { icon: redIcon }).addTo(mapInstance)
            .bindPopup(`<strong>🚨 Разлив нефти</strong><br>Немедленный сигнал тревоги`);
        } else if (m.type === 'seal') {
          const sealIcon = L.divIcon({
            html: '<div style="width:14px; height:14px; background-color:#06B6D4; border:2px solid white; border-radius:50%; box-shadow:0 0 8px #06B6D4;"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          });
          L.marker([m.lat, m.lng], { icon: sealIcon }).addTo(mapInstance)
            .bindPopup(`<strong>🐬 Каспийский тюлень #37</strong><br>Eco-Rescue маркер подтвержден`);
        } else {
          L.marker([m.lat, m.lng]).addTo(mapInstance)
            .bindPopup(`<strong>Улов: ${m.label}</strong><br>${m.weight} кг`);
        }
      });
    }, 150);
  }

  render();
  return container;
};
