@echo off
title [DiColore] 2 - Estoque, Precos e Clientes
cd /d "%~dp0"
:loop
python atualizar_dicolore.py --monitorar --tarefa cadastros
echo Monitor parou. Reiniciando em 10s... & timeout /t 10 >nul
goto loop
