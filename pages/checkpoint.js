window.CheckpointPage = function() {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  let selectedCatch = null;
  let validationError = '';
  let successMsg = '';

  function render() {
    const user = Session.currentUser;

    if (!user || (user.role !== 'inspector' && user.role !== 'admin')) {
      renderLoginForm();
      return;
    }

    renderCheckpointTerminal();
  }

  function renderLoginForm() {
    container.innerHTML = `
      <div class="login-screen">
        <div class="login-card slide-up">
          <div class="login-logo">
            <div class="logo-icon" style="background: linear-gradient(135deg, var(--navy) 0%, var(--cyan) 100%);">
              <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="14" width="32" height="26" rx="4" stroke="#fff" stroke-width="3"/>
                <path d="M18 14V10C18 6.68629 20.6863 4 24 4C27.3137 4 30 6.68629 30 10V14" stroke="#fff" stroke-width="3"/>
                <circle cx="24" cy="27" r="3" fill="#fff"/>
              </svg>
            </div>
            <h2>OcuCast Checkpoint Secure</h2>
            <p>Панель инспектора портов, заводов и логистики</p>
          </div>
          <div id="login-error-msg"></div>
          <form id="checkpoint-login-form">
            <div class="form-group">
              <label class="form-label" for="login-user">Логин инспектора</label>
              <input type="text" id="login-user" class="form-input" placeholder="Например: inspector1" required value="inspector1">
            </div>
            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label" for="login-pass">Пароль доступа</label>
              <input type="password" id="login-pass" class="form-input" placeholder="••••••••" required value="demo">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Авторизоваться</button>
          </form>
          <div style="margin-top: 20px; font-size: 11px; color: var(--text-muted); text-align: center; line-height: 1.5;">
            Система криптографической подписи Multi-Sig.<br>Все действия логируются в инспекторский реестр надзора Акимата.
          </div>
        </div>
      </div>
    `;

    container.querySelector('#checkpoint-login-form').onsubmit = (e) => {
      e.preventDefault();
      const login = container.querySelector('#login-user').value;
      const pass = container.querySelector('#login-pass').value;
      const res = Auth.login(login, pass);
      if (res.success && (res.role === 'inspector' || res.role === 'admin')) {
        Router.render('/checkpoint');
      } else {
        const errEl = container.querySelector('#login-error-msg');
        errEl.innerHTML = `<div class="alert alert-red" style="margin-bottom: 16px;">Доступ заблокирован: неверные учетные данные инспектора.</div>`;
      }
    };
  }

  function renderCheckpointTerminal() {
    const user = Session.currentUser;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h1 style="font-size: 24px; font-weight: 800; color: var(--navy); letter-spacing: -0.5px;">
            Регистрация нового этапа в цепи поставок
          </h1>
          <p style="font-size: 13.5px; color: var(--text-secondary); margin-top: 2px;">
            Инспектор: <strong>${user.name}</strong> (${user.role === 'admin' ? 'Администратор' : 'Контролер КПП'})
          </p>
        </div>
        <div>
          <button id="btn-logout" class="btn btn-ghost btn-sm">Выйти из системы</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 32px;" class="passport-grid">
        
        <!-- Registration Form Card -->
        <div class="card" style="border: 1.5px solid #E2E8F0;">
          <div class="card-header" style="border-bottom: 1px solid #F1F5F9; padding-bottom: 16px;">
            <div class="card-title">📝 Внесение логистических данных партии</div>
            <div class="card-subtitle">Заполнение параметров температурного режима контейнеров</div>
          </div>
          <div class="card-body">
            
            <form id="checkpoint-stage-form">
              
              <!-- OcuCast ID & Verification -->
              <div class="form-group">
                <label class="form-label" for="catch-id-input">Идентификатор OcuCast ID</label>
                <div style="display: flex; gap: 8px;">
                  <input type="text" id="catch-id-input" class="form-input" placeholder="Например: OC-2026-000184" required value="${selectedCatch ? selectedCatch.id : ''}">
                  <button type="button" id="btn-verify-catch" class="btn btn-outline">Проверить ID</button>
                </div>
                <div id="catch-verify-status" style="margin-top: 8px;"></div>
              </div>

              <!-- Stage Selection -->
              <div class="form-group">
                <label class="form-label" for="stage-select">Текущий этап регистрации</label>
                <select id="stage-select" class="form-input form-select" disabled>
                  <option value="" disabled selected>Выберите ID улова для разблокировки</option>
                  <option value="port">🏗️ Порт (Multi-Sig подтвержден)</option>
                  <option value="factory">🏭 Рыбозавод (-4°C Guard)</option>
                  <option value="retail">🛒 Ритейл / Прилавок магазина</option>
                </select>
              </div>

              <!-- Temperature Guard -->
              <div class="form-group">
                <label class="form-label" for="temp-input">Температура хранения (°C Guard)</label>
                <input type="number" id="temp-input" class="form-input" placeholder="Например: -4" step="0.5" disabled>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Критически важно для соблюдения санитарного регламента Мангистауской области.</div>
              </div>

              <!-- Location and inspector FIO -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="form-group">
                  <label class="form-label" for="loc-input">Локация пункта КПП</label>
                  <input type="text" id="loc-input" class="form-input" placeholder="Например: Порт Баутино" disabled>
                </div>
                <div class="form-group">
                  <label class="form-label" for="inspector-fio-input">Ответственное лицо (ФИО)</label>
                  <input type="text" id="inspector-fio-input" class="form-input" value="${user.name}" disabled>
                </div>
              </div>

              <!-- Multi-Sig Button Handshake -->
              <div style="margin: 24px 0; border-top: 1px dashed #E2E8F0; padding-top: 20px;">
                <button type="button" id="btn-multisig-scan" class="btn btn-cyan btn-block" disabled>
                  🤝 Сканировать QR-код рыбака для крипто-подписи
                </button>
              </div>

              <div id="checkpoint-action-feedback"></div>

              <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                <button type="reset" class="btn btn-ghost">Сбросить</button>
                <button type="submit" id="btn-submit-checkpoint" class="btn btn-primary" disabled>Зафиксировать этап</button>
              </div>

            </form>

          </div>
        </div>

        <!-- Right Side: Active Catch details panel -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          
          <!-- Selected Catch Details Card -->
          <div class="card" id="catch-details-panel">
            <div class="card-header" style="border-bottom: 1px solid #F1F5F9; padding-bottom: 16px;">
              <div class="card-title">ℹ️ Информация о партии</div>
              <div class="card-subtitle">Данные о вылове, полученные из блокчейн-реестра</div>
            </div>
            <div class="card-body">
              <div style="text-align: center; color: var(--text-muted); padding: 40px 20px;" id="no-catch-msg">
                <span style="font-size: 32px;">🔍</span>
                <p style="font-size: 13px; margin-top: 12px;">Проверьте корректность OcuCast ID для отображения истории цепочки поставок.</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;

    container.querySelector('#btn-logout').onclick = () => {
      Auth.logout();
      Router.render('/checkpoint');
    };

    const catchInput = container.querySelector('#catch-id-input');
    const verifyBtn = container.querySelector('#btn-verify-catch');
    const verifyStatus = container.querySelector('#catch-verify-status');
    
    const stageSelect = container.querySelector('#stage-select');
    const tempInput = container.querySelector('#temp-input');
    const locInput = container.querySelector('#loc-input');
    const multisigBtn = container.querySelector('#btn-multisig-scan');
    const submitBtn = container.querySelector('#btn-submit-checkpoint');

    verifyBtn.onclick = () => {
      const cid = catchInput.value.trim();
      const found = DB.catches.find(c => c.id === cid);
      
      if (found) {
        selectedCatch = found;
        verifyStatus.innerHTML = `
          <div class="alert alert-green" style="font-size:12px; padding:8px 12px;">
            ✓ Идентификатор найден в реестре OcuChain. Судно: <strong>"${found.vessel}"</strong>.
          </div>
        `;
        stageSelect.disabled = false;
        tempInput.disabled = false;
        locInput.disabled = false;
        multisigBtn.disabled = false;
        locInput.value = user.role === 'admin' ? 'Актау Ситуационный Центр' : 'Порт Баутино';
        
        renderCatchDetails(found);
      } else {
        selectedCatch = null;
        verifyStatus.innerHTML = `
          <div class="alert alert-red" style="font-size:12px; padding:8px 12px;">
            ❌ ID не найден. Проверьте правильность ввода.
          </div>
        `;
        stageSelect.disabled = true;
        tempInput.disabled = true;
        locInput.disabled = true;
        multisigBtn.disabled = true;
        submitBtn.disabled = true;
        
        document.getElementById('catch-details-panel').querySelector('.card-body').innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
            <span style="font-size: 32px;">🔍</span>
            <p style="font-size: 13px; margin-top: 12px;">Проверьте корректность OcuCast ID для отображения истории цепочки поставок.</p>
          </div>
        `;
      }
    };

    stageSelect.onchange = () => {
      const stage = stageSelect.value;
      if (stage === 'port') {
        tempInput.value = '2'; // Cool
      } else if (stage === 'factory') {
        tempInput.value = '-4'; // Freezing Guard
      } else {
        tempInput.value = '4'; // Retail
      }
    };

    let isMultisigSigned = false;
    multisigBtn.onclick = () => {
      multisigBtn.disabled = true;
      multisigBtn.textContent = '🔄 Соединение с устройством рыбака по Bluetooth BLE...';
      
      setTimeout(() => {
        isMultisigSigned = true;
        multisigBtn.className = 'btn btn-outline btn-block';
        multisigBtn.style.borderColor = 'var(--green)';
        multisigBtn.style.color = '#065F46';
        multisigBtn.innerHTML = '✓ Multi-Sig Подпись Рыбака Подтверждена через Bluetooth';
        submitBtn.disabled = false;
      }, 1500);
    };

    container.querySelector('#checkpoint-stage-form').onsubmit = (e) => {
      e.preventDefault();
      if (!selectedCatch) return;

      const stage = stageSelect.value;
      const temp = parseFloat(tempInput.value);
      const loc = locInput.value;
      const name = user.name;

      const res = CheckpointController.registerStage({
        catch_id: selectedCatch.id,
        stage,
        temperature: temp,
        location: loc,
        inspector_name: name,
        inspector_id: user.id
      });

      const feedback = container.querySelector('#checkpoint-action-feedback');
      if (res.success) {
        feedback.innerHTML = `
          <div class="alert alert-green" style="margin-top: 16px;">
            <span class="alert-icon">✓</span>
            <div><strong>Этап успешно верифицирован!</strong> Изменения мгновенно добавлены на публичный паспорт и отправлены в распределенный лог OcuChain.</div>
          </div>
        `;
        renderCatchDetails(selectedCatch);
        submitBtn.disabled = true;
        isMultisigSigned = false;
        multisigBtn.className = 'btn btn-cyan btn-block';
        multisigBtn.innerHTML = '🤝 Сканировать QR-код рыбака для крипто-подписи';
        multisigBtn.disabled = false;
      } else {
        feedback.innerHTML = `
          <div class="alert alert-red" style="margin-top: 16px;">
            <span class="alert-icon">❌</span>
            <div>Ошибка проведения этапа: ${res.error}</div>
          </div>
        `;
      }
    };
  }

  function renderCatchDetails(catchRecord) {
    const detailsPanel = container.querySelector('#catch-details-panel');
    if (!detailsPanel) return;

    const timelineHtml = catchRecord.supply_chain.map(step => {
      const isDone = step.done;
      return `
        <div style="display: flex; gap: 12px; margin-bottom: 16px; align-items: flex-start;">
          <div style="width: 20px; height: 20px; border-radius: 50%; background: ${isDone ? 'var(--green)' : '#E2E8F0'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; margin-top: 2px;">
            ${isDone ? '✓' : ''}
          </div>
          <div>
            <div style="font-size: 13px; font-weight: 700; color: ${isDone ? 'var(--navy)' : 'var(--text-muted)'}">${step.label}</div>
            ${isDone 
              ? `<div style="font-size: 11.5px; color: var(--text-secondary);">
                  ОК: ${step.inspector}<br>
                  ${step.temp !== null ? `Температура: <strong>${step.temp}°C</strong><br>` : ''}
                  Время: ${new Date(step.time).toLocaleString('ru-RU')}
                 </div>`
              : `<div style="font-size: 11px; color: var(--text-muted);">Ожидает верификации на КПП</div>`
            }
          </div>
        </div>
      `;
    }).join('');

    detailsPanel.querySelector('.card-body').innerHTML = `
      <div style="font-size: 13.5px; line-height: 1.7;">
        <div style="margin-bottom: 16px; border-bottom: 1px solid #F1F5F9; padding-bottom: 12px;">
          <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase;">Судно вылова</div>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 15px;">${catchRecord.vessel}</div>
        </div>
        <div style="margin-bottom: 16px; border-bottom: 1px solid #F1F5F9; padding-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase;">Вид рыбы</div>
            <div style="font-weight: 700; color: var(--text-primary);">${catchRecord.species}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase;">Вес партии</div>
            <div style="font-weight: 700; color: var(--cyan-dark);">${catchRecord.weight_kg} кг</div>
          </div>
        </div>
        
        <h4 style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: var(--navy); margin-bottom: 14px; letter-spacing: 0.5px;">Прохождение цепи:</h4>
        <div style="margin-left: 4px;">
          ${timelineHtml}
        </div>
      </div>
    `;
  }

  render();
  return container;
};
