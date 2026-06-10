import { DB, OcuChain, API_BASE } from './db';
import { checkAntiGravity, leaseQuota, breakBlockchainIntegrity } from './backend';
import { CatchRecord, Fisherman } from './types';

// Declare Leaflet global type
declare const L: any;

// Simple SPA Router
const Router = {
  routes: {} as Record<string, () => HTMLElement>,
  currentPath: '/passport',

  register(path: string, handler: () => HTMLElement) {
    this.routes[path] = handler;
  },

  navigate(path: string, pushState = true) {
    const clean = path.startsWith('/') ? path : '/' + path;
    if (pushState && this.currentPath !== clean) {
      history.pushState({ path: clean }, '', clean);
    }
    this.render(clean);
  },

  render(path: string) {
    const route = this.routes[path] || this.routes['/passport'];
    this.currentPath = path;
    
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = '';
      container.appendChild(route());
    }
    this._updateNav(path);
    window.scrollTo(0, 0);
  },

  _updateNav(path: string) {
    document.querySelectorAll('.header-nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-route') === path);
    });
  },

  init() {
    window.addEventListener('popstate', (e) => {
      const path = e.state?.path || window.location.pathname;
      this.render(path);
    });

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const a = target.closest('[data-route]');
      if (a) {
        e.preventDefault();
        const routeAttr = a.getAttribute('data-route');
        if (routeAttr) this.navigate(routeAttr);
      }
    });

    const initial = window.location.pathname || '/passport';
    this.render(initial === '/' ? '/passport' : initial);
  }
};

// ═══════════════════════════════════════════════
// SESSION MANAGER
// ═══════════════════════════════════════════════
const Session = {
  getCurrentUser(): Fisherman | null {
    try { return JSON.parse(sessionStorage.getItem('oc_user') || 'null'); } catch { return null; }
  },
  setCurrentUser(u: Fisherman | null) {
    if (u) sessionStorage.setItem('oc_user', JSON.stringify(u));
    else sessionStorage.removeItem('oc_user');
  },
  logout() {
    this.setCurrentUser(null);
  }
};

// ═══════════════════════════════════════════════
// PAGE 1: DIGITAL PASSPORT
// ═══════════════════════════════════════════════
function PassportPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';
  
  let searchId = 'OC-2026-000184';
  let mapInstance: any = null;

  function renderView() {
    const activeCatch = DB.catches.find(c => c.id === searchId) || DB.catches[0];
    if (!activeCatch) {
      container.innerHTML = `<h3>Записей не обнаружено. Сначала добавьте улов.</h3>`;
      return;
    }

    const totalValue = (activeCatch.weight_kg * activeCatch.price_per_kg).toLocaleString('ru-KZ');
    const timelineHtml = activeCatch.supply_chain.map((step, idx) => {
      const isDone = step.done;
      const dotClass = isDone ? (idx === activeCatch.supply_chain.filter(s => s.done).length - 1 ? 'current' : 'done') : 'pending';
      const icon = step.stage === 'sea' ? '⚓' : step.stage === 'port' ? '🏗️' : step.stage === 'factory' ? '🏭' : '🛒';

      return `
        <div class="timeline-item">
          <div class="timeline-dot ${dotClass}">
            ${isDone ? '✓' : icon}
          </div>
          <div class="timeline-time">${step.time ? new Date(step.time).toLocaleString('ru-RU') : 'В очереди'}</div>
          <div class="timeline-title">${step.label}</div>
          <div class="timeline-desc">
            ${isDone 
              ? `Подтвердил инспектор: <strong>${step.inspector}</strong>. ${step.temp !== null ? `Темп. контейнера: <span class="badge badge-cyan">${step.temp}°C Guard</span>` : ''}` 
              : 'Ожидается верификация на КПП.'}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 16px;">
        <div>
          <h1 style="font-size: 28px; font-weight: 800; color: var(--navy); letter-spacing: -0.5px;">Цифровой Паспорт Улова</h1>
          <p style="color: var(--text-secondary); font-size: 14px;">Публичный реестр верифицированных партий рыбы Каспия</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="passport-search-input" class="form-input" placeholder="Введите ID улова (например, OC-2026-000184)" style="width: 300px;" value="${searchId}">
          <button id="passport-search-btn" class="btn btn-primary">Поиск</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.6fr 1fr; gap: 32px;" class="passport-grid">
        
        <!-- Официальный Бланк -->
        <div class="card" style="border: 2px solid #E2E8F0; border-radius: 16px;">
          <div style="background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0; padding: 24px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--text-secondary);">Управление рыбного хозяйства Мангистауской области</div>
            <div style="font-size: 14px; font-weight: 700; color: var(--navy); margin-top: 4px;">ЦИФРОВОЙ СЕРТИФИКАТ ПРОИСХОЖДЕНИЯ БИОРЕСУРСОВ</div>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px dashed #E2E8F0;">
              <div>
                <span style="font-size: 11px; color: var(--text-muted);">Идентификатор улова:</span>
                <div style="font-size: 16px; font-weight: 800; color: var(--navy);">${activeCatch.id}</div>
              </div>
              <div>
                <span style="font-size: 11px; color: var(--text-muted);">Судно / Лицензия:</span>
                <div style="font-size: 15px; font-weight: 700;">${activeCatch.vessel}</div>
              </div>
              <div>
                <span style="font-size: 11px; color: var(--text-muted);">Зарегистрированный вид:</span>
                <div style="font-size: 15px; font-weight: 700;">${activeCatch.species}</div>
              </div>
              <div>
                <span style="font-size: 11px; color: var(--text-muted);">Масса (Верифицирована):</span>
                <div style="font-size: 16px; font-weight: 800; color: var(--cyan-dark);">${activeCatch.weight_kg} кг <span class="badge badge-green">Hardware verified</span></div>
              </div>
            </div>

            ${activeCatch.quota_share_used 
              ? `<div class="alert alert-cyan" style="margin-bottom: 24px;">
                  ⚡ <strong>OcuQuota Share:</strong> Лимит легализован через биржу квот Smart-Exchange с донором <strong>"${activeCatch.quota_share_partner_name || 'Каспий-Стар'}"</strong>.
                 </div>`
              : `<div class="alert alert-green" style="margin-bottom: 24px;">
                  ✓ Стандартный вылов. Квоты судна соответствуют нормативу.
                 </div>`
            }

            <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 16px; color: var(--navy);">⛓️ ЭТАПЫ ЦЕПОЧКИ ПОСТАВОК (TRACEABILITY TIMELINE)</h3>
            <div class="timeline">${timelineHtml}</div>

            <div style="margin-top: 24px; padding: 12px; background: #F8FAFC; border-radius: 8px; font-family: monospace; font-size: 10px; color: var(--text-secondary);">
              Блокчейн-подпись: ${activeCatch.hash}
            </div>
            
            <div style="display:flex; justify-content:flex-end; margin-top:20px;">
              <button onclick="alert('Печать PDF бланка инициирована.')" class="btn btn-outline">📥 Скачать PDF бланка</button>
            </div>
          </div>
        </div>

        <!-- Боковая Панель: Спутниковая Карта и Цены -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div class="card" style="border-radius: 16px;">
            <div class="card-header">
              <div class="card-title">Спутниковое позиционирование</div>
            </div>
            <div class="card-body" style="padding: 0;">
              <div id="passport-map" style="height: 250px; width: 100%;"></div>
            </div>
          </div>

          <div class="card" style="background: linear-gradient(135deg, rgba(30,58,138,0.03) 0%, rgba(6,182,212,0.04) 100%); border-radius: 16px;">
            <div class="card-body">
              <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Индекс цены Минсельхоза РК (OcuPrice)</div>
              <div style="font-size: 26px; font-weight: 900; color: var(--navy); margin: 8px 0;">${totalValue} KZT</div>
              <div style="font-size: 12px; color: var(--text-secondary);">Рекомендованная цена: ${activeCatch.price_per_kg} KZT/кг. Перекупщики не могут занизить цену.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook events
    const searchBtn = container.querySelector('#passport-search-btn');
    if (searchBtn) {
      searchBtn.onclick = () => {
        const valInput = container.querySelector('#passport-search-input') as HTMLInputElement;
        const found = DB.catches.find(c => c.id === valInput.value.trim());
        if (found) {
          searchId = found.id;
          renderView();
        } else {
          alert('Улов с таким ID не найден.');
        }
      };
    }

    initMap(activeCatch);
  }

  function initMap(c: CatchRecord) {
    setTimeout(() => {
      const mapDiv = container.querySelector('#passport-map');
      if (!mapDiv) return;
      if (mapInstance) mapInstance.remove();

      mapInstance = L.map(mapDiv).setView([c.gps_lat, c.gps_lng], 10);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri Satellite'
      }).addTo(mapInstance);

      L.marker([c.gps_lat, c.gps_lng]).addTo(mapInstance)
        .bindPopup(`<strong>Улов ${c.id}</strong><br>${c.species}, ${c.weight_kg} кг`)
        .openPopup();
    }, 150);
  }

  renderView();
  return container;
}

// ═══════════════════════════════════════════════
// PAGE 2: FISHERMAN TERMINAL
// ═══════════════════════════════════════════════
function FishermanPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  let step = 1;
  let weight = 1.8;
  let species = 'roach';
  let isCameraStream = false;
  let capturedPhoto: string | null = null;
  let localStream: MediaStream | null = null;

  function renderView() {
    const user = Session.getCurrentUser();

    if (!user || user.role !== 'fisherman') {
      renderLogin();
      return;
    }

    if (user.status === 'suspended') {
      container.innerHTML = `
        <div class="card" style="padding:40px; text-align:center; max-width:500px; margin: 40px auto; border-radius:16px; border:2px solid var(--red);">
          <span style="font-size:48px;">🔒</span>
          <h2 style="color:var(--red); margin: 16px 0 8px;">Доступ Заблокирован OcuLock</h2>
          <p style="color:var(--text-secondary); margin-bottom:24px;">
            В системе обнаружен разрыв цепочки хэшей. Промысловое судно временно отстранено от работы до ручной верификации Акимата.
          </p>
          <button id="btn-lock-logout" class="btn btn-ghost">Сменить пользователя</button>
        </div>
      `;
      container.querySelector('#btn-lock-logout')?.addEventListener('click', () => {
        Session.logout();
        renderView();
      });
      return;
    }

    if (user.status === 'pending') {
      container.innerHTML = `
        <div class="card" style="padding:40px; text-align:center; max-width:500px; margin: 40px auto; border-radius:16px;">
          <h2>Лицензия проверяется Акиматом</h2>
          <p style="color:var(--text-secondary); margin:12px 0;">Дождитесь одобрения администратором ситуационного центра.</p>
          <button id="btn-logout-wait" class="btn btn-ghost">Выйти</button>
        </div>
      `;
      container.querySelector('#btn-logout-wait')?.addEventListener('click', () => { Session.logout(); renderView(); });
      return;
    }

    renderWizard();
  }

  function renderLogin() {
    container.innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          <h2 style="font-size:20px; font-weight:800; color:var(--navy); text-align:center; margin-bottom:24px;">OcuCast Secure Login</h2>
          <div id="login-err"></div>
          <form id="form-login">
            <div class="form-group">
              <label class="form-label">Логин капитана</label>
              <input type="text" id="log-u" class="form-input" value="fisher1" required>
            </div>
            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label">Пароль</label>
              <input type="password" id="log-p" class="form-input" value="demo" required>
            </div>
            <button class="btn btn-primary btn-block">Войти в личный кабинет</button>
          </form>
        </div>
      </div>
    `;

    container.querySelector('#form-login')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const login = (container.querySelector('#log-u') as HTMLInputElement).value;
      const pass = (container.querySelector('#log-p') as HTMLInputElement).value;
      
      const found = DB.fishermen.find(f => f.login === login && f.password === pass);
      if (found) {
        Session.setCurrentUser({ ...found, role: 'fisherman' } as any);
        renderView();
      } else {
        const err = container.querySelector('#login-err');
        if (err) err.innerHTML = `<div class="alert alert-red" style="margin-bottom:12px;">Неверный пароль</div>`;
      }
    });
  }

  function renderWizard() {
    const user = Session.getCurrentUser()!;
    let wizardContent = '';

    if (step === 1) {
      wizardContent = `
        <h3>Шаг 1: Автофиксация веса партионных весов</h3>
        <p style="font-size:13px; color:var(--text-secondary); margin:8px 0 20px;">
          Значения с аппаратного датчика блокируются для защиты от ручного ввода. Используйте симулятор весов для демонстрации.
        </p>
        
        <div style="text-align:center; padding:32px; background:#F8FAFC; border-radius:12px; border:1px solid #E2E8F0; margin-bottom:20px;">
          <div style="font-size:54px; font-weight:900; color:var(--navy);" id="sim-w-display">${weight.toFixed(1)} кг</div>
          <span class="badge badge-green">IoT Scales Connected</span>
        </div>

        <div class="form-group">
          <label class="form-label">Слайдер-симулятор веса</label>
          <input type="range" id="sim-weight-slider" class="form-input" min="0.5" max="10.0" step="0.1" value="${weight}" style="accent-color:var(--cyan);">
          <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:4px;">
            <span>0.5 кг</span>
            <span style="color:var(--red); font-weight:bold;">4.6 кг (Вобла: биологическое превышение)</span>
            <span>10.0 кг</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Выловленный вид рыбы</label>
          <select id="species-select" class="form-input form-select">
            <option value="roach" ${species === 'roach' ? 'selected' : ''}>Вобла (Лимит веса: до 3.0 кг)</option>
            <option value="carp" ${species === 'carp' ? 'selected' : ''}>Сазан (Лимит веса: до 35.0 кг)</option>
            <option value="sturgeon" ${species === 'sturgeon' ? 'selected' : ''}>Осетр (Лимит веса: до 120.0 кг)</option>
          </select>
        </div>

        <button id="wiz-btn-1-next" class="btn btn-primary" style="float:right;">Перейти к камере</button>
      `;
    } else if (step === 2) {
      wizardContent = `
        <h3>Шаг 2: Камера и верификация биометрии</h3>
        <p style="font-size:13px; color:var(--text-secondary); margin:8px 0 20px;">
          Допускается только прямая съёмка с камеры устройства в режиме реального времени. Выбор из фотопленки заблокирован.
        </p>

        <div style="background:#000; border-radius:12px; height:280px; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; margin-bottom:20px;">
          <video id="wiz-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover; display:${isCameraStream && !capturedPhoto ? 'block' : 'none'};"></video>
          ${capturedPhoto ? `<img src="${capturedPhoto}" style="width:100%; height:100%; object-fit:cover;" />` : ''}
          ${!isCameraStream && !capturedPhoto ? `
            <div style="text-align:center; color:#94A3B8;">
              <span style="font-size:32px;">📷</span><br>
              <button id="btn-camera-start" class="btn btn-cyan btn-sm" style="margin-top:10px;">Запустить камеру</button>
            </div>
          ` : ''}
          ${isCameraStream && !capturedPhoto ? `
            <button id="btn-camera-capture" class="btn btn-cyan btn-sm" style="position:absolute; bottom:16px;">Снять кадр</button>
          ` : ''}
        </div>

        <div class="ai-panel" style="display:${capturedPhoto ? 'block' : 'none'}; margin-bottom:20px;">
          <div class="ai-panel-title">🤖 ИИ-Анализ биометрии (ML V4)</div>
          <div style="font-size:13px; display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Распознавание вида:</span> <strong>98%</strong>
          </div>
          <div style="font-size:13px; display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Детекция аномалий чешуи/нефти:</span> <strong>94%</strong>
          </div>
          <div style="font-size:13px; display:flex; justify-content:space-between;">
            <span>Индекс свежести глаза:</span> <strong>96%</strong>
          </div>
        </div>

        <div id="wiz-antigravity-alert-container"></div>

        <div style="display:flex; justify-content:space-between; margin-top:20px;">
          <button id="wiz-btn-2-prev" class="btn btn-ghost">Назад</button>
          <button id="wiz-btn-2-next" class="btn btn-primary" ${!capturedPhoto ? 'disabled' : ''}>Продолжить</button>
        </div>
      `;
    } else if (step === 3) {
      const priceVal = species === 'sturgeon' ? 5000 : species === 'carp' ? 950 : 1200;
      const recValue = (weight * priceVal).toLocaleString('ru-KZ');
      wizardContent = `
        <h3>Шаг 3: Верификация и печать бирки с QR</h3>
        <p style="font-size:13px; color:var(--text-secondary); margin:8px 0 20px;">Проверьте финансовые параметры улова. Система готова к записи в OcuChain Ledger.</p>
        
        <div class="card" style="border:1px solid #E2E8F0; padding:16px; margin-bottom:20px; border-radius:12px;">
          <div style="font-size:13px; display:flex; justify-content:space-between; margin-bottom:8px;">
            <span>Вид рыбы:</span> <strong>${species === 'roach' ? 'Вобла' : species === 'carp' ? 'Сазан' : 'Осетр'}</strong>
          </div>
          <div style="font-size:13px; display:flex; justify-content:space-between; margin-bottom:8px;">
            <span>Вес нетто:</span> <strong>${weight.toFixed(1)} кг</strong>
          </div>
          <div style="font-size:13px; display:flex; justify-content:space-between; margin-bottom:8px; border-top:1px dashed #E2E8F0; padding-top:8px;">
            <span style="color:var(--navy); font-weight:700;">Рекомендованная цена (OcuPrice):</span>
            <strong style="color:var(--navy);">${recValue} KZT</strong>
          </div>
        </div>

        <button id="btn-wiz-print" class="btn btn-cyan btn-block">🖨️ Зафиксировать и напечатать QR бирку</button>
        <div id="print-alert-box" style="margin-top:12px;"></div>

        <button id="wiz-btn-3-prev" class="btn btn-ghost" style="margin-top:20px;">Начать сначала</button>
      `;
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
        <h2>Терминал фиксации рыбака</h2>
        <p style="font-size:13px; color:var(--text-muted);">Судно: ${user.vessel} | Капитан: ${user.name}</p>
        <button id="btn-fisher-logout" class="btn btn-outline btn-sm">Выйти</button>
      </div>
      <div style="display:grid; grid-template-columns: 240px 1fr; gap:32px;" class="passport-grid">
        <div class="card" style="padding:16px; border-radius:16px; height:fit-content;">
          <div style="font-weight:800; font-size:14px; margin-bottom:12px; color:var(--navy);">Мастер регистрации</div>
          <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
            <div style="color:${step === 1 ? 'var(--navy)' : 'var(--text-muted)'}; font-weight:${step === 1 ? '800' : '500'};">1. Калибровка весов</div>
            <div style="color:${step === 2 ? 'var(--navy)' : 'var(--text-muted)'}; font-weight:${step === 2 ? '800' : '500'};">2. Верификация биометрии</div>
            <div style="color:${step === 3 ? 'var(--navy)' : 'var(--text-muted)'}; font-weight:${step === 3 ? '800' : '500'};">3. Печать защищенной бирки</div>
          </div>
        </div>
        <div class="card" style="padding:24px; border-radius:16px;">${wizardContent}</div>
      </div>
    `;

    // Attach events
    container.querySelector('#btn-fisher-logout')?.addEventListener('click', () => {
      Session.logout();
      renderView();
    });

    if (step === 1) {
      const slider = container.querySelector('#sim-weight-slider') as HTMLInputElement;
      slider?.addEventListener('input', (e: any) => {
        weight = parseFloat(e.target.value);
        const valDisp = container.querySelector('#sim-w-display');
        if (valDisp) valDisp.innerHTML = `${weight.toFixed(1)} кг`;
      });
      container.querySelector('#species-select')?.addEventListener('change', (e: any) => {
        species = e.target.value;
      });
      container.querySelector('#wiz-btn-1-next')?.addEventListener('click', () => {
        step = 2;
        renderWizard();
      });
    } else if (step === 2) {
      container.querySelector('#wiz-btn-2-prev')?.addEventListener('click', () => {
        stopCamera();
        step = 1;
        renderWizard();
      });

      container.querySelector('#btn-camera-start')?.addEventListener('click', startCamera);
      container.querySelector('#btn-camera-capture')?.addEventListener('click', captureFrame);

      const btnNext = container.querySelector('#wiz-btn-2-next') as HTMLButtonElement;
      
      btnNext?.addEventListener('click', () => {
        const ag = checkAntiGravity(species, weight, 12);
        if (!ag.success) {
          const alertBox = container.querySelector('#wiz-antigravity-alert-container');
          if (alertBox) {
            alertBox.innerHTML = `
              <div class="antigravity-alert" id="ag-alert" style="border: 2px solid var(--red); border-radius: 12px; background: var(--red-light); overflow: hidden; margin-top: 16px;">
                <div class="antigravity-header" style="background: var(--red); padding: 12px 16px; color: white; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 18px;">🛡️</span>
                  <h4 style="margin: 0; font-weight: 800; font-size: 14px;">❌ AntiGravity: Транзакция заблокирована</h4>
                </div>
                <div class="antigravity-body" style="padding: 16px;">
                  <pre style="white-space: pre-wrap; font-family: inherit; font-size: 13px; color: #7F1D1D;">${ag.text}</pre>
                  <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn btn-danger btn-sm" id="btn-ag-moderate-report">
                      📨 Отправить на ручную модерацию инспектору Акимата
                    </button>
                  </div>
                </div>
              </div>
            `;
            
            // Hook moderation report button
            container.querySelector('#btn-ag-moderate-report')?.addEventListener('click', async () => {
              const pending = {
                id: 'AF-' + Math.floor(Math.random() * 9000 + 1000),
                ts: new Date().toISOString(),
                vessel: user.vessel,
                species: species,
                weight: weight,
                reason: 'Превышен биологический максимум — отправлено на модерацию',
                status: 'pending_review',
                sent_to_moderator: true
              };

              try {
                await fetch(`${API_BASE}/antifrod`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(pending)
                });
                await DB.init();
              } catch (e) {
                DB.antifrodLog.unshift({
                  id: pending.id,
                  timestamp: pending.ts,
                  vessel: pending.vessel,
                  species: pending.species,
                  weight: pending.weight,
                  description: pending.reason,
                  status: 'pending_review',
                  sent_to_moderator: true
                });
              }

              const alertEl = container.querySelector('#ag-alert');
              if (alertEl) {
                alertEl.innerHTML = `
                  <div class="alert alert-amber" style="margin: 0; padding: 14px;">
                    <span class="alert-icon">📨</span>
                    <div><strong>Заявка отправлена на модерацию.</strong> Инспектор Акимата рассмотрит ее в ближайшее время. ID: ${pending.id}</div>
                  </div>
                `;
              }
            });
          }
        } else {
          step = 3;
          renderWizard();
        }
      });

      if (capturedPhoto) {
        const ag = checkAntiGravity(species, weight, 12);
        if (!ag.success) {
          btnNext.disabled = true;
          const alertBox = container.querySelector('#wiz-antigravity-alert-container');
          if (alertBox) {
            alertBox.innerHTML = `
              <div class="antigravity-alert" id="ag-alert" style="border: 2px solid var(--red); border-radius: 12px; background: var(--red-light); overflow: hidden; margin-top: 16px;">
                <div class="antigravity-header" style="background: var(--red); padding: 12px 16px; color: white; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 18px;">🛡️</span>
                  <h4 style="margin: 0; font-weight: 800; font-size: 14px;">❌ AntiGravity: Транзакция заблокирована</h4>
                </div>
                <div class="antigravity-body" style="padding: 16px;">
                  <pre style="white-space: pre-wrap; font-family: inherit; font-size: 13px; color: #7F1D1D;">${ag.text}</pre>
                  <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn btn-danger btn-sm" id="btn-ag-moderate-report">
                      📨 Отправить на ручную модерацию инспектору Акимата
                    </button>
                  </div>
                </div>
              </div>
            `;
            
            // Hook moderation report button
            container.querySelector('#btn-ag-moderate-report')?.addEventListener('click', async () => {
              const pending = {
                id: 'AF-' + Math.floor(Math.random() * 9000 + 1000),
                ts: new Date().toISOString(),
                vessel: user.vessel,
                species: species,
                weight: weight,
                reason: 'Превышен биологический максимум — отправлено на модерацию',
                status: 'pending_review',
                sent_to_moderator: true
              };

              try {
                await fetch(`${API_BASE}/antifrod`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(pending)
                });
                await DB.init();
              } catch (e) {
                DB.antifrodLog.unshift({
                  id: pending.id,
                  timestamp: pending.ts,
                  vessel: pending.vessel,
                  species: pending.species,
                  weight: pending.weight,
                  description: pending.reason,
                  status: 'pending_review',
                  sent_to_moderator: true
                });
              }

              const alertEl = container.querySelector('#ag-alert');
              if (alertEl) {
                alertEl.innerHTML = `
                  <div class="alert alert-amber" style="margin: 0; padding: 14px;">
                    <span class="alert-icon">📨</span>
                    <div><strong>Заявка отправлена на модерацию.</strong> Инспектор Акимата рассмотрит ее в ближайшее время. ID: ${pending.id}</div>
                  </div>
                `;
              }
            });
          }
        } else {
          btnNext.disabled = false;
        }
      }
    } else if (step === 3) {
      container.querySelector('#wiz-btn-3-prev')?.addEventListener('click', () => {
        step = 1;
        capturedPhoto = null;
        renderWizard();
      });

      container.querySelector('#btn-wiz-print')?.addEventListener('click', async () => {
        // Build catch record
        const record = {
          fisherman_id: user.id,
          vessel: user.vessel,
          species: DB.speciesLimits[species]?.name_ru || species,
          species_en: species,
          weight_kg: weight,
          gps_lat: 43.6521 + (Math.random() - 0.5) * 0.1,
          gps_lng: 51.1753 + (Math.random() - 0.5) * 0.1,
          freshness_index: 96,
          quota_share_used: false,
          quota_share_partner_vessel: null,
          quota_share_partner_name: null,
          supply_chain: [
            { stage: 'sea', label: '⚓ Море (Вылов)', done: true, time: new Date().toISOString(), inspector: 'GPS автофиксация', temp: null, multisig: 'auto' },
            { stage: 'port', label: '🏗️ Порт Баутино', done: false, time: null, inspector: null, temp: null, multisig: null },
            { stage: 'factory', label: '🏭 Завод', done: false, time: null, inspector: null, temp: null, multisig: null },
            { stage: 'retail', label: '🛒 Ритейл', done: false, time: null, inspector: null, temp: null, multisig: null }
          ]
        };

        const ledgerEntry = OcuChain.addEntry(record);
        const recordWithHash = { ...record, hash: ledgerEntry.hash };

        try {
          const response = await fetch(`${API_BASE}/catches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recordWithHash)
          });
          if (response.ok) {
            const resultRecord = await response.json();
            await DB.init();
            container.querySelector('#print-alert-box')!.innerHTML = `
              <div class="alert alert-green">✓ Запись сохранена. Бирка с QR кодом распечатана на Bluetooth-принтере. ID: ${resultRecord.id}</div>
            `;
          }
        } catch (e) {
          // Local fallback
          const id = `OC-2026-${Math.floor(100000 + Math.random() * 900000)}`;
          const offlineRecord = {
            ...recordWithHash,
            id,
            timestamp: new Date().toISOString(),
            gps_label: 'Актау, море (Offline)',
            price_per_kg: species === 'sturgeon' ? 5000 : 1200,
            verified: true,
            hardware_verified: true
          } as CatchRecord;
          DB.catches.unshift(offlineRecord);
          container.querySelector('#print-alert-box')!.innerHTML = `
            <div class="alert alert-green">✓ Запись создана оффлайн. Бирка распечатана. ID: ${id}</div>
          `;
        }
      });
    }
  }

  function startCamera() {
    isCameraStream = true;
    renderWizard();
    setTimeout(() => {
      const vid = container.querySelector('#wiz-video') as HTMLVideoElement;
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(str => {
          localStream = str;
          if (vid) vid.srcObject = str;
        })
        .catch(() => {
          capturedPhoto = 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80';
          isCameraStream = false;
          renderWizard();
        });
    }, 100);
  }

  function captureFrame() {
    const vid = container.querySelector('#wiz-video') as HTMLVideoElement;
    if (vid && localStream) {
      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth || 640;
      canvas.height = vid.videoHeight || 480;
      canvas.getContext('2d')?.drawImage(vid, 0, 0, canvas.width, canvas.height);
      capturedPhoto = canvas.toDataURL('image/jpeg');
      stopCamera();
      renderWizard();
    }
  }

  function stopCamera() {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    isCameraStream = false;
  }

  renderView();
  return container;
}

// ═══════════════════════════════════════════════
// PAGE 3: CHECKPOINT PORTAL
// ═══════════════════════════════════════════════
function CheckpointPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  let validatedCatch: CatchRecord | null = null;

  function renderView() {
    const user = Session.getCurrentUser();

    if (!user || (user.role !== 'inspector' && user.role !== 'admin')) {
      renderLogin();
      return;
    }

    renderTerminal();
  }

  function renderLogin() {
    container.innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          <h2 style="font-size:20px; font-weight:800; color:var(--navy); text-align:center; margin-bottom:24px;">Вход для инспекторов</h2>
          <div id="inspect-login-err"></div>
          <form id="form-inspect-login">
            <div class="form-group">
              <label class="form-label">Логин инспектора</label>
              <input type="text" id="ins-u" class="form-input" value="inspector1" required>
            </div>
            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label">Пароль</label>
              <input type="password" id="ins-p" class="form-input" value="demo" required>
            </div>
            <button class="btn btn-primary btn-block">Авторизоваться</button>
          </form>
        </div>
      </div>
    `;

    container.querySelector('#form-inspect-login')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const login = (container.querySelector('#ins-u') as HTMLInputElement).value;
      const pass = (container.querySelector('#ins-p') as HTMLInputElement).value;

      const found = DB.fishermen.find(f => f.login === login && f.password === pass);
      const inspector = DB.fishermen.length === 0 ? null : found; // simplified auth checks

      const demoInspector = DB.fishermen.length === 0 || login === 'inspector1' ? { id: 'INS-01', name: 'Айгерим Бекова', role: 'inspector' } : null;

      if (demoInspector) {
        Session.setCurrentUser(demoInspector as any);
        renderView();
      } else {
        const err = container.querySelector('#inspect-login-err');
        if (err) err.innerHTML = `<div class="alert alert-red" style="margin-bottom:12px;">Отказано в доступе</div>`;
      }
    });
  }

  function renderTerminal() {
    const user = Session.getCurrentUser()!;

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
        <h2>Регистрация нового этапа в цепи поставок</h2>
        <button id="btn-inspect-logout" class="btn btn-outline btn-sm">Выйти</button>
      </div>

      <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:32px;" class="passport-grid">
        <div class="card" style="padding:24px; border-radius:16px;">
          <form id="checkpoint-stage-form">
            <div class="form-group">
              <label class="form-label">OcuCast ID улова</label>
              <div style="display:flex; gap:8px;">
                <input type="text" id="chk-catch-id" class="form-input" placeholder="Например: OC-2026-000184" required>
                <button type="button" id="btn-chk-verify" class="btn btn-outline">Проверить</button>
              </div>
              <div id="chk-verify-status" style="margin-top:8px;"></div>
            </div>

            <div class="form-group">
              <label class="form-label">Текущий логистический этап</label>
              <select id="chk-stage-select" class="form-input form-select" disabled>
                <option value="port">🏗️ Порт Баутино (Multi-Sig подтвержден)</option>
                <option value="factory">🏭 Рыбозавод (-4°C Guard)</option>
                <option value="retail">🛒 Ритейл / Прилавок</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Температура контейнера (°C Guard)</label>
              <input type="number" id="chk-temp-input" class="form-input" value="2" disabled>
            </div>

            <div class="form-group">
              <label class="form-label">Ответственный инспектор</label>
              <input type="text" class="form-input locked" value="${user.name}" readonly>
            </div>

            <button type="button" id="btn-chk-multisig" class="btn btn-cyan btn-block" style="margin:20px 0;" disabled>
              🤝 Сканировать QR-код рыбака для крипто-подписи
            </button>

            <div id="chk-success-box"></div>

            <button type="submit" id="btn-chk-submit" class="btn btn-primary btn-block" disabled>Зафиксировать этап в блокчейне</button>
          </form>
        </div>

        <div class="card" style="padding:24px; border-radius:16px; height:fit-content;" id="chk-info-panel">
          <div style="color:var(--text-muted); text-align:center; padding:40px 0;">
            <span>🔍</span><br>Введите и верифицируйте ID улова
          </div>
        </div>
      </div>
    `;

    // Attach events
    container.querySelector('#btn-inspect-logout')?.addEventListener('click', () => {
      Session.logout();
      renderView();
    });

    const btnVerify = container.querySelector('#btn-chk-verify') as HTMLButtonElement;
    const inputId = container.querySelector('#chk-catch-id') as HTMLInputElement;
    const selectStage = container.querySelector('#chk-stage-select') as HTMLSelectElement;
    const inputTemp = container.querySelector('#chk-temp-input') as HTMLInputElement;
    const btnMultisig = container.querySelector('#btn-chk-multisig') as HTMLButtonElement;
    const btnSubmit = container.querySelector('#btn-chk-submit') as HTMLButtonElement;

    btnVerify.onclick = () => {
      const c = DB.catches.find(x => x.id === inputId.value.trim());
      if (c) {
        validatedCatch = c;
        const statusBox = container.querySelector('#chk-verify-status');
        if (statusBox) statusBox.innerHTML = `<div class="alert alert-green" style="font-size:12px; padding:6px 12px;">✓ Найдено судно: ${c.vessel}</div>`;
        selectStage.disabled = false;
        inputTemp.disabled = false;
        btnMultisig.disabled = false;
        updateInfoPanel(c);
      } else {
        validatedCatch = null;
        const statusBox = container.querySelector('#chk-verify-status');
        if (statusBox) statusBox.innerHTML = `<div class="alert alert-red" style="font-size:12px; padding:6px 12px;">ID не найден в OcuChain</div>`;
        selectStage.disabled = true;
        inputTemp.disabled = true;
        btnMultisig.disabled = true;
        btnSubmit.disabled = true;
      }
    };

    btnMultisig.onclick = () => {
      btnMultisig.textContent = '🔄 Bluetooth BLE рукопожатие с судно...';
      btnMultisig.disabled = true;
      setTimeout(() => {
        btnMultisig.className = 'btn btn-outline btn-block';
        btnMultisig.style.color = '#065F46';
        btnMultisig.style.borderColor = 'var(--green)';
        btnMultisig.textContent = '✓ Multi-Sig Подпись Рыбака подтверждена';
        btnSubmit.disabled = false;
      }, 1000);
    };

    container.querySelector('#checkpoint-stage-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validatedCatch) return;

      const stage = selectStage.value as any;
      const tempVal = parseFloat(inputTemp.value);
      const inspectorName = user.name;

      try {
        const response = await fetch(`${API_BASE}/checkpoint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ catch_id: validatedCatch.id, stage, temperature: tempVal, location: 'КПП', inspector_name: inspectorName })
        });
        if (response.ok) {
          await DB.init();
          container.querySelector('#chk-success-box')!.innerHTML = `<div class="alert alert-green">✓ Логистический этап успешно внесен. Данные синхронизированы.</div>`;
          updateInfoPanel(validatedCatch);
          btnSubmit.disabled = true;
          btnMultisig.className = 'btn btn-cyan btn-block';
          btnMultisig.textContent = '🤝 Сканировать QR-код рыбака для крипто-подписи';
          btnMultisig.disabled = false;
        }
      } catch (e) {
        // Fallback
        const sc = validatedCatch.supply_chain;
        const idx = sc.findIndex(s => s.stage === stage);
        if (idx !== -1) {
          sc[idx] = {
            stage,
            label: selectStage.options[selectStage.selectedIndex].text,
            done: true,
            time: new Date().toISOString(),
            inspector: inspectorName,
            temp: tempVal,
            multisig: 'confirmed'
          };
          OcuChain.addEntry({ type: 'checkpoint', catch_id: validatedCatch.id, stage, inspector: inspectorName });
          container.querySelector('#chk-success-box')!.innerHTML = `<div class="alert alert-green">✓ Логистический этап внесен оффлайн.</div>`;
          updateInfoPanel(validatedCatch);
          btnSubmit.disabled = true;
          btnMultisig.className = 'btn btn-cyan btn-block';
          btnMultisig.textContent = '🤝 Сканировать QR-код рыбака для крипто-подписи';
          btnMultisig.disabled = false;
        }
      }
    });
  }

  function updateInfoPanel(c: CatchRecord) {
    const scHtml = c.supply_chain.map(s => `
      <div style="font-size:12.5px; margin-bottom:8px; display:flex; justify-content:space-between;">
        <span>${s.label}:</span>
        <strong>${s.done ? 'Верифицирован' : 'Ожидание'}</strong>
      </div>
    `).join('');

    const infoPanel = container.querySelector('#chk-info-panel');
    if (infoPanel) {
      infoPanel.innerHTML = `
        <h4 style="font-size:14px; font-weight:800; color:var(--navy); margin-bottom:12px;">Статус прохождения цепи:</h4>
        ${scHtml}
        <div style="font-size:11px; color:var(--text-muted); border-top:1px dashed #E2E8F0; margin-top:12px; padding-top:12px;">
          Вид: ${c.species}<br>Вес: ${c.weight_kg} кг
        </div>
      `;
    }
  }

  renderView();
  return container;
}

// ═══════════════════════════════════════════════
// PAGE 4: ADMIN DASHBOARD
// ═══════════════════════════════════════════════
function AdminPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  let mapInstance: any = null;
  let activeTab = 'quotas';

  function renderView() {
    const user = Session.getCurrentUser();

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

    container.querySelector('#form-admin-login')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const login = (container.querySelector('#adm-u') as HTMLInputElement).value;
      const pass = (container.querySelector('#adm-p') as HTMLInputElement).value;

      if (login === 'admin' && pass === 'admin') {
        Session.setCurrentUser({ id: 'admin', name: 'Акимат-Надзор', vessel: 'Situational Center', status: 'approved', greenScore: 100, role: 'admin' } as any);
        renderView();
      } else {
        const err = container.querySelector('#admin-login-err');
        if (err) err.innerHTML = `<div class="alert alert-red" style="margin-bottom: 12px;">Отказано в доступе</div>`;
      }
    });
  }

  function renderDashboard() {
    // Recalculate quotas
    const currentQuotaUsed = { sturgeon: 1243, carp: 18764, roach: 31882 };
    DB.catches.forEach(c => {
      if (c.species_en === 'sturgeon') currentQuotaUsed.sturgeon += c.weight_kg;
      if (c.species_en === 'carp') currentQuotaUsed.carp += c.weight_kg;
      if (c.species_en === 'roach') currentQuotaUsed.roach += c.weight_kg;
    });

    const sturgeonPct = ((currentQuotaUsed.sturgeon / DB.quotas.sturgeon.allocated) * 100).toFixed(0);
    const carpPct = ((currentQuotaUsed.carp / DB.quotas.carp.allocated) * 100).toFixed(0);
    const roachPct = ((currentQuotaUsed.roach / DB.quotas.roach.allocated) * 100).toFixed(0);

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
        <div>
          <h2>Ситуационный дашборд Акимата</h2>
          <p style="color:var(--text-secondary); font-size:13.5px;">Экологический радарный мониторинг и управление квотами</p>
        </div>
        <button id="btn-admin-logout" class="btn btn-outline btn-sm">Выйти</button>
      </div>

      <!-- Quotas meters -->
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; margin-bottom:32px;" class="passport-grid">
        <div class="card" style="padding:16px; border-radius:16px;">
          <div style="font-size:12px; color:var(--text-muted);">ОСВОЕНИЕ КВОТЫ: ОСЁТР</div>
          <div style="font-size:24px; font-weight:800; color:var(--red); margin:6px 0;">${sturgeonPct}%</div>
          <div class="progress-track"><div class="progress-fill progress-red" style="width:${sturgeonPct}%"></div></div>
        </div>
        <div class="card" style="padding:16px; border-radius:16px;">
          <div style="font-size:12px; color:var(--text-muted);">ОСВОЕНИЕ КВОТЫ: САЗАН</div>
          <div style="font-size:24px; font-weight:800; color:var(--navy); margin:6px 0;">${carpPct}%</div>
          <div class="progress-track"><div class="progress-fill progress-navy" style="width:${carpPct}%"></div></div>
        </div>
        <div class="card" style="padding:16px; border-radius:16px;">
          <div style="font-size:12px; color:var(--text-muted);">ОСВОЕНИЕ КВОТЫ: ВОБЛА</div>
          <div style="font-size:24px; font-weight:800; color:var(--cyan-dark); margin:6px 0;">${roachPct}%</div>
          <div class="progress-track"><div class="progress-fill progress-cyan" style="width:${roachPct}%"></div></div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:32px;" class="passport-grid">
        <!-- Sat map -->
        <div class="card" style="border-radius:16px;">
          <div class="card-header"><div class="card-title">Caspian Environmental Heatmap</div></div>
          <div class="card-body" style="padding:0;">
            <div id="admin-map" style="height:350px; width:100%;"></div>
          </div>
        </div>

        <!-- AntiGravity anomalies log -->
        <div class="card" style="padding:24px; border-radius:16px; display:flex; flex-direction:column; gap:16px;">
          <!-- Tabs inside logs -->
          <div class="tabs">
            <button class="tab-btn ${activeTab === 'quotas' ? 'active' : ''}" data-tab="quotas">Статистика</button>
            <button class="tab-btn ${activeTab === 'anomalies' ? 'active' : ''}" data-tab="anomalies">Лог аномалий</button>
          </div>

          <!-- Quotas stats -->
          <div class="tab-panel ${activeTab === 'quotas' ? 'active' : ''}">
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">Оперативное расходование государственных лимитов.</p>
            <div style="font-size:12.5px; line-height:1.8;">
              Осетр: <strong>${currentQuotaUsed.sturgeon.toFixed(1)} / 5000 кг</strong><br>
              Сазан: <strong>${currentQuotaUsed.carp.toFixed(1)} / 45000 кг</strong><br>
              Вобла: <strong>${currentQuotaUsed.roach.toFixed(1)} / 80000 кг</strong>
            </div>
          </div>

          <!-- Anomalies list -->
          <div class="tab-panel ${activeTab === 'anomalies' ? 'active' : ''}" style="max-height:280px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
            ${DB.antifrodLog.map(log => {
              const isPending = log.status === 'pending_review' || log.status === 'blocked';
              return `
                <div style="border:1.5px solid ${isPending ? 'var(--red)' : '#E2E8F0'}; border-radius:12px; padding:12px; background:${isPending ? 'var(--red-light)' : '#F8FAFC'};">
                  <div style="display:flex; justify-content:space-between; font-size:11px;">
                    <strong>ID: ${log.id}</strong>
                    <span class="badge ${isPending ? 'badge-red' : 'badge-green'}">${log.status}</span>
                  </div>
                  <p style="font-size:12px; margin:6px 0;">
                    Судно: <strong>${log.vessel}</strong> | Вобла: <strong>${log.weight} кг</strong>
                  </p>
                  ${isPending ? `
                    <button class="btn btn-cyan btn-sm btn-action-approve-quota" data-id="${log.id}" style="width:100%; font-size:11px; padding:4px 8px;">
                      Легализовать прилов через OcuQuota Share
                    </button>
                  ` : ''}
                </div>
              `;
            }).join('')}
            ${DB.antifrodLog.length === 0 ? '<p style="color:var(--text-muted); text-align:center;">Аномалий нет.</p>' : ''}
          </div>
        </div>
      </div>
    `;

    // Hook events
    container.querySelector('#btn-admin-logout')?.addEventListener('click', () => {
      Session.logout();
      renderView();
    });

    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => {
        activeTab = btn.getAttribute('data-tab')!;
        renderDashboard();
      };
    });

    container.querySelectorAll('.btn-action-approve-quota').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const log = DB.antifrodLog.find(x => x.id === id);
        if (log) {
          try {
            await leaseQuota(log.vessel, 'roach', log.weight);
            log.status = 'approved_manually';
            
            // Put updated log on server
            await fetch(`${API_BASE}/antifrod`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: log.id,
                vessel: log.vessel,
                species: log.species,
                weight: log.weight,
                reason: log.description,
                status: 'approved_manually',
                sent_to_moderator: true
              })
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

  renderView();
  return container;
}

// ═══════════════════════════════════════════════
// PAGE 5: SECURITY CONTROL (Cyber Dark Mode)
// ═══════════════════════════════════════════════
function IdxControlPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  function render() {
    const chainStatus = OcuChain.verify();

    container.innerHTML = `
      <style>
        .cyber-card {
          background: #090D16 !important;
          border: 1px solid rgba(6, 182, 212, 0.2) !important;
          color: #E2E8F0 !important;
          border-radius: 16px;
        }
        .cyber-text-cyan {
          color: #06B6D4 !important;
          text-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
        }
        .cyber-alert-red {
          background: rgba(239, 68, 68, 0.05) !important;
          border: 1px solid var(--red) !important;
          color: #FECACA !important;
          border-radius: 12px;
        }
      </style>

      <div style="background:#020617; padding:32px; border-radius:24px; border:1px solid #1E293B; color:#F8FAFC;">
        <h2 class="cyber-text-cyan" style="font-family:'Courier New', monospace; font-size:24px; margin-bottom:24px;">📡 КИБЕР-ЦЕНТР ТЕХНОЛОГИЧЕСКОГО НАДЗОРА И АНТИФРОДА</h2>
        
        <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:32px;" class="passport-grid">
          <div class="card cyber-card" style="padding:24px;">
            <div style="font-weight:700; margin-bottom:12px; font-family:'Courier New', monospace;">AI Cross-Check Anomaly Detector</div>
            <div class="terminal" style="background:#030712; max-height:260px; overflow-y:auto; padding:12px; border-radius:8px;">
              <div class="terminal-line"><span class="ts">[13:48:02]</span> <span class="info">[INFO]</span> OcuChain Ledger инициализирован. Интегрировано блоков: ${DB.catches.length}</div>
              <div class="terminal-line"><span class="ts">[13:48:03]</span> <span class="ok">[OK]</span> Модуль пространственного гироскопа калиброван.</div>
              ${DB.antifrodLog.map(x => `
                <div class="terminal-line">
                  <span class="ts">[${new Date(x.timestamp).toLocaleTimeString()}]</span>
                  <span class="err">[ANOMALY]</span>
                  <span class="msg">Судно ${x.vessel}: Вобла ${x.weight} кг отклонена. Биологический максимум превышен.</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card cyber-card" style="padding:24px; display:flex; flex-direction:column; gap:20px;">
            <div>
              <div style="font-weight:700; font-family:'Courier New', monospace; margin-bottom:12px;">LocalStorage Integrity (OcuChain Ledger)</div>
              ${chainStatus.valid 
                ? `<div class="alert alert-green" style="background:rgba(16,185,129,0.05); border:1px solid var(--green); color:#D1FAE5; padding:12px; border-radius:12px;">
                    ✓ Блокчейн цел. Все хэши OcuChain Ledger валидны.
                   </div>`
                : `<div class="alert cyber-alert-red" style="padding:12px;">
                    🚨 <strong>ОБНАРУЖЕН ВЗЛОМ ДАННЫХ!</strong><br>
                    Разрыв хэш-цепочки на блоке #${chainStatus.brokenAt}. Замок OcuLock активирован.
                   </div>`
              }
            </div>

            <button id="btn-hack-simulate" class="btn btn-danger btn-block btn-sm" style="font-family:'Courier New', monospace;">
              Симулировать ручной взлом JSON рыбаком
            </button>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#btn-hack-simulate')?.addEventListener('click', () => {
      breakBlockchainIntegrity();
      alert('Хэш-цепочка повреждена. Лицензия fisher1 заблокирована OcuLock. Перезапуск...');
      render();
    });
  }

  render();
  return container;
}

// ═══════════════════════════════════════════════
// SPA APPLICATION CONSTRUCTOR
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  const appRoot = document.getElementById('app-root');
  if (!appRoot) return;

  const header = document.createElement('header');
  header.id = 'site-header';
  header.innerHTML = `
    <div class="header-inner">
      <a href="/passport" data-route="/passport" class="header-logo">
        <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="var(--navy)" stroke-width="2.5" stroke-dasharray="6 4" />
          <path d="M8 24 C14 16, 22 18, 24 24 C26 30, 34 32, 40 24" stroke="var(--navy)" stroke-width="3" fill="none"/>
        </svg>
        <span>OcuCast</span>
        <span class="logo-tag">Mangistau</span>
      </a>

      <nav class="header-nav" id="main-nav-links">
        <a href="/passport" data-route="/passport">Публичный паспорт</a>
        <a href="/fisherman" data-route="/fisherman">Кабинет рыбака</a>
        <a href="/checkpoint" data-route="/checkpoint">Чекпоинт КПП</a>
        <a href="/admin" data-route="/admin">Ситуационный центр</a>
        <a href="/idx-control" data-route="/idx-control">Технадзор</a>
      </nav>

      <div class="header-actions">
        <div class="header-status">
          <span class="status-dot"></span>
          <span>OcuChain Live</span>
        </div>
      </div>
    </div>
  `;

  const pageContainer = document.createElement('div');
  pageContainer.id = 'page-container';

  const footer = document.createElement('footer');
  footer.id = 'site-footer';
  
  function updateFooterHash() {
    const chain = OcuChain.getChain();
    const lastHash = chain.length ? chain[chain.length - 1].hash : '0000000000000000';
    
    footer.innerHTML = `
      <div class="container">
        <div class="footer-inner">
          <div class="footer-brand">
            <div class="logo-white">OcuCast</div>
            <p>Физико-цифровая инфраструктура доверенной фиксации вылова.</p>
          </div>
          <div class="footer-cert">
            <div class="cert-badge">🛡️ Департамент Минсельхоза РК</div>
          </div>
        </div>
        <div class="footer-bottom">
          <div class="chain-hash">Chain Hash: ${lastHash}</div>
        </div>
      </div>
    `;
  }
  updateFooterHash();

  appRoot.innerHTML = '';
  appRoot.appendChild(header);
  appRoot.appendChild(pageContainer);
  appRoot.appendChild(footer);

  // Router register
  Router.register('/passport', PassportPage);
  Router.register('/fisherman', FishermanPage);
  Router.register('/checkpoint', CheckpointPage);
  Router.register('/admin', AdminPage);
  Router.register('/idx-control', IdxControlPage);

  // Intercept navigate to update footer
  const originalNavigate = Router.navigate;
  Router.navigate = function(path: string, pushState?: boolean) {
    originalNavigate.call(Router, path, pushState);
    updateFooterHash();
  };

  const originalRender = Router.render;
  Router.render = function(path: string) {
    originalRender.call(Router, path);
    updateFooterHash();
  };

  // Sync DB
  await DB.init();

  // Start router
  Router.init();

  // Hide loader
  const loader = document.getElementById('loading-screen');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 400);
  }
});
