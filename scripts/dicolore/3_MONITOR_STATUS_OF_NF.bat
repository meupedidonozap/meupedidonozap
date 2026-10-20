@echo off
title [DiColore] 3 - Status OF/NF
cd /d "%~dp0"
:loop
python atualizar_dicolore.py --monitorar --tarefa status
echo Monitor parou. Reiniciando em 10s... & timeout /t 10 >nul
goto loop
