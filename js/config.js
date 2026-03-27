// ===========================
// VIBECHECK — Spotify Config
// ===========================
// 1. Set your CLIENT_ID (visible en Spotify Developer Dashboard)
// 2. Set your REDIRECT_URI (debe coincidir exactamente con la URI registrada en Spotify)
// 3. El CLIENT_SECRET va como variable de entorno en Vercel: SPOTIFY_CLIENT_SECRET

const CONFIG = {
  CLIENT_ID: 'TU_CLIENT_ID_AQUI',

  // Para producción (Vercel/Netlify):
  REDIRECT_URI: 'https://vibecheck-blue.vercel.app/callback.html',

  // Para desarrollo local, comentá la línea de arriba y descomentá esta:
  // REDIRECT_URI: 'http://localhost:3000/callback.html',

  SCOPES: 'user-top-read user-read-recently-played',
  AUTH_ENDPOINT: 'https://accounts.spotify.com/authorize',
};
