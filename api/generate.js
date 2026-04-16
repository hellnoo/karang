const MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.2-3b-instruct:free',
];

const SYSTEM = `Kamu adalah AI spesialis pembuatan konten media sosial yang sangat kreatif dan paham tren Indonesia.
Tugasmu: menghasilkan konten berkualitas tinggi yang engaging, natural, dan siap produksi.

PENTING: Selalu balas dalam format JSON yang valid. Tidak ada teks di luar JSON.`;

function buildPrompt(topic, platform, tone) {
  return `Buat konten ${platform} tentang: "${topic}"
Tone/gaya: ${tone}

Hasilkan JSON dengan struktur PERSIS seperti ini:
{
  "hooks": [
    "hook pertama yang kuat dan menarik",
    "hook kedua dengan angle berbeda",
    "hook ketiga dengan pendekatan unik",
    "hook keempat yang kontroversial atau surprising",
    "hook kelima yang personal atau relatable"
  ],
  "script": "Script lengkap untuk ${platform}:\\n\\n[HOOK]\\nTulis hook terpilih di sini\\n\\n[BODY]\\nIsi konten dengan 3-5 poin utama yang mengalir natural, sesuai gaya bicara creator Indonesia\\n\\n[CTA]\\nAjakan aksi yang spesifik dan tidak generik",
  "caption": "Caption siap posting dengan opening yang kuat, isi 2-3 paragraf pendek, dan closing yang engaging. Gunakan emoji secukupnya.",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3 (8-12 hashtag relevan campuran besar dan niche)",
  "visual_ideas": [
    "Ide shot/visual pertama yang konkret",
    "Ide B-roll atau transisi menarik",
    "Ide text overlay atau grafis",
    "Ide thumbnail atau cover image"
  ]
}

Pastikan:
- Hooks benar-benar kuat, spesifik, dan tidak klise
- Script natural seperti orang bicara, bukan robot
- Caption tidak terasa generated
- Sesuaikan panjang dan format dengan ${platform}
- Semua dalam Bahasa Indonesia`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.OPENROUTER_KEY;
  if (!key) return res.status(500).json({ error: 'OpenRouter API key belum dikonfigurasi' });

  const { topic, platform, tone } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'Topic wajib diisi' });

  const messages = [
    { role: 'user', content: buildPrompt(topic, platform || 'Instagram Reels', tone || 'Santai & relatable') }
  ];

  let lastError = 'Semua model gagal';

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
          temperature: 0.85,
          max_tokens: 2000,
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

      const raw = data.choices?.[0]?.message?.content || '';

      // Extract JSON — handle markdown code blocks
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // Try to extract just the JSON object
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          parsed = JSON.parse(raw.slice(start, end + 1));
        } else {
          throw new Error('Respons model bukan JSON valid');
        }
      }

      return res.status(200).json(parsed);
    } catch (err) {
      lastError = err.message;
      continue;
    }
  }

  res.status(500).json({ error: lastError });
}
