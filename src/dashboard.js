const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const { ChannelType } = require('discord.js');
const { getGuild, saveGuild } = require('./db');
const { client, panelMessage } = require('./bot');

const { getMode } = require('./site');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(session({ secret: process.env.SESSION_SECRET || 'dev', resave: false, saveUninitialized: false }));

// Status für GitHub Pages (Online-Check) und das Dashboard
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/mode', (_req, res) => res.json(getMode()));

// Wartung: Dashboard gesperrt (Startseite zeigt die Wartungsseite)
app.use((req, res, next) => {
  if (getMode().state === 'maintenance' && /^\/(api|login|callback|guild)/.test(req.path)) {
    return res.status(503).json({ error: 'Wartung' });
  }
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));

// Lokal: direkt localhost. Über den Tunnel: die feste GitHub-Pages-Adresse, die zum Tunnel weiterleitet.
const PAGES_URL = () => process.env.PAGES_URL || 'https://crystalsmp.github.io/helix';
const isLocal = (req) => /^(localhost|127\.0\.0\.1)(:|$)/.test(req.headers.host || '');
const redirect = (req) => (isLocal(req) ? `http://${req.headers.host}/callback` : `${PAGES_URL()}/callback.html`);

// ---- Discord OAuth2 Login ----
app.get('/login', (req, res) => {
  req.session.state = crypto.randomBytes(16).toString('hex');
  const q = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID, redirect_uri: redirect(req),
    response_type: 'code', scope: 'identify guilds', state: req.session.state,
  });
  res.redirect(`https://discord.com/oauth2/authorize?${q}`);
});

app.get('/callback', async (req, res) => {
  if (!req.query.code || req.query.state !== req.session.state) return res.status(400).send('Ungültiger Login');
  const tok = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code', code: req.query.code, redirect_uri: redirect(req),
    }),
  }).then((r) => r.json());
  if (!tok.access_token) return res.status(400).send('Login fehlgeschlagen');
  const h = { Authorization: `Bearer ${tok.access_token}` };
  const [user, guilds] = await Promise.all([
    fetch('https://discord.com/api/users/@me', { headers: h }).then((r) => r.json()),
    fetch('https://discord.com/api/users/@me/guilds', { headers: h }).then((r) => r.json()),
  ]);
  // Nur Server, auf denen der User "Server verwalten" (0x20) hat
  req.session.user = { id: user.id, name: user.global_name || user.username, avatar: user.avatar };
  req.session.guilds = guilds.filter((g) => (BigInt(g.permissions) & 0x20n) === 0x20n).map((g) => g.id);
  res.redirect('/');
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

// ---- Auth-Middleware ----
const auth = (req, res, next) => (req.session.user ? next() : res.status(401).json({ error: 'login' }));
const guildAuth = (req, res, next) => {
  if (!req.session.guilds?.includes(req.params.id)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Bot ist nicht auf diesem Server' });
  req.guild = guild;
  next();
};

// ---- API ----
app.get('/api/me', auth, (req, res) => {
  const guilds = req.session.guilds.map((id) => {
    const g = client.guilds.cache.get(id);
    return g ? { id, name: g.name, icon: g.iconURL(), botIn: true } : { id, botIn: false };
  }).filter((g) => g.botIn);
  const invite = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=268512272`;
  res.json({ user: req.session.user, guilds, invite });
});

app.get('/api/guild/:id', auth, guildAuth, (req, res) => {
  const g = req.guild;
  res.json({
    name: g.name,
    config: getGuild(g.id),
    channels: g.channels.cache.filter((c) => c.type === ChannelType.GuildText).map((c) => ({ id: c.id, name: c.name })),
    categories: g.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).map((c) => ({ id: c.id, name: c.name })),
    roles: g.roles.cache.filter((r) => !r.managed && r.id !== g.id).map((r) => ({ id: r.id, name: r.name })),
  });
});

app.put('/api/guild/:id', auth, guildAuth, (req, res) => {
  const cur = getGuild(req.guild.id);
  const b = req.body;
  const next = {
    ...cur,
    panel: { ...cur.panel, ...b.panel },
    ai: { ...cur.ai, ...b.ai },
    knowledge: Array.isArray(b.knowledge) ? b.knowledge.slice(0, 200).map((k) => ({
      id: k.id || crypto.randomUUID(), title: String(k.title || '').slice(0, 100), content: String(k.content || '').slice(0, 20000),
    })) : cur.knowledge,
    categories: Array.isArray(b.categories) ? b.categories.slice(0, 25) : cur.categories,
    ticketCategoryId: b.ticketCategoryId ?? cur.ticketCategoryId,
    supportRoleId: b.supportRoleId ?? cur.supportRoleId,
    logChannelId: b.logChannelId ?? cur.logChannelId,
  };
  saveGuild(req.guild.id, next);
  res.json({ ok: true });
});

app.post('/api/guild/:id/send-panel', auth, guildAuth, async (req, res) => {
  const ch = req.guild.channels.cache.get(req.body.channelId);
  if (!ch?.isTextBased()) return res.status(400).json({ error: 'Kanal ungültig' });
  try {
    await ch.send(panelMessage(getGuild(req.guild.id)));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/guild/:id', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'guild.html')));

function startDashboard() {
  const port = process.env.PORT || 3002;
  app.listen(port, () => console.log(`🌐 Dashboard lokal: http://localhost:${port}  |  online: ${PAGES_URL()}`));
}

module.exports = { startDashboard };
