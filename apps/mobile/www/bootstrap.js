(function () {
  var STORAGE_KEY = 'financer.tenantHost';

  var form = document.getElementById('tenant-form');
  var input = document.getElementById('tenant-host');
  var errorEl = document.getElementById('tenant-error');
  var loadingEl = document.getElementById('loading');

  function normalizeHost(value) {
    var trimmed = (value || '').trim();
    trimmed = trimmed.replace(/^https?:\/\//i, '');
    trimmed = trimmed.replace(/\/.*$/, '');
    return trimmed;
  }

  function redirectTo(host) {
    form.hidden = true;
    loadingEl.hidden = false;
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
