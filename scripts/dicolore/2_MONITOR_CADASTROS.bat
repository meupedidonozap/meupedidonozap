@echo off
title [DiColore] 2 - Clientes (direto do ERP, a cada 3 min)
cd /d "%~dp0"
:loop
python sync_clientes_erp.py --monitorar
echo Monitor parou. Reiniciando em 10s... & timeout /t 10 >nul
goto loop
