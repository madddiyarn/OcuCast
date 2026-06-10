/**
 * OcuCast — Passport Page (Public Digital Catch Passport)
 * Premium Light Mode, Inter Font, Official official document design.
 */

window.PassportPage = function() {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  // State
  let currentCatchId = 'OC-2026-000184';
  let activeCatch = DB.catches.find(c => c.id === currentCatchId);
  let mapInstance = null;

  function render() {
    activeCatch = DB.catches.find(c => c.id === currentCatchId) || DB.catches[0];
    
    const totalValue = (activeCatch.weight_kg * activeCatch.price_per_kg).toLocaleString('ru-KZ');
    
    // Check if quota share was activated
    const quotaShareHtml = activeCatch.quota_share_used 
      ? `<div class="alert alert-cyan" style="margin-bottom: 20px;">
          <span class="alert-icon">⚡</span>
          <div>
            <strong>OcuQuota Share:</strong> Прилов легализован через автоматическую биржу квот 
            <span class="badge badge-navy">Smart-Exchange</span> с судном 
            <strong>"${activeCatch.quota_share_partner_name || 'Каспий-Стар'}"</strong> (ID: #${activeCatch.quota_share_partner_vessel || 'EX-992'}).
          </div>
         </div>`
      : `<div class="alert alert-green" style="margin-bottom: 20px;">
          <span class="alert-icon">✓</span>
          <div>Вылов осуществлен в рамках стандартной персональной квоты судна. Аренда долей не потребовалась.</div>
         </div>`;

    // Timeline stepper
    const timelineHtml = activeCatch.supply_chain.map((step, idx) => {
      const isDone = step.done;
      const dotClass = isDone ? (idx === activeCatch.supply_chain.filter(s=>s.done).length - 1 ? 'current' : 'done') : 'pending';
      const icon = step.stage === 'sea' ? '⚓' : step.stage === 'port' ? '🏗️' : step.stage === 'factory' ? '🏭' : '🛒';
      
      return `
        <div class="timeline-item">
          <div class="timeline-dot ${dotClass}">
            ${isDone ? '✓' : icon}
          </div>
          <div class="timeline-time">${step.time ? new Date(step.time).toLocaleString('ru-RU', {hour: '2-digit', minute:'2-digit', day:'numeric', month:'short'}) : 'Ожидание'}</div>
          <div class="timeline-title">${step.label}</div>
          <div class="timeline-desc">
            ${isDone 
              ? `Подтверждено: <strong>${step.inspector}</strong>. ${step.temp !== null ? `Температура: <span class="badge badge-cyan">${step.temp}°C Guard</span>` : ''}` 
              : 'Ожидается прибытие и сканирование QR-кода на чекпоинте.'}
          </div>
          ${step.multisig ? `
            <div class="timeline-meta">
              <span class="badge badge-navy badge-dot">${step.multisig === 'auto' ? 'IoT Auto-Sign' : 'Multi-Sig Confirmed'}</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <!-- Search Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 16px;">
        <div>
          <h1 style="font-size: 28px; font-weight: 800; color: var(--navy); letter-spacing: -0.5px;">
            Публичный цифровой паспорт улова
          </h1>
          <p style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">
            Свободный доступ гражданского контроля без авторизации
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="passport-search-input" class="form-input" placeholder="Введите ID улова (например, OC-2026-000184)" style="width: 280px;" value="${currentCatchId}">
          <button id="passport-search-btn" class="btn btn-primary">Поиск</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.6fr 1fr; gap: 32px;" class="passport-grid">
        
        <!-- Left: Official Certificate Blank -->
        <div class="card" style="border: 2px solid #E2E8F0; position: relative;">
          <!-- Watermark decoration -->
          <div style="position: absolute; right: 20px; top: 20px; opacity: 0.04; pointer-events: none;">
            <svg width="240" height="240" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2" stroke-dasharray="6 4" />
              <path d="M8 24 C14 16, 22 18, 24 24 C26 30, 34 32, 40 24" stroke="currentColor" stroke-width="2.5" fill="none"/>
            </svg>
          </div>

          <div style="background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0; padding: 24px 32px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-secondary); margin-bottom: 6px;">
              Управление рыбного хозяйства Мангистауской области
            </div>
            <div style="font-size: 14px; font-weight: 700; color: var(--navy); text-transform: uppercase;">
              ОФИЦИАЛЬНОЕ ЦИФРОВОЕ РАЗРЕШЕНИЕ НА ВЫЛОВ
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Минсельхоз Республики Казахстан · Каспийский бассейн
            </div>
          </div>

          <div class="card-body" style="padding: 32px;">
            <!-- Passport meta info -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 32px; border-bottom: 1px dashed #E2E8F0; padding-bottom: 24px;">
              <div>
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Регистрационный ID события</div>
                <div style="font-size: 18px; font-weight: 800; color: var(--navy); margin-top: 2px;">${activeCatch.id}</div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Промысловое судно</div>
                <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
                  ${activeCatch.vessel} 
                  <span style="font-size: 12px; color: var(--text-muted); font-weight: normal;">(ID: ${activeCatch.fisherman_id})</span>
                </div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Вид биоресурса</div>
                <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">${activeCatch.species}</div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Вес улова (Верифицирован)</div>
                <div style="font-size: 18px; font-weight: 800; color: var(--cyan-dark); margin-top: 2px; display: flex; align-items: center; gap: 6px;">
                  ${activeCatch.weight_kg} кг
                  <span class="badge badge-green badge-dot">Hardware Verified</span>
                </div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Дата и время фиксации</div>
                <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: 2px;">
                  ${new Date(activeCatch.timestamp).toLocaleString('ru-RU')}
                </div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Координаты GPS (Актау)</div>
                <div style="font-size: 13.5px; font-weight: 600; color: var(--navy); margin-top: 2px;">
                  ${activeCatch.gps_lat.toFixed(4)}° N, ${activeCatch.gps_lng.toFixed(4)}° E
                </div>
              </div>
            </div>

            <!-- Quota Share status block -->
            ${quotaShareHtml}

            <!-- Supply Chain Timeline -->
            <h3 style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
              <span>⛓️</span> Цепочка прозрачности поставок (Traceability Timeline)
            </h3>
            <div class="timeline" style="margin-bottom: 32px;">
              ${timelineHtml}
            </div>

            <!-- Bottom Protection disclaimer -->
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 16px; display: flex; align-items: center; gap: 14px;">
              <span style="font-size: 24px;">🔐</span>
              <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
                Данные записи защищены оффлайн блокчейн-хэшем <strong>OcuChain Ledger</strong> и скрытым водяным знаком AI. 
                Любые попытки изменения истории приведут к активации защиты OcuLock.
                <br>
                <span style="font-family: monospace; color: var(--text-muted); font-size: 10px;">Hash: ${activeCatch.hash}</span>
              </div>
            </div>
            
            <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
              <button id="passport-pdf-btn" class="btn btn-outline">
                📄 Скачать PDF-выписку
              </button>
            </div>
          </div>
        </div>

        <!-- Right Side: Satellite Map & Eco/Financial metrics -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          
          <!-- Satellite Map -->
          <div class="card">
            <div class="card-header" style="border-bottom: 1px solid #F1F5F9; padding-bottom: 16px;">
              <div class="card-title">🛰️ Интерактивная спутниковая карта</div>
              <div class="card-subtitle">Локация доверенного вылова и трек судна в Каспийском море</div>
            </div>
            <div class="card-body" style="padding: 0;">
              <div id="passport-map" class="map-container" style="height: 280px; width: 100%; border-radius: 0;"></div>
            </div>
          </div>

          <!-- Quality and Eco Index -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">🐠 Показатели качества и экология</div>
              <div class="card-subtitle">Лабораторный IoT-надзор в режиме реального времени</div>
            </div>
            <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                  <span style="color: var(--text-secondary); font-weight: 500;">Индекс свежести рыбы (Freshness Index)</span>
                  <span style="font-weight: 700; color: var(--green);">${activeCatch.freshness_index}%</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill progress-green" style="width: ${activeCatch.freshness_index}%"></div>
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Сенсор био-электрического сопротивления (Рыбий глаз/сетчатка)</div>
              </div>

              <div style="border-top: 1px solid #F1F5F9; padding-top: 16px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Разлив нефтепродуктов</div>
                  <div style="font-size: 11px; color: var(--text-muted);">Космический радарный мониторинг</div>
                </div>
                <div>
                  ${activeCatch.oil_detected 
                    ? `<span class="badge badge-red badge-dot">Нефть ОБНАРУЖЕНА</span>` 
                    : `<span class="badge badge-green badge-dot">Нефть не обнаружена</span>`}
                </div>
              </div>
            </div>
          </div>

          <!-- OcuPrice Financial block -->
          <div class="card" style="background: linear-gradient(135deg, rgba(30,58,138,0.03) 0%, rgba(6,182,212,0.05) 100%); border: 1.5px solid rgba(30,58,138,0.1);">
            <div class="card-header">
              <div class="card-title" style="color: var(--navy);">💰 Финансовый регулятор OcuPrice</div>
              <div class="card-subtitle">Рекомендованная цена Министерства сельского хозяйства РК</div>
            </div>
            <div class="card-body" style="padding-top: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                <span style="font-size: 13px; color: var(--text-secondary);">Цена за килограмм</span>
                <span style="font-size: 16px; font-weight: 700; color: var(--text-primary);">${activeCatch.price_per_kg} KZT/кг</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <span style="font-size: 13px; color: var(--text-secondary);">Рыночная оценка партии</span>
                <span style="font-size: 20px; font-weight: 900; color: var(--navy);">${totalValue} KZT</span>
              </div>
              
              <div class="alert alert-cyan" style="font-size: 11.5px; padding: 10px 14px;">
                <span class="alert-icon" style="font-size: 14px;">🤖</span>
                <div>
                  ИИ-регулятор цены защищает рыбака от занижения цен перекупщиками (делдалами) в портах Баутино и Актау.
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    // Hook events
    container.querySelector('#passport-search-btn').onclick = triggerSearch;
    container.querySelector('#passport-search-input').onkeydown = (e) => {
      if (e.key === 'Enter') triggerSearch();
    };
    container.querySelector('#passport-pdf-btn').onclick = simulatePDFDownload;

    // Initialize Map
    initMap();
  }

  function triggerSearch() {
    const val = container.querySelector('#passport-search-input').value.trim();
    if (val) {
      const found = DB.catches.find(c => c.id === val);
      if (found) {
        currentCatchId = val;
        render();
      } else {
        alert('Улов с таким ID не найден в реестре OcuChain.');
      }
    }
  }

  function simulatePDFDownload() {
    alert(`Выгрузка официальной цифровой выписки PDF для ${activeCatch.id} начата.\nХэш выписки: ${activeCatch.hash.substring(0, 16)}...`);
  }

  function initMap() {
    setTimeout(() => {
      const mapDiv = container.querySelector('#passport-map');
      if (!mapDiv) return;

      // Clean up previous instance if any
      if (mapInstance) {
        mapInstance.remove();
      }

      // Aktau Caspi coords
      const lat = activeCatch.gps_lat;
      const lng = activeCatch.gps_lng;

      mapInstance = L.map(mapDiv).setView([lat, lng], 10);

      // Add Esri Satellite Imagery
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, and the GIS User Community',
        maxZoom: 18
      }).addTo(mapInstance);

      // Add marker
      const marker = L.marker([lat, lng]).addTo(mapInstance);
      marker.bindPopup(`
        <strong>Улов ${activeCatch.id}</strong><br>
        Судно: ${activeCatch.vessel}<br>
        Вид: ${activeCatch.species}<br>
        Вес: ${activeCatch.weight_kg} кг
      `).openPopup();

      // Draw simulated track lines to vessel homeport
      const portCoords = [43.6521, 51.1753]; // Aktau Port
      const latlngs = [
        [lat, lng],
        [(lat + portCoords[0]) / 2 + 0.05, (lng + portCoords[1]) / 2 - 0.03],
        portCoords
      ];
      L.polyline(latlngs, { color: '#06B6D4', weight: 3, dashArray: '5, 8' }).addTo(mapInstance);

    }, 200);
  }

  render();
  return container;
};
