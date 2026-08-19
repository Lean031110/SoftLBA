@echo off
REM ============================================================
REM SoftLBA — Desinstalador de servicios Windows
REM ============================================================
REM Detiene y elimina los servicios de Windows creados por
REM install-windows.bat.
REM
REM Uso (como administrador):
REM   uninstall-windows.bat
REM ============================================================

setlocal
set NSSM=nssm

echo Deteniendo servicios...

net stop SoftLBA-Web 2>nul
net stop SoftLBA-Realtime 2>nul

echo.
echo Eliminando servicios...

%NSSM% remove SoftLBA-Web confirm 2>nul
%NSSM% remove SoftLBA-Realtime confirm 2>nul

echo.
echo Servicios eliminados.
pause
