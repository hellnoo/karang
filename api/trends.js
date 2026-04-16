// Cache sederhana di memory — reset tiap cold start Vercel (~30 menit)
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 20 * 60 * 1000; // 20 menit

const SOURCES = [
  { name: 'Detik', url: 'https://rss.detik.com/index.php/detik_news' },
  { name: 'Tempo',  url: 'https://rss.tempo.co/' },
  { name: 'CNBC',  url: 'https://www.cnbcindonesia.com/rss' },
];

function parseRSS(xml, source) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < 5) {
    const chunk = m[1];
    const titleM =
      chunk.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
      chunk.match(/<title>([\s\S]*?)<\/title>/);
    const catM =
      chunk.match(/<category><!\[CDATA\[([\s\S]*?)\]\]><\/category>/) ||
      chunk.match(/<category>([\s\S]*?)<\/category>/);
    if (!titleM) continue;
    const title = titleM[1].trim().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#039;/g,"'").replace(/&quot;/g,'"');
    if (title.length < 10) continue;
    items.push({
      title,
      source,
      category: catM ? catM[1].trim() : null,
    });
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Serve from cache
  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    return res.status(200).json({ items: cache, cached: true });
  }

  const results = [];
  await Promise.allSettled(
    SOURCES.map(async ({ name, url }) => {
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KarangBot/1.0)' },
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) return;
        const xml = await r.text();
        results.push(...parseRSS(xml, name));
      } catch { /* skip source jika gagal */ }
    })
  );

  // Dedupe & shuffle ringan
  const seen = new Set();
  const items = results
    .filter(i => { if (seen.has(i.title)) return false; seen.add(i.title); return true; })
    .slice(0, 12);

  cache = items;
  cacheTime = Date.now();

  res.status(200).json({ items });
}
