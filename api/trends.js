let cache = null;
let cacheTime = 0;
const CACHE_TTL = 20 * 60 * 1000;

// Sumber berita Indonesia
const SOURCES = [
  { name: 'Detik',    url: 'https://rss.detik.com/index.php/detik_news' },
  { name: 'Tempo',    url: 'https://rss.tempo.co/' },
  { name: 'CNBC',     url: 'https://www.cnbcindonesia.com/rss' },
  { name: 'Kompas',   url: 'https://rss.kompas.com/' },
  { name: 'Liputan6', url: 'https://www.liputan6.com/rss' },
  { name: 'Tribun',   url: 'https://www.tribunnews.com/rss' },
  { name: 'Okezone',  url: 'https://sindikasi.okezone.com/index.php/rss/0/XML' },
  { name: 'Republika',url: 'https://www.republika.co.id/rss' },
];

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; KarangBot/1.0)' };

function parseRSS(xml, source) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < 6) {
    const chunk = m[1];
    const titleM =
      chunk.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
      chunk.match(/<title>([\s\S]*?)<\/title>/);
    if (!titleM) continue;
    const title = titleM[1].trim()
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
      .replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/<[^>]+>/g,'');
    if (title.length < 12 || title.toLowerCase().startsWith('http')) continue;
    items.push({ title, source });
  }
  return items;
}

async function fetchSource({ name, url }) {
  try {
    const r = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return [];
    return parseRSS(await r.text(), name);
  } catch { return []; }
}

async function fetchGoogleNews(query) {
  const q = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${q}&hl=id&gl=ID&ceid=ID:id`;
  try {
    const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    return parseRSS(await r.text(), 'Google');
  } catch { return []; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const query = req.query?.q || req.url?.split('?q=')[1] || '';

  // Mode search: pakai Google News RSS
  if (query) {
    const items = await fetchGoogleNews(decodeURIComponent(query));
    return res.status(200).json({ items, query });
  }

  // Mode default: semua sumber, dari cache
  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    return res.status(200).json({ items: cache, cached: true });
  }

  const raw = (await Promise.all(SOURCES.map(fetchSource))).flat();

  // Dedupe
  const seen = new Set();
  const items = raw.filter(i => {
    if (seen.has(i.title)) return false;
    seen.add(i.title); return true;
  }).slice(0, 24);

  cache = items;
  cacheTime = Date.now();
  res.status(200).json({ items });
}
