@echo off
title [DiColore] 5 - Boletos
cd /d "%~dp0"
:loop
python atualizar_dicolore.py --monitorar --tarefa boletos
echo Monitor parou. Reiniciando em 10s... & timeout /t 10 >nul
goto loop
