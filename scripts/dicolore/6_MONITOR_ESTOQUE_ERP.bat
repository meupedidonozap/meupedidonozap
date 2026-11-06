@echo off
title MPZ - Monitor Estoque ERP
cd /d "%~dp0"
:loop
python sync_estoque_erp.py --monitorar
echo Monitor parou. Reiniciando em 10s...
timeout /t 10 >nul
goto loop
