require('dotenv').config();
const { client } = require('./bot');
const { startDashboard } = require('./dashboard');

for (const k of ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'GEMINI_API_KEY']) {
  if (!process.env[k]) console.warn(`⚠️  ${k} ist nicht gesetzt (siehe .env.example)`);
}

startDashboard();
client.login(process.env.DISCORD_TOKEN);
