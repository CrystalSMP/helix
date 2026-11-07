@echo off
chcp 65001 >nul
title Helix
cd /d "%~dp0"

where node >nul 2>nul || (echo Node.js is missing: https://nodejs.org & pause & exit /b)

if not exist ".env" (
  copy .env.example .env >nul
  echo Please enter your keys in the .env file.
  notepad .env
)

if not exist "node_modules" (
  echo Installing packages...
  call npm install --silent
)

echo.
echo  Helix is starting...  Local: http://localhost:3002
echo  (Keep this window open. Stop with Ctrl+C)
echo.
start "" http://localhost:3002
node start.js
pause
