// ===========================
// VIBECHECK — Vercel Function: /api/token
// Intercambia authorization code por access_token + refresh_token
// Variables de entorno requeridas:
//   SPOTIFY_CLIENT_ID
//   SPOTIFY_CLIENT_SECRET
// ===========================

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, redirect_uri } = req.body || {};

  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'Missing required parameters: code, redirect_uri' });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
      }).toString(),
    });

    const data = await spotifyRes.json();

    if (!spotifyRes.ok) {
      return res.status(spotifyRes.status).json({
        error: data.error_description || data.error || 'Token exchange failed',
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Token exchange error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
