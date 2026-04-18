export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.PEXELS_KEY;
  if (!key) return res.status(500).json({ error: 'Pexels key not configured' });

  const query = req.query.q || 'abstract background';
  const orientation = req.query.orientation || 'square'; // square | portrait

  try {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=${orientation}&size=large`,
      { headers: { Authorization: key } }
    );
    if (!r.ok) return res.status(502).json({ error: 'Pexels error' });
    const data = await r.json();
    const photos = data.photos || [];
    if (!photos.length) return res.status(200).json({ url: null });

    // Acak dari 5 foto teratas supaya tiap generate beda
    const pick = photos[Math.floor(Math.random() * Math.min(5, photos.length))];
    return res.status(200).json({
      url: pick.src.large2x || pick.src.large,
      photographer: pick.photographer,
      photographer_url: pick.photographer_url,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
