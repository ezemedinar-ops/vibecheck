// ===========================
// VIBECHECK — Spotify API Wrapper
// ===========================

const API_BASE = 'https://api.spotify.com/v1';

async function spotifyFetch(endpoint, params = {}) {
  const token = await getAccessToken();
  if (!token) {
    logout();
    throw new Error('No access token available');
  }

  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`Spotify API error ${res.status}`);
  }

  return res.json();
}

// User profile (requires user-read-private for country + product)
function getUserProfile() {
  return spotifyFetch('/me');
}

// Top tracks — time_range: short_term | medium_term | long_term
function getTopTracks(time_range = 'medium_term', limit = 50) {
  return spotifyFetch('/me/top/tracks', { time_range, limit });
}

// Top artists
function getTopArtists(time_range = 'medium_term', limit = 50) {
  return spotifyFetch('/me/top/artists', { time_range, limit });
}

// Recently played
function getRecentlyPlayed(limit = 50) {
  return spotifyFetch('/me/player/recently-played', { limit });
}

// Aggregate genres from top artists (weighted by rank)
function extractGenres(artists, topN = 10) {
  const counts = {};
  artists.forEach((artist, i) => {
    const weight = artists.length - i; // higher rank = higher weight
    (artist.genres || []).forEach(g => {
      counts[g] = (counts[g] || 0) + weight;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);
}

// Format ms to m:ss
function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// Average a numeric property from an array of objects
function avgProperty(arr, key) {
  const valid = arr.filter(x => x && typeof x[key] === 'number');
  if (!valid.length) return 0;
  return valid.reduce((sum, x) => sum + x[key], 0) / valid.length;
}

// Convert ISO country code to flag emoji ("AR" → "🇦🇷")
function countryToFlag(code) {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, char =>
    String.fromCodePoint(127397 + char.charCodeAt(0))
  );
}

// Human-readable "time ago"
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format large numbers: 1200000 → "1.2M", 45000 → "45K"
function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
