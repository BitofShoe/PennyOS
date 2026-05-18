@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Penny.ps1" %*
set "PENNY_INSTALL_EXIT=%ERRORLEVEL%"
echo.
if "%PENNY_INSTALL_EXIT%"=="0" (
  echo PennyOS installer finished.
) else (
  echo PennyOS installer failed with exit code %PENNY_INSTALL_EXIT%.
)
echo.
pause
exit /b %PENNY_INSTALL_EXIT%
