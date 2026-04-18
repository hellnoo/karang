// Kamus kata kunci Indonesia → English untuk Pexels search
const ID_TO_EN = {
  // Alam & outdoor
  pendaki:'mountain hiking', mendaki:'mountain hiking', gunung:'mountain landscape',
  alam:'nature landscape', hutan:'forest nature', pantai:'beach ocean waves',
  laut:'ocean sea', sungai:'river nature', bunga:'flower garden',
  // Bisnis & keuangan
  bisnis:'business professional', usaha:'entrepreneur business', umkm:'small business shop',
  uang:'money finance', menabung:'saving money piggy bank', keuangan:'finance investment',
  investasi:'investment finance growth', modal:'business capital', untung:'profit business',
  jualan:'selling market retail', toko:'shop retail store', pelanggan:'customer service',
  // Makanan & minuman
  kopi:'coffee cafe barista', makanan:'food restaurant plate', kuliner:'food culinary dish',
  minuman:'beverage drink glass', resep:'cooking kitchen food', bakery:'bakery bread pastry',
  restoran:'restaurant dining', warung:'small restaurant food',
  // Psikologi & motivasi
  emosi:'emotion psychology mindfulness', mental:'mental health wellness calm',
  motivasi:'motivation inspiration success', semangat:'motivation energy sport',
  produktif:'productivity workspace desk', fokus:'focus concentration study',
  stres:'stress anxiety calm', bahagia:'happy smile joy',
  // Media sosial & konten
  fomo:'social media smartphone lifestyle', konten:'content creator social media',
  viral:'social media trend digital', influencer:'social media lifestyle',
  media:'social media digital phone', instagram:'social media lifestyle photography',
  // Fashion & gaya hidup
  fashion:'fashion style clothing', baju:'clothing fashion style', outfit:'fashion outfit style',
  traveling:'travel adventure landscape', wisata:'travel tourism destination',
  olahraga:'sport fitness workout', gym:'gym fitness workout',
  // Teknologi
  teknologi:'technology digital innovation', digital:'digital technology modern',
  startup:'startup technology office', aplikasi:'smartphone app technology',
  coding:'programming code laptop', website:'web design technology',
  // Pendidikan
  belajar:'studying education books', edukasi:'education learning school',
  pelatihan:'training workshop professional', seminar:'conference presentation business',
};

function extractEnglishQuery(topic) {
  const lower = topic.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  // Coba cari exact word match dulu
  for (const [id, en] of Object.entries(ID_TO_EN)) {
    const regex = new RegExp(`\\b${id}\\b`);
    if (regex.test(lower)) return en;
  }
  // Coba partial match
  for (const [id, en] of Object.entries(ID_TO_EN)) {
    if (lower.includes(id)) return en;
  }
  // Hapus stop words, kembalikan sisanya
  const stop = new Set(['yang','dan','di','ke','dari','untuk','dengan','adalah','ini','itu',
    'ada','bisa','akan','juga','sudah','belum','tidak','bagi','para','saat','cara',
    'tips','buat','agar','bagaimana','tentang','soal','gimana','kenapa','apa','siapa']);
  const cleaned = lower.split(/\s+/).filter(w => w && !stop.has(w)).join(' ');
  return cleaned || topic;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.PEXELS_KEY;
  if (!key) return res.status(500).json({ error: 'Pexels key not configured' });

  const query = req.query.q || 'abstract background';
  const orientation = req.query.orientation || 'square';
  const enQuery = extractEnglishQuery(query);

  // Fallback chain: terjemahan → query asli → kata pertama → generic
  const candidates = [enQuery, query, query.split(' ')[0], 'professional abstract background']
    .filter((v, i, a) => v && a.indexOf(v) === i);

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
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
