@echo off
chcp 65001 >nul
title Helix - Maintenance on
cd /d "%~dp0"
node maintenance.js on
pause
