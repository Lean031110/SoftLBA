@echo off
REM ============================================================
REM SoftLBA — Windows Service Installer (via NSSM)
REM ============================================================
REM Requisitos:
REM   - NSSM (Non-Sucking Service Manager): https://nssm.cc/
REM   - Bun runtime instalado en PATH
REM
REM Uso (como administrador):
REM   install-windows.bat
REM
REM Este script crea 2 servicios de Windows:
REM   1. SoftLBA-Realtime — Servicio Socket.IO (puerto 3003)
REM   2. SoftLBA-Web — Servidor Next.js (puerto 3000)
REM ============================================================

setlocal

set APP_DIR=%~dp0..\..
set NSSM=nssm

echo ============================================
echo  SoftLBA Windows Service Installer
echo  Directorio: %APP_DIR%
echo ============================================

REM Verificar NSSM
where %NSSM% >nul 2>&1
if errorlevel 1 (
  echo ERROR: NSSM no encontrado en PATH.
  echo Descarga NSSM desde https://nssm.cc/ y agregalo al PATH.
  pause
  exit /b 1
)

REM Crear servicio Realtime
echo.
echo [1/2] Instalando servicio SoftLBA-Realtime...
%NSSM% install SoftLBA-Realtime "bun.exe" "run mini-services/realtime-service/index.ts"
%NSSM% set SoftLBA-Realtime AppDirectory "%APP_DIR%"
%NSSM% set SoftLBA-Realtime AppEnvironmentExtra NODE_ENV=production
%NSSM% set SoftLBA-Realtime Start SERVICE_DELAYED_AUTO_START
%NSSM% set SoftLBA-Realtime Description "SoftLBA Realtime Service (Socket.IO) - Puerto 3003"

REM Crear servicio Web
echo.
echo [2/2] Instalando servicio SoftLBA-Web...
%NSSM% install SoftLBA-Web "node.exe" ".next/standalone/server.js"
%NSSM% set SoftLBA-Web AppDirectory "%APP_DIR%"
%NSSM% set SoftLBA-Web AppEnvironmentExtra NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
%NSSM% set SoftLBA-Web DependOnService SoftLBA-Realtime
%NSSM% set SoftLBA-Web Start SERVICE_DELAYED_AUTO_START
%NSSM% set SoftLBA-Web Description "SoftLBA Web App (Next.js) - Puerto 3000"

echo.
echo ============================================
echo  Servicios instalados correctamente.
echo  Iniciar con: net start SoftLBA-Realtime ^&^& net start SoftLBA-Web
echo  Detener con: net stop SoftLBA-Web ^&^& net stop SoftLBA-Realtime
echo  Desinstalar con: nssm remove SoftLBA-Web confirm ^&^& nssm remove SoftLBA-Realtime confirm
echo ============================================
pause
