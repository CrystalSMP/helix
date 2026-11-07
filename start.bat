@echo off
chcp 65001 >nul
title Helix
cd /d "%~dp0"

where node >nul 2>nul || (echo Node.js fehlt: https://nodejs.org & pause & exit /b)

if not exist ".env" (
  copy .env.example .env >nul
  echo Bitte trag deine Keys in die .env ein.
  notepad .env
)

if not exist "node_modules" (
  echo Installiere Pakete...
  call npm install --silent
)

echo.
echo  Helix startet...  Lokal: http://localhost:3002
echo  (Fenster offen lassen. Beenden mit Strg+C)
echo.
start "" http://localhost:3002
node start.js
pause
