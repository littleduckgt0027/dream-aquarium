@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Please install Node.js 24 LTS from https://nodejs.org then double-click START-GAME.bat again.
 if not defined CI pause
 exit /b 1
)
node scripts\launcher.js start
if errorlevel 1 (
 echo The game could not start. Read the message above. Your saved aquarium has not been deleted.
 if not defined CI pause
 exit /b 1
)
