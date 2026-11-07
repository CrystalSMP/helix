// Modus (Wartung / KI pausiert / Hinweis) + Tunnel-URL – wie bei Guildsmith.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MODE_FILE = path.join(ROOT, 'mode.json');
const DEFAULT = { state: 'normal', ai: true, title: null, message: null, url: '' };

function getMode() {
  try { return { ...DEFAULT, ...JSON.parse(fs.readFileSync(MODE_FILE, 'utf8')) }; } catch { return { ...DEFAULT }; }
}

function setMode(patch) {
  const m = { ...getMode(), ...patch };
  fs.writeFileSync(MODE_FILE, JSON.stringify(m, null, 2));
  return m;
}

// Schreibt public/tunnel.js und pusht es, damit GitHub Pages den Stand kennt.
function publish(m = getMode()) {
  const url = m.state === 'maintenance' ? '' : m.url;
  const site = { state: m.state, ai: m.ai, title: m.title, message: m.message };
  fs.writeFileSync(path.join(ROOT, 'public', 'tunnel.js'),
    `window.TUNNEL_URL = ${JSON.stringify(url)};\nwindow.SITE = ${JSON.stringify(site)};\n`);
  try {
    execSync('git add public/tunnel.js && git commit -q -m "Update status" && git push -q', { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

module.exports = { getMode, setMode, publish };
