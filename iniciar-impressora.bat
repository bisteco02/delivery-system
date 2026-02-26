@echo off
REM Serviço de Impressão Automática
REM Este arquivo inicia o print-service automaticamente

cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════════╗
echo ║  🖨️  INICIANDO SERVIÇO DE IMPRESSÃO       ║
echo ╚════════════════════════════════════════════╝
echo.

REM Verificar se Node.js está instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js não encontrado!
    echo   Baixe em: https://nodejs.org/
    pause
    exit /b 1
)

REM Pasta do agente local
set AGENT_DIR=%~dp0print-agent

if not exist "%AGENT_DIR%" (
    echo ❌ Pasta do agente não encontrada: %AGENT_DIR%
    pause
    exit /b 1
)

echo 📡 Iniciando agente local de impressão...
echo.

REM Instalar dependências se necessário
if not exist "%AGENT_DIR%\node_modules" (
    echo 📦 Instalando dependências do agente...
    pushd "%AGENT_DIR%"
    npm install
    popd
)

REM Iniciar o agente
pushd "%AGENT_DIR%"
node print-agent.js
popd

pause
