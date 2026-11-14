@echo off
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env >nul
  echo Die Datei .env wurde angelegt. Bitte Passwort und Gemini-Key eintragen und start.bat erneut starten.
  notepad .env
  exit /b
)
if not exist node_modules (
  echo Installiere beim ersten Start alles Noetige...
  call npm install
)
start "" http://localhost:3010
call npm run dev
