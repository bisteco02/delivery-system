@echo off
setlocal

REM Executar como administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitação de permissao de administrador...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs" >nul 2>&1
    exit /b
)

set ROOT=%~dp0
set AGENT_DIR=%ROOT%print-agent

if not exist "%AGENT_DIR%" (
    echo ❌ Pasta do agente nao encontrada: %AGENT_DIR%
    pause
    exit /b 1
)

echo 📦 Instalando dependencias do agente...
pushd "%AGENT_DIR%"
npm install
popd

echo 🧩 Registrando inicio automatico...
schtasks /Create /F /SC ONLOGON /RL HIGHEST /TN "PadocaPrintAgent" /TR "\"%ROOT%iniciar-impressora.bat\"" >nul 2>&1

echo ✅ Instalado! O agente iniciara automaticamente ao ligar o PC.
echo ▶️ Iniciando agora...
start "" "%ROOT%iniciar-impressora.bat"

pause
