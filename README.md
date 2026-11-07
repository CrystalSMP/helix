# ⬡ Helix – KI-Ticketsystem für Discord

Ein Bot für viele Server gleichzeitig: Tickets werden zuerst von **Google Gemini** angenommen. Die KI fragt nach dem Anliegen, beantwortet einfache Fragen mit dem Server-Wissen und leitet alles Wichtige (Bann, Reports, Zahlungen …) an die richtige Team-Rolle weiter, mit einer kurzen Zusammenfassung.

## Features
- 🎨 **Panel-Designer** im Web-Dashboard mit Live-Vorschau (Titel, Text, Farbe, Button, Footer)
- 🤖 **Gemini-KI** im Ticket: Begrüßung, Antworten, automatische Weiterleitung + Kategorie
- 📚 **Server-Wissen** pro Server (Text-Einträge oder .txt/.md hochladen)
- 🗂️ **Kategorien** mit eigener Ping-Rolle, Log-Kanal mit Transkripten
- 🙋 Button „Mensch anfordern“, 🔒 „Ticket schließen“, `/panel`, `/close`, `/dashboard`
- 🔐 Login über Discord OAuth2, nur Server-Admins („Server verwalten“) dürfen bearbeiten

## Online stellen (wie Guildsmith)
Server läuft auf deinem PC → Cloudflare-Tunnel → GitHub Pages leitet weiter.
- Feste Adresse: `https://crystalsmp.github.io/helix`
- Online: Pages prüft `/api/health` am Tunnel und leitet weiter
- Offline: Pages zeigt „Offline“ und prüft alle 15 s neu
- Discord-Redirects eintragen: `http://localhost:3002/callback` und `https://crystalsmp.github.io/helix/callback.html`
- Bats: `start.bat` / `wartung-aus.bat` (starten), `wartung-an.bat`, `status-setzen.bat` (Wartung / KI pausiert / Hinweis / normal)
- Bei „KI pausiert“ gehen neue Ticket-Nachrichten direkt ans Team.

## Einrichtung (lokal)
1. Im [Discord Developer Portal](https://discord.com/developers/applications) eine App erstellen
   - **Bot** → Token kopieren, *Message Content Intent* aktivieren
   - **OAuth2** → Client-ID + Secret kopieren, Redirect `http://localhost:3000/callback` eintragen
2. Gemini-Key bei [Google AI Studio](https://aistudio.google.com/apikey) holen
3. `.env.example` zu `.env` kopieren und ausfüllen
4. Installieren & starten (Node.js 18+):
   ```bash
   npm install
   npm start
   ```
5. `http://localhost:3000` öffnen → anmelden → Bot einladen → Server konfigurieren → Panel senden

## Für große Netzwerke (nächste Schritte)
- JSON-Speicher (`src/db.js`) durch MongoDB/Postgres ersetzen
- Offene Tickets in der DB speichern (sie überleben dann einen Neustart)
- Ab 2.500 Servern Sharding (`ShardingManager`) einbauen
- Statistiken, Ticket-Bewertungen, Premium-Stufen
