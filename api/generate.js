const MODELS = [
  'deepseek/deepseek-chat-v3-0324:free',
  'google/gemma-3-27b-it:free',
  'openai/gpt-oss-20b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-8b:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'meta-llama/llama-3.2-3b-instruct:free',
];

const SYSTEM = `Kamu adalah AI spesialis pembuatan konten slide media sosial untuk kreator Indonesia.
Tugas: buat konten slide carousel yang engaging, natural, dan siap produksi.
PENTING: Balas HANYA dengan JSON valid. Tidak ada teks di luar JSON.`;

function buildPrompt(topic, platform, tone, format) {
  const isVertical = format === '9:16';
  return `Buat konten slide carousel ${platform} tentang: "${topic}"
Tone: ${tone}
Format: ${isVertical ? 'Vertikal 9:16 (Reels/TikTok/Stories)' : 'Square 1:1 (IG Feed/LinkedIn)'}

Hasilkan JSON persis seperti ini (jumlah slide fleksibel 4-7 sesuai konten):
{
  "slides": [
    {
      "num": 1,
      "type": "hook",
      "headline": "Hook yang sangat kuat, bikin orang berhenti scroll (max 10 kata)",
      "body": "Subtext pendek yang memperkuat rasa penasaran (max 12 kata)"
    },
    {
      "num": 2,
      "type": "body",
      "headline": "Poin utama 1, singkat dan kuat (max 7 kata)",
      "body": "Penjelasan 2-3 kalimat yang konkret, bukan klise"
    },
    {
      "num": 3,
      "type": "body",
      "headline": "Poin utama 2 (max 7 kata)",
      "body": "Penjelasan 2-3 kalimat"
    },
    {
      "num": 4,
      "type": "body",
      "headline": "Poin utama 3 (max 7 kata)",
      "body": "Penjelasan 2-3 kalimat"
    },
    {
      "num": 5,
      "type": "cta",
      "headline": "Ajakan aksi spesifik (max 8 kata)",
      "body": "Instruksi konkret: save, komen, follow, DM — pilih yang paling relevan"
    }
  ],
  "caption": "Caption siap posting dengan opening kuat, 2-3 paragraf pendek, emoji secukupnya",
  "hashtags": "#hashtag1 #hashtag2 (8-12 hashtag campuran besar dan niche)"
}

Pastikan:
- Slide 1 hook SANGAT kuat dan spesifik, tidak generik
- Tiap body slide berdiri sendiri — orang paham meski baca satu slide saja
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

  const { topic, platform, tone, format } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'Topic wajib diisi' });

  const messages = [
    { role: 'user', content: buildPrompt(topic, platform || 'Instagram', tone || 'Santai', format || '1:1') }
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
          temperature: 0.8,
          max_tokens: 1500,
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
      lastError = err.message;
      continue;
    }
  }

  res.status(500).json({ error: lastError });
}
