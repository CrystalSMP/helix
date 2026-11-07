@echo off
chcp 65001 >nul
title Helix
cd /d "%~dp0"
if not exist node_modules call npm install
echo Ending maintenance and starting the website...
echo (Maintenance mode turns off automatically once the site is online.)
echo.
echo  !!! KEEP THIS WINDOW OPEN - otherwise the site goes offline !!!
echo.
node start.js
pause
