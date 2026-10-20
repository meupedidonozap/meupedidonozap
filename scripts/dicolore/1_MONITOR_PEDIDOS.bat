@echo off
title [DiColore] 1 - Transmissao de Pedidos
cd /d "%~dp0"
:loop
python atualizar_dicolore.py --monitorar --tarefa pedidos
echo Monitor parou. Reiniciando em 10s... & timeout /t 10 >nul
goto loop
