@echo off
setlocal
cd /d "%~dp0"
if /i "%~1"=="--executar" goto executar
title MPZ - Agendar itens das notas fiscais
if not exist "%~dp0sync_itens_nf_erp.py" (
    echo ERRO: coloque este BAT na mesma pasta de sync_itens_nf_erp.py.
    pause
    exit /b 1
)
set "MPZ_PYTHON="
for /f "delims=" %%P in ('python -c "import sys; print(sys.executable)"') do set "MPZ_PYTHON=%%P"
if not defined MPZ_PYTHON (
    echo ERRO: Python nao encontrado neste usuario do Windows.
    pause
    exit /b 1
)
set "MPZ_BAT=%~f0"
set "MPZ_DIR=%~dp0"
>"%~dp0itens_nf_python.txt" echo %MPZ_PYTHON%
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $action=New-ScheduledTaskAction -Execute $env:ComSpec -Argument ('/d /c ""'+$env:MPZ_BAT+'" --executar"') -WorkingDirectory $env:MPZ_DIR; $triggers=@((New-ScheduledTaskTrigger -Daily -At '12:00'),(New-ScheduledTaskTrigger -Daily -At '19:00')); $user=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name; $principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited; $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 6) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries; Register-ScheduledTask -TaskName 'MPZ_DiColore_Itens_NF' -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description 'Sincroniza os itens de NF diariamente as 12h e 19h (ultimos 3 dias).' -Force | Out-Null"
if errorlevel 1 (
    echo ERRO: nao foi possivel criar a tarefa. Confira a mensagem acima.
    pause
    exit /b 1
)
echo.
echo Agendamento criado: todos os dias, as 12h e as 19h.
echo Horario local do Windows. Mantenha o computador ligado e o usuario conectado.
echo A janela pode ser fechada. Os resultados ficam em logs\itens_nf.log.
pause
exit /b 0

:executar
if not exist "%~dp0logs" mkdir "%~dp0logs"
set "MPZ_PYTHON="
for /f "usebackq delims=" %%P in ("%~dp0itens_nf_python.txt") do set "MPZ_PYTHON=%%P"
if not defined MPZ_PYTHON exit /b 1
echo ==== Inicio: %date% %time% ====>>"%~dp0logs\itens_nf.log"
"%MPZ_PYTHON%" "%~dp0sync_itens_nf_erp.py" --dias 3 >>"%~dp0logs\itens_nf.log" 2>&1
set "RESULTADO=%errorlevel%"
echo ==== Fim: %date% %time% - codigo %RESULTADO% ====>>"%~dp0logs\itens_nf.log"
exit /b %RESULTADO%