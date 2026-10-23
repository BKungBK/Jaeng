@echo off
rem Starts the Docker web UI inside WSL (Ubuntu) and opens it in the browser.
rem Use "start.bat --no-browser" to skip opening the browser.
title Docker Controller - start
wsl --cd "%~dp0." -d Ubuntu -- bash ./webui.sh start
if errorlevel 1 goto failed
if /i not "%~1"=="--no-browser" start "" http://127.0.0.1:8080
exit /b 0
:failed
echo.
echo Could not start the web UI. See the message above.
pause
exit /b 1
