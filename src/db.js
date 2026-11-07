// Einfache JSON-Datenbank pro Server (Guild). Für echte Skalierung später auf MongoDB/Postgres umstellen –
// die Funktionen hier sind die einzige Schnittstelle, der Rest des Codes bleibt gleich.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DIR, { recursive: true });

const defaults = () => ({
  panel: {
    title: '🎫 Support-Tickets',
    description: 'Klicke unten, um ein Ticket zu öffnen. Unsere KI hilft dir sofort weiter.',
    color: '#5865F2',
    buttonLabel: 'Ticket öffnen',
    buttonEmoji: '📩',
    footer: 'Powered by Helix',
  },
  ai: {
    enabled: true,
    botName: 'Helix',
    greeting: 'Hey {user}! 👋 Was ist dein Anliegen?',
    personality: 'freundlich, kurz, hilfsbereit, auf Deutsch',
  },
  knowledge: [], // { id, title, content }
  categories: [
    { name: 'Bann / Entbannung', roleId: '', description: 'User wurde gebannt oder möchte entbannt werden' },
    { name: 'Report', roleId: '', description: 'Spieler oder Regelverstoß melden' },
    { name: 'Zahlung / Shop', roleId: '', description: 'Käufe, Ränge, Rückerstattungen' },
  ],
  ticketCategoryId: '',
  supportRoleId: '',
  logChannelId: '',
  counter: 0,
});

const file = (id) => path.join(DIR, `guild_${id.replace(/\D/g, '')}.json`);

function getGuild(id) {
  try {
    return { ...defaults(), ...JSON.parse(fs.readFileSync(file(id), 'utf8')) };
  } catch {
    return defaults();
  }
}

function saveGuild(id, data) {
  fs.writeFileSync(file(id), JSON.stringify(data, null, 2));
}

function updateGuild(id, fn) {
  const g = getGuild(id);
  fn(g);
  saveGuild(id, g);
  return g;
}

module.exports = { getGuild, saveGuild, updateGuild };
