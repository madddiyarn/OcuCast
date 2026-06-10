/**
 * OcuCast — Fisherman Page (Terminal & Wizard Master)
 * Premium Light Mode, Inter Font, Step-by-Step wizard.
 * Direct web-camera activation, scale simulator, AntiGravity blocker.
 */

window.FishermanPage = function() {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  let currentStep = 1;
  let simulatedWeight = 1.8;
  let selectedSpecies = 'roach'; // Вобла
  let isCameraActive = false;
  let capturedImage = null;
  let localStream = null;
  let gyroAngle = 12; // Gyroscope simulation angle
  let currentAIAnalysis = null;
  let isSubmitting = false;

  function render() {
    const user = Session.currentUser;

    // Route guard: Require login
    if (!user || user.role !== 'fisherman') {
      renderLoginForm();
      return;
    }

    // Route guard: Check moderation status
    if (user.status === 'pending') {
      renderPendingApproval();
      return;
    }

    renderWizard();
  }

  // ─────────────────────────────────────────────
  // 1. LOGIN FORM
  // ─────────────────────────────────────────────
  function renderLoginForm() {
    container.innerHTML = `
      <div class="login-screen">
        <div class="login-card slide-up">
          <div class="login-logo">
            <div class="logo-icon">
              <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke="#06B6D4" stroke-width="3" stroke-dasharray="6 4" />
                <path d="M8 24 C14 16, 22 18, 24 24 C26 30, 34 32, 40 24" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
              </svg>
            </div>
            <h2>OcuCast Secure Login</h2>
            <p>Терминал капитана судна и мастера фиксации</p>
          </div>
          <div id="login-error-msg"></div>
          <form id="fisher-login-form">
            <div class="form-group">
              <label class="form-label" for="login-user">Логин судна / лицензии</label>
              <input type="text" id="login-user" class="form-input" placeholder="Например: fisher1" required value="fisher1">
            </div>
            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label" for="login-pass">Пароль авторизации</label>
              <input type="password" id="login-pass" class="form-input" placeholder="••••••••" required value="demo">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Войти в терминал</button>
          </form>
          <div style="margin-top: 20px; font-size: 11px; color: var(--text-muted); text-align: center; line-height: 1.5;">
            Доверенное шифрование OcuChain Ledger.<br>Доступ разрешен только лицензированным промысловикам Акимата Мангистауской области.
          </div>
        </div>
      </div>
    `;

    container.querySelector('#fisher-login-form').onsubmit = (e) => {
      e.preventDefault();
      const login = container.querySelector('#login-user').value;
      const pass = container.querySelector('#login-pass').value;
      const res = Auth.login(login, pass);
      if (res.success) {
        // Reload page
        Router.render('/fisherman');
      } else {
        const errEl = container.querySelector('#login-error-msg');
        errEl.innerHTML = `<div class="alert alert-red" style="margin-bottom: 16px;">${res.error}</div>`;
      }
    };
  }

  // ─────────────────────────────────────────────
  // 2. PENDING MODERATION STATE
  // ─────────────────────────────────────────────
  function renderPendingApproval() {
    container.innerHTML = `
      <div style="max-width: 600px; margin: 40px auto;" class="slide-up">
        <div class="card" style="border: 2px solid var(--amber);">
          <div style="background: var(--amber-light); padding: 24px; display: flex; gap: 16px; align-items: flex-start; border-bottom: 1px solid #FDE68A;">
            <span style="font-size: 32px;">⏳</span>
            <div>
              <h3 style="font-size: 18px; font-weight: 800; color: #92400E; margin-bottom: 4px;">Лицензия на модерации Акимата</h3>
              <p style="font-size: 13.5px; color: #92400E; line-height: 1.5;">
                Статус вашего судна <strong>"${Session.currentUser.vessel}"</strong> находится в режиме ожидания подтверждения со стороны Управления рыбного хозяйства Мангистауской области.
              </p>
            </div>
          </div>
          <div class="card-body" style="padding: 28px;">
            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 20px;">
              <strong>Реквизиты заявки:</strong>
              <ul style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px; list-style: disc; padding-left: 20px;">
                <li>Судно: ${Session.currentUser.vessel} (Рег: ${Session.currentUser.vessel_id})</li>
                <li>Капитан: ${Session.currentUser.name}</li>
                <li>Срок квот: Сезон 2026</li>
              </ul>
            </div>
            <div style="display: flex; gap: 12px;">
              <button id="btn-logout-pending" class="btn btn-ghost">Сменить аккаунт</button>
              <button onclick="location.reload()" class="btn btn-outline">Обновить статус</button>
            </div>
          </div>
        </div>
      </div>
    `;
    container.querySelector('#btn-logout-pending').onclick = () => {
      Auth.logout();
      Router.render('/fisherman');
    };
  }

  // ─────────────────────────────────────────────
  // 3. WIZARD TERMINAL
  // ─────────────────────────────────────────────
  function renderWizard() {
    const user = Session.currentUser;

    // Calculate wizard steps markup
    const steps = [
      { num: 1, label: 'Калибровка веса' },
      { num: 2, label: 'Биометрия и камера' },
      { num: 3, label: 'Квоты и Smart-Exchange' },
      { num: 4, label: 'Проверка и печать' }
    ];

    const wizardProgressHtml = steps.map((s, idx) => {
      const isDone = s.num < currentStep;
      const isActive = s.num === currentStep;
      return `
        <div class="wizard-step-indicator">
          <div class="wizard-step-dot ${isDone ? 'done' : isActive ? 'active' : ''}">
            ${isDone ? '✓' : s.num}
          </div>
          ${idx < steps.length - 1 ? `<div class="wizard-step-line ${isDone ? 'done' : ''}"></div>` : ''}
        </div>
      `;
    }).join('');

    // Active screen HTML
    let stepContentHtml = '';

    if (currentStep === 1) {
      // Step 1: Weight Calibration
      stepContentHtml = `
        <div class="slide-up">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--navy); margin-bottom: 12px;">Шаг 1: Автофиксация веса улова</h2>
          <p style="color: var(--text-secondary); font-size: 13.5px; margin-bottom: 24px;">
            Поместите партию рыбы на электронные весы. Значение веса передается по шифрованному протоколу весов и не подлежит ручному изменению.
          </p>

          <div class="card" style="margin-bottom: 24px; border: 1px solid #E2E8F0;">
            <div class="card-body">
              <div class="weight-display">
                <div class="weight-value" id="weight-display-val">${simulatedWeight.toFixed(1)}<span class="weight-unit">кг</span></div>
                <div class="weight-source">⚡ IoT Hardware Scales Connected (9600 bps)</div>
              </div>

              <!-- Simulation Slider -->
              <div class="weight-slider-sim">
                <label for="weight-sim-slider">Симулятор весов (для демонстрации AntiGravity и квот)</label>
                <input type="range" id="weight-sim-slider" min="0.5" max="15.0" step="0.1" value="${simulatedWeight}">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 6px;">
                  <span>0.5 кг</span>
                  <span style="color: var(--red); font-weight: 700;">4.6 кг (Триггер аномалии)</span>
                  <span>15.0 кг</span>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Вид рыбы для регистрации</label>
            <select id="species-select" class="form-input form-select">
              <option value="roach" ${selectedSpecies === 'roach'?'selected':''}>Вобла (Лимит AntiGravity ≤ 3.0 кг)</option>
              <option value="carp" ${selectedSpecies === 'carp'?'selected':''}>Сазан (Лимит AntiGravity ≤ 25.0 кг)</option>
              <option value="sturgeon" ${selectedSpecies === 'sturgeon'?'selected':''}>Осетр (Лимит AntiGravity ≤ 80.0 кг)</option>
            </select>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
            <button id="wizard-step1-next" class="btn btn-primary">Продолжить к сканированию</button>
          </div>
        </div>
      `;
    } else if (currentStep === 2) {
      // Step 2: Device Camera / Biomety
      stepContentHtml = `
        <div class="slide-up">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--navy); margin-bottom: 12px;">Шаг 2: Камера и ИИ-Анализ биометрии</h2>
          <p style="color: var(--text-secondary); font-size: 13.5px; margin-bottom: 20px;">
            Сделайте снимок улова. Загрузка фотографий из галереи заблокирована аппаратной политикой безопасности для защиты от подделки. Разрешена только прямая съемка.
          </p>

          <div class="card" style="margin-bottom: 24px; overflow: hidden; border: 1.5px solid #E2E8F0;">
            <div class="card-body" style="padding: 0; background: #000; height: 320px; display: flex; align-items: center; justify-content: center; position: relative;">
              
              <!-- Video / Canvas display -->
              <video id="webcam-preview" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover; display: ${isCameraActive && !capturedImage ? 'block' : 'none'};"></video>
              
              ${capturedImage 
                ? `<img src="${capturedImage}" id="captured-preview" style="width: 100%; height: 100%; object-fit: cover; display: block;" />` 
                : ''}

              ${!isCameraActive && !capturedImage 
                ? `<div style="text-align: center; color: #94A3B8; padding: 24px;">
                    <div style="font-size: 40px; margin-bottom: 12px;">📷</div>
                    <button id="btn-activate-camera" class="btn btn-cyan btn-sm">Активировать камеру устройства</button>
                    <p style="font-size: 11px; margin-top: 8px; color: #64748B;">Разрешена только аппаратная камера (capture="camera")</p>
                   </div>`
                : ''}

              <!-- Live camera actions overlay -->
              ${isCameraActive && !capturedImage 
                ? `<button id="btn-shoot-camera" class="btn btn-cyan" style="position: absolute; bottom: 20px; z-index: 10;">📸 Зафиксировать кадр</button>` 
                : ''}

              ${capturedImage 
                ? `<button id="btn-retake-camera" class="btn btn-ghost btn-sm" style="position: absolute; bottom: 20px; left: 20px; z-index: 10;">Переснять</button>` 
                : ''}
            </div>
          </div>

          <!-- Gyroscope simulator -->
          <div style="background: #F1F5F9; border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
            <span style="color: var(--text-secondary); font-weight: 500;">Угол наклона гироскопа (фиксация):</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="range" id="gyro-sim-slider" min="5" max="80" value="${gyroAngle}" style="width: 120px;">
              <span id="gyro-display-val" style="font-weight: 700; font-family: monospace;">${gyroAngle}°</span>
            </div>
          </div>

          <!-- Neural network feedback panel -->
          <div class="ai-panel" style="margin-bottom: 24px; display: ${capturedImage ? 'block' : 'none'};">
            <div class="ai-panel-title">
              <span>🤖</span> ИИ-Анализ биометрии и текстуры (ML Model Core V4)
            </div>
            
            <div class="ai-metric">
              <span class="ai-metric-label">Распознавание вида (${selectedSpecies === 'roach'?'Вобла':'Сазан'}):</span>
              <span class="ai-metric-pct" id="ai-pct-species">--%</span>
            </div>
            <div class="progress-track" style="margin-bottom: 12px; height: 5px;">
              <div class="progress-fill progress-cyan" id="ai-bar-species" style="width: 0%;"></div>
            </div>

            <div class="ai-metric">
              <span class="ai-metric-label">Детекция аномалий чешуи / нефтепродуктов:</span>
              <span class="ai-metric-pct" id="ai-pct-anomaly">--%</span>
            </div>
            <div class="progress-track" style="margin-bottom: 12px; height: 5px;">
              <div class="progress-fill progress-cyan" id="ai-bar-anomaly" style="width: 0%;"></div>
            </div>

            <div class="ai-metric">
              <span class="ai-metric-label">Индекс свежести по роговице глаза рыбы:</span>
              <span class="ai-metric-pct" id="ai-pct-freshness">--%</span>
            </div>
            <div class="progress-track" style="height: 5px;">
              <div class="progress-fill progress-green" id="ai-bar-freshness" style="width: 0%;"></div>
            </div>
          </div>

          <div id="ag-alert-wrapper"></div>

          <div style="display: flex; justify-content: space-between; margin-top: 24px;">
            <button id="wizard-step2-prev" class="btn btn-ghost">Назад</button>
            <button id="wizard-step2-next" class="btn btn-primary" ${!capturedImage?'disabled':''}>Продолжить</button>
          </div>
        </div>
      `;
    } else if (currentStep === 3) {
      // Step 3: Quota and Smart-Exchange lease
      const quotaResult = OcuQuota.checkAndShare(user.id, selectedSpecies, simulatedWeight);
      const isQuotaExceeded = quotaResult.quota_share_used;

      stepContentHtml = `
        <div class="slide-up">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--navy); margin-bottom: 12px;">Шаг 3: Автораспределение и Аренда квот</h2>
          <p style="color: var(--text-secondary); font-size: 13.5px; margin-bottom: 24px;">
            Система сверяет ваш улов с остатком лимитов на 2026 год.
          </p>

          <div class="card" style="margin-bottom: 24px; border: 1.5px solid #E2E8F0;">
            <div class="card-body">
              <h4 style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px;">Ваш остаток квот:</h4>
              
              <div class="quota-item">
                <div class="quota-header">
                  <span class="quota-species">🐠 ${selectedSpecies === 'roach'?'Вобла':selectedSpecies === 'carp'?'Сазан':'Осетр'}</span>
                  <span class="quota-numbers">${(user.personal_quota[selectedSpecies] - user.used_quota[selectedSpecies]).toFixed(1)} / ${user.personal_quota[selectedSpecies]} кг</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill progress-navy" style="width: ${((user.personal_quota[selectedSpecies] - user.used_quota[selectedSpecies])/user.personal_quota[selectedSpecies]*100).toFixed(0)}%"></div>
                </div>
              </div>
            </div>
          </div>

          ${isQuotaExceeded 
            ? `<div class="alert alert-cyan" style="margin-bottom: 24px; border: 2px solid var(--cyan);">
                <div style="font-size: 24px; float: left; margin-right: 12px;">⚡</div>
                <div>
                  <h4 style="font-weight: 800; margin-bottom: 4px; color: var(--cyan-dark);">Сработал алгоритм OcuQuota Share</h4>
                  <p style="line-height: 1.5;">
                    Ваш улов (<strong>${simulatedWeight} кг</strong>) превышает личный лимит на <strong>${quotaResult.deficit_kg.toFixed(2)} кг</strong>.
                    Биржа Smart-Exchange автоматически осуществила аренду квоты у судна 
                    <strong>"${quotaResult.donor_vessel}"</strong> (лицензия: ${quotaResult.donor_vessel_id}).
                    Прилов полностью легализован. Контракт квоты: <strong>${quotaResult.tx_id}</strong>.
                  </p>
                </div>
               </div>`
            : `<div class="alert alert-green" style="margin-bottom: 24px;">
                <span class="alert-icon">✓</span>
                <div>Улов укладывается в доступные личные лимиты. Автоматическая биржа аренды квот не требуется.</div>
               </div>`
          }

          <div style="display: flex; justify-content: space-between; margin-top: 24px;">
            <button id="wizard-step3-prev" class="btn btn-ghost">Назад</button>
            <button id="wizard-step3-next" class="btn btn-primary">Продолжить</button>
          </div>
        </div>
      `;
    } else if (currentStep === 4) {
      // Step 4: Verification, local storage ledger, and mock bluetooth printer receipt
      const recValue = (simulatedWeight * (selectedSpecies==='sturgeon'?5000:selectedSpecies==='carp'?950:1200)).toLocaleString('ru-KZ');

      stepContentHtml = `
        <div class="slide-up">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--navy); margin-bottom: 12px;">Шаг 4: Подпись и фиксация в реестре</h2>
          <p style="color: var(--text-secondary); font-size: 13.5px; margin-bottom: 20px;">
            Данные будут неизменяемо записаны в оффлайн-блокчейн реестр OcuChain Ledger и подготовлены к синхронизации с облаком Акимата.
          </p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;" class="passport-grid">
            <div class="card" style="border: 1px solid #E2E8F0;">
              <div class="card-header" style="border-bottom: 1px solid #F1F5F9; padding-bottom: 12px;">
                <div class="card-title">🧾 Детализирующий чек (OcuPrice)</div>
              </div>
              <div class="card-body" style="font-size: 13px; line-height: 1.8;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Судно:</span>
                  <strong style="color: var(--text-primary);">${user.vessel}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Вид рыбы:</span>
                  <strong style="color: var(--text-primary);">${selectedSpecies === 'roach'?'Вобла':selectedSpecies === 'carp'?'Сазан':'Осетр'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Вес партии:</span>
                  <strong style="color: var(--text-primary);">${simulatedWeight} кг</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Цена Минсельхоза:</span>
                  <strong style="color: var(--text-primary);">${selectedSpecies==='sturgeon'?5000:selectedSpecies==='carp'?950:1200} KZT/кг</strong>
                </div>
                <div style="border-top: 1px dashed #E2E8F0; margin-top: 8px; padding-top: 8px; display: flex; justify-content: space-between; font-size: 14px;">
                  <span style="font-weight: 700; color: var(--navy);">Итого к получению:</span>
                  <strong style="font-weight: 900; color: var(--navy);">${recValue} KZT</strong>
                </div>
              </div>
            </div>

            <div class="card" style="border: 1px solid #E2E8F0;">
              <div class="card-header" style="border-bottom: 1px solid #F1F5F9; padding-bottom: 12px;">
                <div class="card-title">📡 Локальный блокчейн OcuChain</div>
              </div>
              <div class="card-body" style="font-size: 12px;">
                <div class="oculock-badge" style="width: 100%; margin-bottom: 12px; justify-content: center;">
                  🔐 OcuChain Ledger Active
                </div>
                <p style="color: var(--text-secondary); line-height: 1.4;">
                  Подпись транзакции сгенерирует криптографический блок. В случае модификации JSON-массивов рыбаком, замок <strong>OcuLock</strong> мгновенно заблокирует профиль судна.
                </p>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px;">
            <button id="btn-fix-print" class="btn btn-cyan">
              🖨️ Зафиксировать и напечатать QR
            </button>
            <button id="btn-sync-db" class="btn btn-primary" disabled>
              🔄 Синхронизировать с БД (Есть связь)
            </button>
          </div>

          <div id="print-status-msg"></div>

          <div style="display: flex; justify-content: space-between; margin-top: 24px; border-top: 1px solid #E2E8F0; padding-top: 20px;">
            <button id="wizard-step4-prev" class="btn btn-ghost">Назад</button>
            <button id="btn-reset-wizard" class="btn btn-outline">Зафиксировать следующий улов</button>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h1 style="font-size: 24px; font-weight: 800; color: var(--navy); letter-spacing: -0.5px;">
            Терминал рыбака и фиксация улова
          </h1>
          <p style="font-size: 13.5px; color: var(--text-secondary); margin-top: 2px;">
            Судно: <strong>${user.vessel}</strong> (Капитан: ${user.name}) · Рейтинг судна: <span class="badge badge-green">${user.green_score}% Green Score</span>
          </p>
        </div>
        <div>
          <button id="btn-logout" class="btn btn-ghost btn-sm">Выйти из системы</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 280px 1fr; gap: 40px;" class="passport-grid">
        <!-- Sidebar Navigation Steps -->
        <div>
          <div class="card" style="position: sticky; top: 92px;">
            <div class="card-header" style="border-bottom: 1px solid #F1F5F9; padding-bottom: 12px;">
              <div class="card-title">Этапы фиксации</div>
            </div>
            <div class="card-body" style="display: flex; flex-direction: column; gap: 20px;">
              <div style="display: flex; flex-direction: column; gap: 16px;">
                ${steps.map(s => {
                  const isDone = s.num < currentStep;
                  const isActive = s.num === currentStep;
                  return `
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <div class="wizard-step-dot ${isDone ? 'done' : isActive ? 'active' : ''}" style="width: 28px; height: 28px; font-size: 11px;">
                        ${isDone ? '✓' : s.num}
                      </div>
                      <span style="font-size: 13px; font-weight: ${isActive ? '700':'500'}; color: ${isActive ? 'var(--navy)': isDone ? 'var(--text-primary)': 'var(--text-muted)'}">
                        ${s.label}
                      </span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Wizard dynamic workspace -->
        <div>
          ${stepContentHtml}
        </div>
      </div>
    `;

    // Hook events depending on the current step
    container.querySelector('#btn-logout').onclick = () => {
      Auth.logout();
      Router.render('/fisherman');
    };

    if (currentStep === 1) {
      const slider = container.querySelector('#weight-sim-slider');
      const valDisp = container.querySelector('#weight-display-val');
      const specSel = container.querySelector('#species-select');

      slider.oninput = (e) => {
        simulatedWeight = parseFloat(e.target.value);
        valDisp.innerHTML = `${simulatedWeight.toFixed(1)}<span class="weight-unit">кг</span>`;
      };

      specSel.onchange = (e) => {
        selectedSpecies = e.target.value;
      };

      container.querySelector('#wizard-step1-next').onclick = () => {
        currentStep = 2;
        renderWizard();
      };
    } else if (currentStep === 2) {
      const gyroSlider = container.querySelector('#gyro-sim-slider');
      const gyroDisp = container.querySelector('#gyro-display-val');

      gyroSlider.oninput = (e) => {
        gyroAngle = parseInt(e.target.value);
        gyroDisp.textContent = `${gyroAngle}°`;
        // Recalculate AntiGravity live checks if captured
        if (capturedImage) {
          runAntiGravityCheck();
        }
      };

      const btnActivate = container.querySelector('#btn-activate-camera');
      if (btnActivate) {
        btnActivate.onclick = startCamera;
      }

      const btnShoot = container.querySelector('#btn-shoot-camera');
      if (btnShoot) {
        btnShoot.onclick = captureFrame;
      }

      const btnRetake = container.querySelector('#btn-retake-camera');
      if (btnRetake) {
        btnRetake.onclick = () => {
          capturedImage = null;
          isCameraActive = false;
          currentStep = 2;
          renderWizard();
        };
      }

      container.querySelector('#wizard-step2-prev').onclick = () => {
        stopCamera();
        currentStep = 1;
        renderWizard();
      };

      const btnNext = container.querySelector('#wizard-step2-next');
      btnNext.onclick = () => {
        stopCamera();
        // Check if AntiGravity is blocked
        const agCheck = AntiGravity.check(selectedSpecies, simulatedWeight, gyroAngle);
        if (agCheck.blocked) {
          // Stay on step 2, show error
          runAntiGravityCheck();
        } else {
          currentStep = 3;
          renderWizard();
        }
      };

      if (capturedImage) {
        // Run AI UI animation simulation
        simulateAIProgress();
      }
    } else if (currentStep === 3) {
      container.querySelector('#wizard-step3-prev').onclick = () => {
        currentStep = 2;
        renderWizard();
      };
      container.querySelector('#wizard-step3-next').onclick = () => {
        currentStep = 4;
        renderWizard();
      };
    } else if (currentStep === 4) {
      container.querySelector('#wizard-step4-prev').onclick = () => {
        currentStep = 3;
        renderWizard();
      };

      const btnPrint = container.querySelector('#btn-fix-print');
      const btnSync = container.querySelector('#btn-sync-db');
      const printStatus = container.querySelector('#print-status-msg');

      btnPrint.onclick = () => {
        // Run database catch registry
        isSubmitting = true;
        btnPrint.disabled = true;
        printStatus.innerHTML = `
          <div class="alert alert-cyan" style="margin-top: 16px;">
            <span class="alert-icon">🔄</span>
            <div>Запись улова отправляется в локальный блокчейн OcuChain Ledger...</div>
          </div>
        `;

        setTimeout(() => {
          const res = CatchController.submit({
            fisherman_id: user.id,
            species_en: selectedSpecies,
            weight_kg: simulatedWeight,
            gyro_angle: gyroAngle
          });

          if (res.success) {
            printStatus.innerHTML = `
              <div class="alert alert-green" style="margin-top: 16px;">
                <span class="alert-icon">✓</span>
                <div>
                  <strong>Запись создана!</strong> Сгенерирован QR-код и отправлен на Bluetooth-принтер печати бирок.
                  <br>
                  <span style="font-family: monospace; font-size: 11px;">OcuCast ID: ${res.record.id}</span>
                </div>
              </div>
            `;
            btnSync.disabled = false;
          } else {
            printStatus.innerHTML = `
              <div class="alert alert-red" style="margin-top: 16px;">
                <span class="alert-icon">❌</span>
                <div>Ошибка сохранения: ${res.error || 'Блокировка системы'}</div>
              </div>
            `;
          }
        }, 1200);
      };

      btnSync.onclick = () => {
        btnSync.disabled = true;
        alert('Все оффлайн-записи успешно синхронизированы с облачной базой Акимата Мангистауской области!');
      };

      container.querySelector('#btn-reset-wizard').onclick = () => {
        currentStep = 1;
        capturedImage = null;
        isCameraActive = false;
        renderWizard();
      };
    }
  }

  // ─────────────────────────────────────────────
  // CAMERA OPERATIONS
  // ─────────────────────────────────────────────
  function startCamera() {
    isCameraActive = true;
    renderWizard();

    setTimeout(() => {
      const video = container.querySelector('#webcam-preview');
      if (!video) return;

      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          localStream = stream;
          video.srcObject = stream;
        })
        .catch(err => {
          console.warn("Камера недоступна, запускаем симуляцию.", err);
          // Draw fake moving video on canvas
          simulateVideoCanvas();
        });
    }, 100);
  }

  function simulateVideoCanvas() {
    const video = container.querySelector('#webcam-preview');
    if (video) video.style.display = 'none';

    // Insert fake preview box with animation
    const containerBody = container.querySelector('.card-body');
    const simBox = document.createElement('div');
    simBox.id = 'simulated-camera-view';
    simBox.style.cssText = 'width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#1e293b; color:#fff; position:relative;';
    simBox.innerHTML = `
      <div style="font-size:48px; animation: bounce 2s infinite;">🐟</div>
      <div style="font-size:12px; margin-top:12px; color:var(--cyan); font-weight:700;">СИМУЛЯТОР АППАРАТНОЙ КАМЕРЫ (АКТИВЕН)</div>
      <div style="font-size:10px; color:#94a3b8; margin-top:4px;">Приведение камеры к горизонту...</div>
      <button id="btn-shoot-camera-sim" class="btn btn-cyan btn-sm" style="position: absolute; bottom: 20px;">📸 Сделать снимок</button>
    `;
    containerBody.appendChild(simBox);

    containerBody.querySelector('#btn-shoot-camera-sim').onclick = () => {
      capturedImage = 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80'; // Beautiful fish sample
      isCameraActive = false;
      simBox.remove();
      renderWizard();
    };
  }

  function captureFrame() {
    const video = container.querySelector('#webcam-preview');
    if (video && localStream) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      capturedImage = canvas.toDataURL('image/jpeg');
      stopCamera();
      renderWizard();
    }
  }

  function stopCamera() {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    isCameraActive = false;
  }

  // ─────────────────────────────────────────────
  // ML MODEL SIMULATION
  // ─────────────────────────────────────────────
  function simulateAIProgress() {
    setTimeout(() => {
      const data = AIAnalysis.analyze(selectedSpecies, simulatedWeight);
      currentAIAnalysis = data;

      const barSpecies = container.querySelector('#ai-bar-species');
      const pctSpecies = container.querySelector('#ai-pct-species');
      const barAnomaly = container.querySelector('#ai-bar-anomaly');
      const pctAnomaly = container.querySelector('#ai-pct-anomaly');
      const barFreshness = container.querySelector('#ai-bar-freshness');
      const pctFreshness = container.querySelector('#ai-pct-freshness');

      if (barSpecies) {
        barSpecies.style.width = data.species_confidence + '%';
        pctSpecies.textContent = data.species_confidence + '%';
      }
      if (barAnomaly) {
        barAnomaly.style.width = data.anomaly_detection + '%';
        pctAnomaly.textContent = data.anomaly_detection + '%';
      }
      if (barFreshness) {
        barFreshness.style.width = data.freshness_index + '%';
        pctFreshness.textContent = data.freshness_index + '%';
      }

      // Check AntiGravity blocker and render if necessary
      runAntiGravityCheck();
    }, 400);
  }

  function runAntiGravityCheck() {
    const agCheck = AntiGravity.check(selectedSpecies, simulatedWeight, gyroAngle);
    const wrapper = container.querySelector('#ag-alert-wrapper');
    const nextBtn = container.querySelector('#wizard-step2-next');

    if (agCheck.blocked) {
      if (wrapper) {
        wrapper.innerHTML = `
          <div id="ag-alert" style="margin-top: 16px;">
            ${AntiGravity.renderAlert(agCheck)}
          </div>
        `;
      }
      if (nextBtn) nextBtn.disabled = true;
    } else {
      if (wrapper) wrapper.innerHTML = '';
      if (nextBtn) nextBtn.disabled = false;
    }
  }

  render();
  return container;
};
