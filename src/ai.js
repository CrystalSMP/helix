// Gemini-Anbindung über die REST-API (keine extra Abhängigkeit nötig).
// Mehrere Modelle (Komma-getrennt): fällt eins aus, wird das nächste probiert
const MODELS = () => (process.env.GEMINI_MODELS || 'gemini-3.6-flash,gemini-3.5-flash-lite').split(',').map((m) => m.trim()).filter(Boolean);

function buildSystemPrompt(cfg, guildName) {
  const kb = cfg.knowledge.length
    ? cfg.knowledge.map((k) => `### ${k.title}\n${k.content}`).join('\n\n')
    : '(Noch keine Server-Infos hinterlegt.)';
  const cats = cfg.categories.map((c) => `- "${c.name}": ${c.description}`).join('\n');

  return `Du bist ${cfg.ai.botName}, der Support-Assistent des Discord-Servers "${guildName}".
Stil: ${cfg.ai.personality}.

AUFGABE:
1. Finde heraus, was das Anliegen des Users ist.
2. Wenn du es mit dem SERVER-WISSEN sicher beantworten kannst, beantworte es.
3. Wenn ein Mensch nötig ist (Bann, Reports, Zahlungen, Unklarheit, User will Mensch), leite weiter.
4. Erfinde NIEMALS Regeln, Preise oder Entscheidungen. Versprich keine Entbannung.

TICKET-KATEGORIEN:
${cats}

SERVER-WISSEN:
${kb}

ANTWORTFORMAT – antworte IMMER als reines JSON:
{"reply": "<Nachricht an den User>", "escalate": true|false, "category": "<Kategoriename oder null>", "summary": "<1 Satz Zusammenfassung für Moderatoren oder null>"}`;
}

async function askGemini(cfg, guildName, history) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY fehlt');
  // Gemini erwartet, dass der Verlauf mit einer User-Nachricht beginnt
  const start = history.findIndex((m) => m.role === 'user');
  history = start === -1 ? [] : history.slice(start);

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: buildSystemPrompt(cfg, guildName) }] },
    contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
  });
  let data, lastErr;
  for (const model of MODELS()) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
      data = await res.json();
      break;
    } catch (e) {
      lastErr = e;
      console.warn('⚠ Gemini:', e.message);
    }
  }
  if (!data) throw lastErr;
  const raw = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || '').join('') || '{}';
  try {
    const out = JSON.parse(raw);
    return {
      reply: String(out.reply || '…'),
      escalate: !!out.escalate,
      category: out.category || null,
      summary: out.summary || null,
    };
  } catch {
    return { reply: raw.slice(0, 1800), escalate: false, category: null, summary: null };
  }
}

module.exports = { askGemini };
