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

// User profile
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

// Audio features for up to 100 track IDs
function getAudioFeatures(trackIds) {
  if (!trackIds || trackIds.length === 0) return Promise.resolve({ audio_features: [] });
  return spotifyFetch('/audio-features', { ids: trackIds.slice(0, 100).join(',') });
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
