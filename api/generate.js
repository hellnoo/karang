const MODELS = [
  'openai/gpt-4o-mini',
  'google/gemini-2.0-flash-001',
  'anthropic/claude-3-haiku',
  'deepseek/deepseek-chat-v3-0324',
  'meta-llama/llama-3.3-70b-instruct',
];

const SYSTEM = `Kamu adalah AI spesialis pembuatan konten slide media sosial untuk kreator Indonesia.
Tugas: buat konten slide carousel yang engaging, natural, dan siap produksi.
PENTING: Balas HANYA dengan JSON valid. Tidak ada teks di luar JSON.`;

function buildPrompt(topic, platform, tone, format, trendContext) {
  const isVertical = format === '9:16';

  if (trendContext) {
    // Mode kronologi berita
    return `Buat konten slide carousel KRONOLOGI BERITA untuk ${platform}.
Topik kreator: "${topic}"
Berita yang dipilih: "${trendContext}"
Tone: ${tone}
Format: ${isVertical ? 'Vertikal 9:16' : 'Square 1:1'}

Susun sebagai KRONOLOGI — ceritakan berita ini slide per slide secara berurutan dan mendalam.
Jumlah slide: 8-10 slide.

Hasilkan JSON:
{
  "slides": [
    {"num":1,"type":"hook","headline":"Hook mengejutkan dari berita ini (max 10 kata)","body":"Subtext yang bikin penasaran (max 12 kata)"},
    {"num":2,"type":"body","headline":"Latar belakang / Siapa yang terlibat","body":"2-3 kalimat konteks penting sebelum kejadian"},
    {"num":3,"type":"body","headline":"Awal kejadian / Kapan & di mana","body":"2-3 kalimat kronologi awal"},
    {"num":4,"type":"body","headline":"Perkembangan 1 — apa yang terjadi selanjutnya","body":"2-3 kalimat detail perkembangan"},
    {"num":5,"type":"body","headline":"Perkembangan 2 — titik kritis / fakta mengejutkan","body":"2-3 kalimat fakta paling penting"},
    {"num":6,"type":"body","headline":"Respons / Reaksi pihak terkait","body":"2-3 kalimat siapa bilang apa"},
    {"num":7,"type":"body","headline":"Dampak / Apa artinya untuk kita","body":"2-3 kalimat relevansi ke pembaca"},
    {"num":8,"type":"cta","headline":"Pendapat kamu tentang ini?","body":"Ajak diskusi: komen pendapat, share ke teman, ikuti perkembangannya"}
  ],
  "caption": "Caption berita yang engaging, 2-3 paragraf, emoji secukupnya, opening kuat",
  "hashtags": "8-12 hashtag relevan campuran trending dan niche"
}

Pastikan:
- Tiap slide melanjutkan cerita slide sebelumnya — terasa seperti membaca artikel yang dipotong
- Fakta konkret, bukan generik
- Tone: ${tone}
- Semua Bahasa Indonesia`;
  }

  // Mode konten biasa
  return `Buat konten slide carousel ${platform} tentang: "${topic}"
Tone: ${tone}
Format: ${isVertical ? 'Vertikal 9:16 (Reels/TikTok/Stories)' : 'Square 1:1 (IG Feed/LinkedIn)'}

Hasilkan JSON (jumlah slide 7-9 sesuai kedalaman konten):
{
  "slides": [
    {"num":1,"type":"hook","headline":"Hook sangat kuat, spesifik, bikin berhenti scroll (max 10 kata)","body":"Subtext memperkuat rasa penasaran (max 12 kata)"},
    {"num":2,"type":"body","headline":"Poin utama 1 (max 7 kata)","body":"2-3 kalimat konkret dan berisi"},
    {"num":3,"type":"body","headline":"Poin utama 2 (max 7 kata)","body":"2-3 kalimat konkret"},
    {"num":4,"type":"body","headline":"Poin utama 3 (max 7 kata)","body":"2-3 kalimat konkret"},
    {"num":5,"type":"body","headline":"Poin utama 4 (max 7 kata)","body":"2-3 kalimat konkret"},
    {"num":6,"type":"body","headline":"Poin utama 5 — insight mendalam (max 7 kata)","body":"2-3 kalimat yang paling valuable"},
    {"num":7,"type":"body","headline":"Kesalahan umum / Mitos yang perlu diluruskan","body":"2-3 kalimat yang surprising dan relatable"},
    {"num":8,"type":"cta","headline":"Ajakan aksi spesifik (max 8 kata)","body":"Instruksi konkret: save, komen, follow, DM"}
  ],
  "caption": "Caption siap posting, opening kuat, 2-3 paragraf pendek, emoji secukupnya",
  "hashtags": "8-12 hashtag campuran besar dan niche"
}

Pastikan:
- Slide 1 hook SANGAT kuat dan spesifik
- Tiap body slide memberikan value sendiri
- Tone konsisten: ${tone}
- Semua Bahasa Indonesia`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.OPENROUTER_KEY;
  if (!key) return res.status(500).json({ error: 'OpenRouter API key belum dikonfigurasi' });

  const { topic, platform, tone, format, trendContext } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'Topic wajib diisi' });

  const messages = [
    { role: 'user', content: buildPrompt(topic, platform || 'Instagram', tone || 'Santai', format || '1:1', trendContext) }
  ];

  let lastError = 'Semua model gagal';
  const errors = [];

  for (const model of MODELS) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://karang.vercel.app',
          'X-Title': 'Karang AI Content Studio',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: SYSTEM }, ...messages],
          temperature: 0.8,
          max_tokens: 2500,
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

      const raw = data.choices?.[0]?.message?.content || '';
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          parsed = JSON.parse(raw.slice(start, end + 1));
        } else {
          throw new Error('Respons bukan JSON valid');
        }
      }

      return res.status(200).json(parsed);
    } catch (err) {
      errors.push(`${model.split('/')[1]}: ${err.message}`);
      lastError = err.message;
      continue;
    }
  }

  // Semua model gagal — kasih info yang berguna
  const isOverload = errors.every(e => e.includes('Provider returned error') || e.includes('overloaded') || e.includes('unavailable'));
  const msg = isOverload
    ? 'Model AI sedang overloaded. Tunggu 10-30 detik lalu coba lagi.'
    : `Gagal di semua model. Error terakhir: ${lastError}`;

  res.status(500).json({ error: msg, detail: errors });
}
