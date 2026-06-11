const Router = {
  routes: {},
  currentPath: null,

  register(path, handler) {
    this.routes[path] = handler;
  },

  navigate(path, pushState = true) {
    const clean = path.startsWith('/') ? path : '/' + path;
    if (pushState && this.currentPath !== clean) {
      history.pushState({ path: clean }, '', clean);
    }
    this.render(clean);
  },

  render(path) {
    const route = this.routes[path] || this.routes['/passport'];
    if (!route) return;
    this.currentPath = path;
    document.getElementById('page-container').innerHTML = '';
    document.getElementById('page-container').appendChild(route());
    this._updateNav(path);
    window.scrollTo(0, 0);
  },

  _updateNav(path) {
    document.querySelectorAll('.header-nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-route') === path);
    });
  },

  init() {
    window.addEventListener('popstate', e => {
      const path = e.state?.path || window.location.pathname;
      this.render(path);
    });

    document.addEventListener('click', e => {
      const a = e.target.closest('[data-route]');
      if (a) {
        e.preventDefault();
        this.navigate(a.getAttribute('data-route'));
      }
    });

    const initial = window.location.pathname || '/passport';
    this.render(initial === '/' ? '/passport' : initial);
  }
};
