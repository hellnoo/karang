export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.PEXELS_KEY;
  if (!key) return res.status(500).json({ error: 'Pexels key not configured' });

  const query = req.query.q || 'abstract background';
  const orientation = req.query.orientation || 'square';

  // Fallback chain: query penuh → kata pertama → generic
  const words = query.trim().split(/\s+/);
  const candidates = [
    query,
    words.slice(0, 2).join(' '),
    words[0],
    'professional abstract background',
  ].filter((v, i, a) => a.indexOf(v) === i); // dedupe

  async function search(q) {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=8&orientation=${orientation}&size=large`,
      { headers: { Authorization: key } }
    );
    if (!r.ok) return [];
    const data = await r.json();
    return data.photos || [];
  }

  try {
    let photos = [];
    for (const q of candidates) {
      photos = await search(q);
      if (photos.length) break;
    }

    if (!photos.length) return res.status(200).json({ url: null });

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
