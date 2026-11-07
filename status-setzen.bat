@echo off
chcp 65001 >nul
title Helix - Set status
cd /d "%~dp0"
echo ==================================================
echo   Helix - Set website status / mode
echo ==================================================
echo.
echo   [1]  Maintenance    - Site locked, maintenance page only
echo   [2]  AI paused      - Site open, tickets go straight to the team
echo   [3]  Notice         - Site open, everything works, just a banner
echo   [4]  All normal     - No banner, AI on
echo.
set "WAHL="
set /p "WAHL=Choice (1-4): "

set "MODUS="
if "%WAHL%"=="1" set "MODUS=on"
if "%WAHL%"=="2" set "MODUS=ai-off"
if "%WAHL%"=="3" set "MODUS=notice"
if "%WAHL%"=="4" set "MODUS=normal"
if not defined MODUS (
  echo Invalid choice.
  pause
  exit /b
)

set "TITEL="
set "NACHRICHT="
if not "%MODUS%"=="normal" (
  echo.
  echo Leave empty = default text.
  set /p "TITEL=Title: "
  set /p "NACHRICHT=Message: "
)
echo.
node maintenance.js %MODUS% "%NACHRICHT%" "%TITEL%"
echo.
echo Done! Visible locally right away, on GitHub Pages in about 1 minute.
if "%MODUS%"=="on" echo Back online: wartung-aus.bat or start.bat
pause
