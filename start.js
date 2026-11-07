// Startet Helix lokal + Cloudflare-Tunnel und leitet die GitHub-Pages-Seite darauf um.
require('dotenv').config();
const { spawn } = require('child_process');
const { getMode, setMode, publish } = require('./src/site');

const PORT = process.env.PORT || 3002;
// Starten beendet die Wartung automatisch
if (getMode().state === 'maintenance') setMode({ state: 'normal', ai: true, title: null, message: null });

const server = spawn(process.execPath, ['src/index.js'], { stdio: 'inherit' });
const tunnel = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
tunnel.on('error', () => console.log('⚠ cloudflared not found – only available locally: http://localhost:' + PORT));

let done = false;
const onData = (buf) => {
  const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (!m || done) return;
  done = true;
  console.log(`\n🌐 Tunnel: ${m[0]}`);
  const ok = publish(setMode({ url: m[0] }));
  console.log(ok ? '✅ GitHub Pages will redirect to the tunnel in about 1 minute.\n' : '⚠ Could not push the tunnel URL (check your git login).\n');
};
tunnel.stdout.on('data', onData);
tunnel.stderr.on('data', onData);

const stop = () => {
  // Tunnel-URL entfernen, damit GitHub Pages nicht auf einen toten Tunnel leitet
  if (done) { console.log('Stopping… (updating status)'); publish(setMode({ url: '' })); done = false; }
  tunnel.kill(); server.kill(); process.exit();
};
process.on('SIGINT', stop);
server.on('exit', stop);
