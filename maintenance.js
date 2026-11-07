// node maintenance.js on|ai-off|notice|normal ["Nachricht"] ["Überschrift"]
const { setMode, publish } = require('./src/site');

const [mode = 'on', message, title] = process.argv.slice(2);
const clean = (s) => (s && s.trim() ? s.trim() : null);
const msg = clean(message), ttl = clean(title);

const modes = {
  on: { state: 'maintenance', ai: false, title: ttl || '🛠️ Maintenance', message: msg || 'Helix is under maintenance. Check back soon!' },
  'ai-off': { state: 'ai-off', ai: false, title: ttl || '⚠️ AI paused', message: msg || 'The AI is paused – tickets go straight to the team.' },
  notice: { state: 'notice', ai: true, title: ttl || '📢 Notice', message: msg },
  normal: { state: 'normal', ai: true, title: null, message: null },
};
if (!modes[mode]) { console.log('Unknown mode:', mode); process.exit(1); }

const m = setMode(modes[mode]);
const pushed = publish(m);
console.log({
  maintenance: '🛠️  Maintenance ON – the dashboard is locked.',
  'ai-off': '⚠️  Dashboard open, AI PAUSED (tickets go straight to the team).',
  notice: '📢 Notice banner active.',
  normal: '✅ All normal.',
}[m.state]);
console.log(pushed ? '   GitHub Pages will show it in about 1 minute.' : '   ⚠ Could not push to GitHub (saved locally only).');
