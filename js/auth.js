// ===========================
// VIBECHECK — Auth (Authorization Code Flow)
// ===========================

function generateState() {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function login() {
  const state = generateState();
  sessionStorage.setItem('spotify_auth_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    redirect_uri: CONFIG.REDIRECT_URI,
    state: state,
  });

  window.location.href = `${CONFIG.AUTH_ENDPOINT}?${params.toString()}`;
}

async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  const state = params.get('state');
  const storedState = sessionStorage.getItem('spotify_auth_state');

  if (error) {
    window.location.href = `/index.html?error=${encodeURIComponent(error)}`;
    return;
  }

  if (!code || !state || state !== storedState) {
    window.location.href = '/index.html?error=state_mismatch';
    return;
  }

  sessionStorage.removeItem('spotify_auth_state');

  try {
    const response = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: CONFIG.REDIRECT_URI }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Token exchange failed');
    }

    const data = await response.json();
    _storeTokens(data);
    window.location.href = '/dashboard.html';
  } catch (e) {
    window.location.href = `/index.html?error=${encodeURIComponent(e.message)}`;
  }
}

function _storeTokens(data) {
  localStorage.setItem('vc_access_token', data.access_token);
  localStorage.setItem('vc_token_expiry', Date.now() + data.expires_in * 1000);
  if (data.refresh_token) {
    localStorage.setItem('vc_refresh_token', data.refresh_token);
  }
}

async function getAccessToken() {
  const token = localStorage.getItem('vc_access_token');
  const expiry = parseInt(localStorage.getItem('vc_token_expiry') || '0', 10);

  if (!token) return null;

  // Refresh si vence en menos de 60 segundos
  if (Date.now() > expiry - 60_000) {
    return await _refreshToken();
  }

  return token;
}

async function _refreshToken() {
  const refresh_token = localStorage.getItem('vc_refresh_token');
  if (!refresh_token) {
    logout();
    return null;
  }

  try {
    const response = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });

    if (!response.ok) throw new Error('Refresh failed');

    const data = await response.json();
    _storeTokens(data);
    return data.access_token;
  } catch {
    logout();
    return null;
  }
}

function logout() {
  localStorage.removeItem('vc_access_token');
  localStorage.removeItem('vc_refresh_token');
  localStorage.removeItem('vc_token_expiry');
  window.location.href = '/index.html';
}

function isLoggedIn() {
  return !!localStorage.getItem('vc_access_token');
}
