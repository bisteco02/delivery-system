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

REM Definir URL do servidor (altere conforme necessário)
set API_URL=https://padocadodede.com

echo 📡 Conectando ao servidor: %API_URL%
echo.

REM Iniciar o serviço
node print-service.js

pause
