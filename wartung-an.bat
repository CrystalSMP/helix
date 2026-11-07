@echo off
chcp 65001 >nul
title Helix - Wartung an
cd /d "%~dp0"
node maintenance.js on
pause
