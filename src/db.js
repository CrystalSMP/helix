// Einfache JSON-Datenbank pro Server (Guild). Für echte Skalierung später auf MongoDB/Postgres umstellen –
// die Funktionen hier sind die einzige Schnittstelle, der Rest des Codes bleibt gleich.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DIR, { recursive: true });

const defaults = () => ({
  panel: {
    title: '🎫 Support Tickets',
    description: 'Click below to open a ticket. Our AI will help you right away.',
    color: '#5865F2',
    buttonLabel: 'Open ticket',
    buttonEmoji: '📩',
    footer: 'Powered by Helix',
  },
  ai: {
    enabled: true,
    botName: 'Helix',
    greeting: 'Hey {user}! 👋 How can I help you?',
    personality: 'friendly, short, helpful, in English',
  },
  knowledge: [], // { id, title, content }
  categories: [
    { name: 'Ban / Unban', roleId: '', description: 'User was banned or wants to be unbanned' },
    { name: 'Report', roleId: '', description: 'Report a player or rule violation' },
    { name: 'Payment / Shop', roleId: '', description: 'Purchases, ranks, refunds' },
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
