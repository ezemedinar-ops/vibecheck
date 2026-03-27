// ===========================
// VIBECHECK — Dashboard Logic
// ===========================

(async function init() {
  if (!isLoggedIn()) {
    window.location.href = '/index.html';
    return;
  }

  setupThemeToggle();

  try {
    // Fetch all data in parallel
    const [profile, topTracksData, topArtistsData, recentData] = await Promise.all([
      getUserProfile(),
      getTopTracks('medium_term', 50),
      getTopArtists('medium_term', 50),
      getRecentlyPlayed(50),
    ]);

    const topTracks = topTracksData.items || [];
    const topArtists = topArtistsData.items || [];
    const recentItems = recentData.items || [];

    // Fetch audio features for top tracks (for Audio DNA + Mood)
    const trackIds = topTracks.map(t => t.id);
    const [audioFeaturesData, recentFeaturesData] = await Promise.all([
      getAudioFeatures(trackIds),
      getAudioFeatures(recentItems.map(i => i.track?.id).filter(Boolean)),
    ]);

    const audioFeatures = (audioFeaturesData.audio_features || []).filter(Boolean);
    const recentFeatures = (recentFeaturesData.audio_features || []).filter(Boolean);

    // Render user info
    renderUserInfo(profile);

    // Render all modules
    renderTrinity(topTracks.slice(0, 20), topArtists.slice(0, 20), topArtists);
    renderAudioDNA(audioFeatures);
    renderHipsterMeter(topArtists);
    renderMoodTracker(recentFeatures);
    renderReceipt(topTracks.slice(0, 15), profile);

    // Show dashboard, hide loading
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

  } catch (e) {
    console.error('Dashboard error:', e);
    document.getElementById('loading-text').textContent = 'Error loading data. Try again.';
    setTimeout(() => { window.location.href = '/index.html?error=load_failed'; }, 2500);
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
    const current = document.body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('vc_theme', next);
    updateToggleIcon(next);
    // Re-render chart with new theme colors
    if (window._dnaChart) renderChartTheme();
  });
}

function updateToggleIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  btn.textContent = theme === 'dark' ? '☀' : '◑';
  btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}


// ===========================
// User Info
// ===========================

function renderUserInfo(profile) {
  const nameEl = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');

  if (nameEl) nameEl.textContent = profile.display_name || profile.id;
  if (avatarEl && profile.images?.[0]?.url) {
    avatarEl.src = profile.images[0].url;
    avatarEl.alt = profile.display_name || 'User';
  } else if (avatarEl) {
    avatarEl.style.display = 'none';
  }
}


// ===========================
// Module 1 — The Holy Trinity
// ===========================

function renderTrinity(tracks, artists, allArtists) {
  const tracksList = document.getElementById('top-tracks-list');
  const artistsList = document.getElementById('top-artists-list');
  const genresList = document.getElementById('genres-list');

  tracks.forEach((track, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="item-rank">${String(i + 1).padStart(2, '0')}</span>
      ${track.album?.images?.[2]?.url
        ? `<img class="item-img" src="${track.album.images[2].url}" alt="${escHtml(track.name)}" loading="lazy">`
        : `<div class="item-img"></div>`
      }
      <div class="item-info">
        <div class="item-name">${escHtml(track.name)}</div>
        <div class="item-sub">${escHtml(track.artists?.[0]?.name || '')}</div>
      </div>
    `;
    tracksList.appendChild(li);
  });

  artists.forEach((artist, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="item-rank">${String(i + 1).padStart(2, '0')}</span>
      ${artist.images?.[2]?.url
        ? `<img class="item-img" src="${artist.images[2].url}" alt="${escHtml(artist.name)}" loading="lazy">`
        : `<div class="item-img"></div>`
      }
      <div class="item-info">
        <div class="item-name">${escHtml(artist.name)}</div>
        <div class="item-sub">${escHtml((artist.genres || []).slice(0, 2).join(', '))}</div>
      </div>
    `;
    artistsList.appendChild(li);
  });

  const genres = extractGenres(allArtists, 20);
  genres.forEach((genre, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="item-rank">${String(i + 1).padStart(2, '0')}</span>
      <div class="item-info">
        <div class="genre-tag">${escHtml(genre)}</div>
      </div>
    `;
    genresList.appendChild(li);
  });
}


// ===========================
// Module 2 — Audio DNA
// ===========================

function renderAudioDNA(features) {
  if (!features.length) {
    document.getElementById('dna-wrap').innerHTML = '<p style="color:var(--text-muted);font-size:.8rem">Not enough data.</p>';
    return;
  }

  const data = {
    danceability: avgProperty(features, 'danceability'),
    energy: avgProperty(features, 'energy'),
    valence: avgProperty(features, 'valence'),
    acousticness: avgProperty(features, 'acousticness'),
    instrumentalness: avgProperty(features, 'instrumentalness'),
    liveness: avgProperty(features, 'liveness'),
  };

  const isDark = document.body.getAttribute('data-theme') !== 'light';
  const accent = isDark ? '#CCFF00' : '#E63946';
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const textColor = isDark ? '#888888' : '#666666';

  const ctx = document.getElementById('dna-chart').getContext('2d');
  window._dnaChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['DANCE', 'ENERGY', 'MOOD', 'ACOUSTIC', 'INSTRUMENTAL', 'LIVE'],
      datasets: [{
        data: [
          data.danceability,
          data.energy,
          data.valence,
          data.acousticness,
          data.instrumentalness,
          data.liveness,
        ],
        backgroundColor: isDark ? 'rgba(204,255,0,0.12)' : 'rgba(230,57,70,0.1)',
        borderColor: accent,
        borderWidth: 2,
        pointBackgroundColor: accent,
        pointBorderColor: accent,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${Math.round(ctx.raw * 100)}%`,
          },
          backgroundColor: isDark ? '#222' : '#fff',
          bodyColor: isDark ? '#fff' : '#000',
          borderColor: accent,
          borderWidth: 1,
        },
      },
      scales: {
        r: {
          min: 0,
          max: 1,
          ticks: {
            display: false,
            stepSize: 0.25,
          },
          grid: { color: gridColor },
          angleLines: { color: gridColor },
          pointLabels: {
            color: textColor,
            font: { family: "'Space Grotesk', sans-serif", size: 10, weight: '700' },
          },
        },
      },
    },
  });
}

function renderChartTheme() {
  if (!window._dnaChart) return;
  const isDark = document.body.getAttribute('data-theme') !== 'light';
  const accent = isDark ? '#CCFF00' : '#E63946';
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const textColor = isDark ? '#888888' : '#666666';

  const chart = window._dnaChart;
  chart.data.datasets[0].borderColor = accent;
  chart.data.datasets[0].pointBackgroundColor = accent;
  chart.data.datasets[0].pointBorderColor = accent;
  chart.data.datasets[0].backgroundColor = isDark ? 'rgba(204,255,0,0.12)' : 'rgba(230,57,70,0.1)';
  chart.options.scales.r.grid.color = gridColor;
  chart.options.scales.r.angleLines.color = gridColor;
  chart.options.scales.r.pointLabels.color = textColor;
  chart.update();
}


// ===========================
// Module 3 — Hipster Meter
// ===========================

function renderHipsterMeter(artists) {
  const avgPop = avgProperty(artists, 'popularity');
  const score = Math.round(100 - avgPop);

  document.getElementById('hipster-value').textContent = score;
  document.getElementById('hipster-bar-fill').style.width = `${score}%`;

  const labels = [
    [85, 'True underground. You probably discovered them before they had a name.'],
    [70, 'Deep cuts only. Your playlists are research papers.'],
    [55, 'A healthy mix of niche and known. You know what you\'re doing.'],
    [40, 'Leaning mainstream, but with taste. The festival crowd respects you.'],
    [0,  'Pop purist. Every track is a certified bop. No shame.'],
  ];

  const desc = labels.find(([threshold]) => score >= threshold)?.[1] || labels[labels.length - 1][1];
  document.getElementById('hipster-desc').textContent = desc;
}


// ===========================
// Module 4 — Mood Tracker
// ===========================

function renderMoodTracker(features) {
  if (!features.length) {
    document.getElementById('mood-title').textContent = 'No data';
    return;
  }

  const valence = avgProperty(features, 'valence');
  const pct = Math.round(valence * 100);

  document.getElementById('mood-valence').textContent = `${pct}% valence`;
  document.getElementById('mood-bar-fill').style.width = `${pct}%`;

  const moods = [
    [0.80, '😄', 'Euphoric',    'Pure serotonin. Your recent listening is a dopamine cocktail.'],
    [0.65, '😊', 'Cheerful',   'Sun\'s out. Your music picks agree.'],
    [0.50, '😌', 'Balanced',   'Neither up nor down. A steady hum of feeling.'],
    [0.35, '😔', 'Pensive',    'Introspective mode. The melodies have weight.'],
    [0.00, '🌑', 'Melancholic','Deep in the feels. The kind of music you listen to at 2am.'],
  ];

  const [, emoji, label, desc] = moods.find(([threshold]) => valence >= threshold) || moods[moods.length - 1];

  document.getElementById('mood-emoji').textContent = emoji;
  document.getElementById('mood-title').textContent = label;
  document.getElementById('mood-desc').textContent = desc;
}


// ===========================
// Module 5 — The Receipt
// ===========================

function renderReceipt(tracks, profile) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  let totalMs = 0;
  const rows = tracks.map((t, i) => {
    const dur = t.duration_ms || 0;
    totalMs += dur;
    const name = t.name.length > 28 ? t.name.slice(0, 26) + '..' : t.name;
    return `<div class="receipt-row">
      <span class="receipt-track-name">${String(i + 1).padStart(2, '0')}. ${escHtml(name)}</span>
      <span class="receipt-duration">${formatDuration(dur)}</span>
    </div>`;
  }).join('');

  const totalMin = Math.floor(totalMs / 60000);

  document.getElementById('receipt-content').innerHTML = `
    <div class="receipt-header">
      <div class="receipt-store-name">VIBECHECK</div>
      <div class="receipt-tagline">YOUR MUSICAL RECEIPT</div>
      <div class="receipt-tagline">${dateStr} — ${timeStr}</div>
      <div class="receipt-tagline">CUSTOMER: ${escHtml((profile.display_name || profile.id || 'LISTENER').toUpperCase())}</div>
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
