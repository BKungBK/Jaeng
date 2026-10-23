@echo off
rem Stops the web UI AND shuts down the Ubuntu WSL distro, which stops Docker
rem and every running container. Frees the memory WSL is holding.
title Docker Controller - stop all
echo This will stop the web UI, Docker and ALL running containers.
choice /m "Continue"
if errorlevel 2 exit /b 0
wsl --cd "%~dp0." -d Ubuntu -- bash ./webui.sh stop
wsl --terminate Ubuntu
echo Ubuntu (WSL) stopped. Run start.bat to bring everything back.
timeout /t 3 >nul
