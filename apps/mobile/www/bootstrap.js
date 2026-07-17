(function () {
  var STORAGE_KEY = 'financer.tenantHost';

  var form = document.getElementById('tenant-form');
  var input = document.getElementById('tenant-host');
  var errorEl = document.getElementById('tenant-error');
  var loadingEl = document.getElementById('loading');

  // The native splash screen is configured with launchAutoHide: false, so it stays
  // visible until something explicitly hides it. If we're about to redirect straight
  // to the real app, leave it up (the destination page hides it once auth is resolved)
  // to avoid a flash of this bootstrap page. If we're showing the tenant form instead,
  // hide it now so the user can actually see and use the form.
  function hideSplash() {
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen) {
        window.Capacitor.Plugins.SplashScreen.hide();
      }
    } catch (e) {
      // Not running inside Capacitor (e.g. opened directly in a browser) — ignore.
    }
  }

  function normalizeHost(value) {
    var trimmed = (value || '').trim();
    trimmed = trimmed.replace(/^https?:\/\//i, '');
    trimmed = trimmed.replace(/\/.*$/, '');
    return trimmed;
  }

  function redirectTo(host) {
    form.hidden = true;
    loadingEl.hidden = false;
    // Safety net: if the redirect never completes (e.g. no network), don't leave
    // the user staring at the native splash screen forever.
    setTimeout(hideSplash, 4000);
    window.location.href = 'https://' + host;
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  var savedHost = null;
  try {
    savedHost = window.localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    savedHost = null;
  }

  if (savedHost) {
    redirectTo(savedHost);
    return;
  }

  hideSplash();

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    errorEl.hidden = true;

    var host = normalizeHost(input.value);

    if (!host) {
      showError('Bitte gib deine Financer-Adresse ein.');
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, host);
    } catch (e) {
      // localStorage nicht verfügbar, redirect trotzdem versuchen
    }

    redirectTo(host);
  });
})();
