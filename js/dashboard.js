// ===========================
// VIBECHECK — Dashboard Logic v2
// ===========================

// In-memory store for all time ranges (pre-fetched on load)
const DATA = {
  short_term:  { tracks: [], artists: [] },
  medium_term: { tracks: [], artists: [] },
  long_term:   { tracks: [], artists: [] },
};

let currentTrackRange  = 'medium_term';
let currentArtistRange = 'medium_term';

(async function init() {
  if (!isLoggedIn()) {
    window.location.href = '/index.html';
    return;
  }

  setupThemeToggle();

  try {
    // Fetch critical data first
    const profile = await getUserProfile();

    // Fetch all ranges — each call is independent, failures return empty arrays
    const empty = { items: [] };
    const [
      shortTracks, shortArtists,
      mediumTracks, mediumArtists,
      longTracks, longArtists,
      recentData,
    ] = await Promise.all([
      getTopTracks('short_term',  50).catch(() => empty),
      getTopArtists('short_term', 50).catch(() => empty),
      getTopTracks('medium_term',  50).catch(() => empty),
      getTopArtists('medium_term', 50).catch(() => empty),
      getTopTracks('long_term',  50).catch(() => empty),
      getTopArtists('long_term', 50).catch(() => empty),
      getRecentlyPlayed(20).catch(() => empty),
    ]);

    DATA.short_term  = { tracks: shortTracks.items  || [], artists: shortArtists.items  || [] };
    DATA.medium_term = { tracks: mediumTracks.items || [], artists: mediumArtists.items || [] };
    DATA.long_term   = { tracks: longTracks.items   || [], artists: longArtists.items   || [] };

    renderProfileHero(profile);
    setupMiniTabs();
    renderTracks('medium_term');
    renderArtists('medium_term');
    renderHipsterMeter(DATA.medium_term.artists);
    renderListeningStats(DATA.medium_term.tracks, DATA.medium_term.artists);
    renderRecentlyPlayed(recentData.items || []);
    renderReceipt(DATA.medium_term.tracks.slice(0, 15));

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

  } catch (e) {
    console.error('Dashboard error:', e);
    // If profile fetch failed, token is likely expired/invalid — force re-login
    document.getElementById('loading-text').textContent = 'Session expired. Redirecting...';
    setTimeout(() => { logout(); }, 1500);
  }
})();


// ===========================
// Theme Toggle
// ===========================

function setupThemeToggle() {
  const saved = localStorage.getItem('vc_theme') || 'dark';
  document.body.setAttribute('data-theme', saved);
  updateToggleIcon(saved);

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('vc_theme', next);
    updateToggleIcon(next);
  });
}

function updateToggleIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  btn.textContent = theme === 'dark' ? '☀' : '◑';
  btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}


// ===========================
// Profile Hero
// ===========================

function renderProfileHero(profile) {
  const avatarEl = document.getElementById('profile-avatar');
  const nameEl   = document.getElementById('profile-name');
  const metaEl   = document.getElementById('profile-meta');
  const linkEl   = document.getElementById('profile-link');

  if (profile.images?.[0]?.url) {
    avatarEl.src = profile.images[0].url;
    avatarEl.alt = profile.display_name || 'User';
  } else {
    avatarEl.style.display = 'none';
  }

  const flag = countryToFlag(profile.country || '');
  nameEl.textContent = `${profile.display_name || profile.id} ${flag}`.trim();

  const parts = [];
  if (profile.followers?.total != null) parts.push(`${formatNumber(profile.followers.total)} followers`);
  if (profile.product === 'premium') parts.push('Premium');
  metaEl.textContent = parts.join(' · ');

  if (profile.external_urls?.spotify) {
    linkEl.href = profile.external_urls.spotify;
    linkEl.style.display = 'inline-flex';
  }

  // Also update small header avatar
  const headerAvatar = document.getElementById('user-avatar');
  const headerName   = document.getElementById('user-name');
  if (headerAvatar && profile.images?.[0]?.url) {
    headerAvatar.src = profile.images[0].url;
  } else if (headerAvatar) {
    headerAvatar.style.display = 'none';
  }
  if (headerName) headerName.textContent = profile.display_name || profile.id;
}


// ===========================
// Mini Tabs (independent per column)
// ===========================

function setupMiniTabs() {
  document.getElementById('track-tabs').querySelectorAll('.mini-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.range;
      if (range === currentTrackRange) return;
      currentTrackRange = range;
      document.getElementById('track-tabs').querySelectorAll('.mini-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTracks(range);
      renderListeningStats(DATA[range].tracks, DATA[currentArtistRange].artists);
      renderReceipt(DATA[range].tracks.slice(0, 15));
    });
  });

  document.getElementById('artist-tabs').querySelectorAll('.mini-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.range;
      if (range === currentArtistRange) return;
      currentArtistRange = range;
      document.getElementById('artist-tabs').querySelectorAll('.mini-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderArtists(range);
      renderHipsterMeter(DATA[range].artists);
      renderListeningStats(DATA[currentTrackRange].tracks, DATA[range].artists);
    });
  });
}


// ===========================
// Module 1 — Tracks & Artists
// ===========================

function renderTracks(range) {
  const list = document.getElementById('top-tracks-list');
  list.innerHTML = '';
  DATA[range].tracks.slice(0, 20).forEach((track, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="item-rank">${String(i + 1).padStart(2, '0')}</span>
      ${track.album?.images?.[2]?.url
        ? `<img class="item-img" src="${track.album.images[2].url}" alt="${escHtml(track.name)}" loading="lazy">`
        : `<div class="item-img"></div>`}
      <div class="item-info">
        <div class="item-name">${escHtml(track.name)}</div>
        <div class="item-sub">${escHtml(track.artists?.[0]?.name || '')}</div>
      </div>
    `;
    list.appendChild(li);
  });
}

function renderArtists(range) {
  const list = document.getElementById('top-artists-list');
  list.innerHTML = '';
  DATA[range].artists.slice(0, 20).forEach((artist, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="item-rank">${String(i + 1).padStart(2, '0')}</span>
      ${artist.images?.[2]?.url
        ? `<img class="item-img" src="${artist.images[2].url}" alt="${escHtml(artist.name)}" loading="lazy">`
        : `<div class="item-img"></div>`}
      <div class="item-info">
        <div class="item-name">${escHtml(artist.name)}</div>
        <div class="item-sub">${escHtml((artist.genres || []).slice(0, 2).join(', '))}</div>
      </div>
    `;
    list.appendChild(li);
  });
}


// ===========================
// Module 2 — Hipster Meter
// ===========================

function renderHipsterMeter(artists) {
  if (!artists.length) return;
  const avgPop = avgProperty(artists, 'popularity');
  const score  = Math.round(100 - avgPop);

  document.getElementById('hipster-value').textContent = score;
  document.getElementById('hipster-bar-fill').style.width = `${score}%`;

  const labels = [
    [85, 'True underground. You probably discovered them before they had a name.'],
    [70, 'Deep cuts only. Your playlists are research papers.'],
    [55, 'A healthy mix of niche and known. You know what you\'re doing.'],
    [40, 'Leaning mainstream, but with taste. The festival crowd respects you.'],
    [0,  'Pop purist. Every track is a certified bop. No shame.'],
  ];
  const desc = labels.find(([t]) => score >= t)?.[1] || labels[labels.length - 1][1];
  document.getElementById('hipster-desc').textContent = desc;
}


// ===========================
// Module 3 — Listening Stats
// ===========================

function renderListeningStats(tracks, artists) {
  const container = document.getElementById('stats-grid');
  container.innerHTML = '';

  const stats = [];

  // Unique artists in top tracks
  const uniqueArtistIds = new Set(tracks.flatMap(t => (t.artists || []).map(a => a.id)));
  stats.push({ label: 'Unique Artists', value: uniqueArtistIds.size, sub: 'in your top 50 tracks' });

  // Total playtime
  const totalMs = tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
  const totalMin = Math.round(totalMs / 60000);
  stats.push({ label: 'Total Playtime', value: `${totalMin}`, sub: 'minutes of top 50' });

  // Genre diversity
  const allGenres = new Set(artists.flatMap(a => a.genres || []));
  stats.push({ label: 'Genre Diversity', value: allGenres.size, sub: 'unique genres in top artists' });

  // Most mainstream track
  const byPop = [...tracks].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  if (byPop[0]) {
    stats.push({
      label: 'Most Mainstream',
      value: byPop[0].popularity,
      sub: escHtml(byPop[0].name),
      accent: true,
    });
  }

  // Most underground track
  const underground = byPop[byPop.length - 1];
  if (underground && underground !== byPop[0]) {
    stats.push({
      label: 'Most Underground',
      value: underground.popularity,
      sub: escHtml(underground.name),
    });
  }

  // Top artist followers
  if (artists[0]) {
    stats.push({
      label: '#1 Artist Fans',
      value: formatNumber(artists[0].followers?.total || 0),
      sub: escHtml(artists[0].name),
    });
  }

  stats.forEach(s => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-label">${s.label}</div>
      <div class="stat-value${s.accent ? ' accent' : ''}">${s.value}</div>
      <div class="stat-sub">${s.sub}</div>
    `;
    container.appendChild(card);
  });
}


// ===========================
// Module 4 — Recently Played
// ===========================

function renderRecentlyPlayed(items) {
  const list = document.getElementById('recently-played-list');
  if (!items.length) {
    list.innerHTML = '<li><div class="item-info"><div class="item-sub" style="font-style:italic">No recent listening data available.</div></div></li>';
    return;
  }

  // Deduplicate by track ID (Spotify can return the same song multiple times)
  const seen = new Set();
  const unique = items.filter(item => {
    if (!item.track?.id || seen.has(item.track.id)) return false;
    seen.add(item.track.id);
    return true;
  }).slice(0, 10);

  unique.forEach(item => {
    const track = item.track;
    const li = document.createElement('li');
    li.innerHTML = `
      ${track.album?.images?.[2]?.url
        ? `<img class="item-img" src="${track.album.images[2].url}" alt="${escHtml(track.name)}" loading="lazy">`
        : `<div class="item-img"></div>`}
      <div class="item-info">
        <div class="item-name">${escHtml(track.name)}</div>
        <div class="item-sub">${escHtml(track.artists?.[0]?.name || '')}</div>
      </div>
      <div class="recent-time">${timeAgo(item.played_at)}</div>
    `;
    list.appendChild(li);
  });
}


// ===========================
// Module 5 — The Receipt
// ===========================

function renderReceipt(tracks) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const rangeLabels = { short_term: '4 WEEKS', medium_term: '6 MONTHS', long_term: 'ALL TIME' };

  let totalMs = 0;
  const rows = tracks.map((t, i) => {
    totalMs += t.duration_ms || 0;
    const name = t.name.length > 28 ? t.name.slice(0, 26) + '..' : t.name;
    return `<div class="receipt-row">
      <span class="receipt-track-name">${String(i + 1).padStart(2, '0')}. ${escHtml(name)}</span>
      <span class="receipt-duration">${formatDuration(t.duration_ms || 0)}</span>
    </div>`;
  }).join('');

  const totalMin = Math.floor(totalMs / 60000);

  document.getElementById('receipt-content').innerHTML = `
    <div class="receipt-header">
      <div class="receipt-store-name">VIBECHECK</div>
      <div class="receipt-tagline">YOUR MUSICAL RECEIPT</div>
      <div class="receipt-tagline">${dateStr} — ${timeStr}</div>
      <div class="receipt-tagline">PERIOD: ${rangeLabels[currentRange]}</div>
    </div>
    <hr class="receipt-divider">
    <div class="receipt-row" style="font-size:.65rem;color:var(--text-muted)">
      <span>TRACK</span><span>DURATION</span>
    </div>
    <hr class="receipt-divider">
    ${rows}
    <hr class="receipt-divider">
    <div class="receipt-row">
      <span>TOTAL TIME</span>
      <span>${totalMin} MIN</span>
    </div>
    <div class="receipt-footer">
      <div>THANK YOU FOR YOUR TASTE</div>
      <div style="margin-top:.5rem">★ ★ ★ ★ ★</div>
      <div style="margin-top:.25rem">vibecheck.app</div>
    </div>
  `;
}


// ===========================
// Utility
// ===========================

function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
