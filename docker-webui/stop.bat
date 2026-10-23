@echo off
rem Stops only the web UI. Docker and your containers keep running.
title Docker Controller - stop
wsl --cd "%~dp0." -d Ubuntu -- bash ./webui.sh stop
if errorlevel 1 pause
