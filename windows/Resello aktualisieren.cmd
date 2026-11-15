@echo off
chcp 65001 >nul
title Resello aktualisieren
set SERVER=root@2.29.119.104
set ZIEL=%USERPROFILE%\Resello

echo.
echo  Resello wird aktualisiert ...
echo  (Falls nach einem Passwort gefragt wird: dein Server-Passwort eingeben - man sieht beim Tippen nichts.)
echo.

if exist "%ZIEL%\extension" rmdir /s /q "%ZIEL%\extension"
if not exist "%ZIEL%" mkdir "%ZIEL%"

REM 1) Server holt neueste Version von GitHub und baut neu
REM 2) Die Chrome-Erweiterung wird in %ZIEL%\extension kopiert
ssh -o StrictHostKeyChecking=accept-new %SERVER% "bash /opt/resello/scripts/server/auto-update.sh --jetzt 1>&2 && tar -C /opt/resello -cf - extension" | tar -xf - -C "%ZIEL%"

if exist "%ZIEL%\extension\manifest.json" (
  echo.
  echo  ============================================================
  echo   Fertig! Server ist aktuell.
  echo.
  echo   Chrome-Erweiterung liegt hier:
  echo   %ZIEL%\extension
  echo.
  echo   In Chrome unter chrome://extensions bei "Resello Connect"
  echo   einmal auf den runden Pfeil (Neu laden) klicken.
  echo  ============================================================
) else (
  echo.
  echo  Da ist etwas schiefgelaufen. Bitte Screenshot an Claude schicken.
)
echo.
pause
