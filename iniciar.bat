@echo off
rem Doble clic para iniciar Delivery Studio (Windows).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No encuentro Node.js. Instalalo desde https://nodejs.org y vuelve a intentar.
  echo.
  pause
  exit /b 1
)
node scripts\iniciar.mjs %*
echo.
pause
