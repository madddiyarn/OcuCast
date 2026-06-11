document.addEventListener('DOMContentLoaded', async () => {

  const appRoot = document.getElementById('app-root');

  const header = document.createElement('header');
  header.id = 'site-header';
  header.innerHTML = `
    <div class="header-inner">
      <a href="/passport" data-route="/passport" class="header-logo">
        <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="var(--navy)" stroke-width="2.5" stroke-dasharray="6 4" />
          <path d="M8 24 C14 16, 22 18, 24 24 C26 30, 34 32, 40 24" stroke="var(--navy)" stroke-width="3" fill="none" stroke-linecap="round"/>
          <circle cx="36" cy="24" r="3" fill="var(--cyan)"/>
        </svg>
        <span>OcuCast</span>
        <span class="logo-tag">Mangistau</span>
      </a>

      <nav class="header-nav" id="main-nav-links">
        <a href="/passport" data-route="/passport">
          <span class="nav-icon">📄</span> Публичный паспорт
        </a>
        <a href="/fisherman" data-route="/fisherman">
          <span class="nav-icon">🚤</span> Терминал рыбака
        </a>
        <a href="/checkpoint" data-route="/checkpoint">
          <span class="nav-icon">🏗️</span> Чекпоинт КПП
        </a>
        <a href="/admin" data-route="/admin">
          <span class="nav-icon">📊</span> Ситуационный центр
        </a>
        <a href="/idx-control" data-route="/idx-control">
          <span class="nav-icon">🛰️</span> Технадзор
        </a>
      </nav>

      <div class="header-actions">
        <div class="header-status">
          <span class="status-dot"></span>
          <span id="nav-system-status">OcuChain Live</span>
        </div>
        <button id="nav-auth-btn" class="btn-header-login">Кабинет</button>
        
        <button class="mobile-menu-btn" id="mobile-toggle-btn">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </div>
  `;

  const pageContainer = document.createElement('div');
  pageContainer.id = 'page-container';

  const footer = document.createElement('footer');
  footer.id = 'site-footer';
  
  function updateFooterHash() {
    const chain = OcuChain.getChain();
    const lastHash = chain.length ? chain[chain.length - 1].hash : 'sha256:0000000000000000000000000';
    
    footer.innerHTML = `
      <div class="container">
        <div class="footer-inner">
          <div class="footer-brand">
            <div class="logo-white">
              <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke="#fff" stroke-width="2" stroke-dasharray="6 4" />
                <path d="M8 24 C14 16, 22 18, 24 24 C26 30, 34 32, 40 24" stroke="var(--cyan)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
              </svg>
              <span>OcuCast</span>
            </div>
            <p>Физико-цифровая инфраструктура доверенной фиксации вылова рыбы в Каспийском бассейне.</p>
          </div>
          <div class="footer-links">
            <h4>Разделы системы</h4>
            <ul>
              <li><a href="/passport" data-route="/passport">Цифровой Паспорт</a></li>
              <li><a href="/fisherman" data-route="/fisherman">Личный кабинет капитана</a></li>
              <li><a href="/checkpoint" data-route="/checkpoint">Портовый Контроль</a></li>
              <li><a href="/admin" data-route="/admin">Ситуационный Центр Акимата</a></li>
            </ul>
          </div>
          <div class="footer-cert">
            <div class="cert-badge">
              <span>🛡️</span> Сделано для Акимата Мангистауской области
            </div>
            <p style="font-size:12px; color:var(--text-muted); line-height:1.5;">
              © 2026 OcuCast. Все права защищены.<br>Министерство Сельского Хозяйства РК.
            </p>
          </div>
        </div>
        <div class="footer-bottom">
          <div>Протокол: <strong>OcuQuota Share Smart-Exchange Enabled</strong></div>
          <div class="chain-hash" id="footer-chain-hash">Chain Hash: ${lastHash}</div>
        </div>
      </div>
    `;
  }
  updateFooterHash();

  appRoot.innerHTML = ''; 
  appRoot.appendChild(header);
  appRoot.appendChild(pageContainer);
  appRoot.appendChild(footer);

  Router.register('/passport', PassportPage);
  Router.register('/fisherman', FishermanPage);
  Router.register('/checkpoint', CheckpointPage);
  Router.register('/admin', AdminPage);
  Router.register('/idx-control', IdxControlPage);

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  });

  const mobileToggle = document.getElementById('mobile-toggle-btn');
  const navLinks = document.getElementById('main-nav-links');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      mobileToggle.classList.toggle('active');
    });
  }

  const authBtn = document.getElementById('nav-auth-btn');
  function updateAuthBtn() {
    const user = Session.currentUser;
    if (user) {
      authBtn.textContent = 'Выйти (' + user.vessel.split('-')[0] + ')';
      authBtn.onclick = () => {
        Auth.logout();
        updateAuthBtn();
        Router.navigate('/passport');
      };
    } else {
      authBtn.textContent = 'Вход';
      authBtn.onclick = () => {
        Router.navigate('/fisherman');
      };
    }
  }
  
  const originalNavigate = Router.navigate;
  Router.navigate = function(path, pushState) {
    originalNavigate.call(Router, path, pushState);
    updateAuthBtn();
    updateFooterHash();
  };

  const originalRender = Router.render;
  Router.render = function(path) {
    originalRender.call(Router, path);
    updateAuthBtn();
    updateFooterHash();
  };

  await DB.init();

  Router.init();
  updateAuthBtn();

  const ledger = OcuChain.getChain();
  if (ledger.length === 0) {
    DB.catches.forEach(c => {
      OcuChain.addEntry(c);
    });
    updateFooterHash();
  }

  const loader = document.getElementById('loading-screen');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 400);
  }
});
