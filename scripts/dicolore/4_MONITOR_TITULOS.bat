@echo off
title [DiColore] 4 - Titulos (status e baixas)
cd /d "%~dp0"
:loop
python atualizar_dicolore.py --monitorar --tarefa titulos
echo Monitor parou. Reiniciando em 10s... & timeout /t 10 >nul
goto loop
