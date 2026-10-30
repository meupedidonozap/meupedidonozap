@echo off
cd /d "%~dp0"
start "" "%~dp01_MONITOR_PEDIDOS.bat"
timeout /t 3 >nul
start "" "%~dp02_MONITOR_CADASTROS.bat"
timeout /t 3 >nul
start "" "%~dp03_MONITOR_STATUS_OF_NF.bat"
timeout /t 3 >nul
start "" "%~dp04_MONITOR_TITULOS.bat"
timeout /t 3 >nul
start "" "%~dp05_MONITOR_BOLETOS.bat"
