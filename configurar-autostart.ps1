# Configurar Impressão Automática no Startup do Windows
# Execute este arquivo com privilegios de administrador

Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🖨️  CONFIGURADOR DE IMPRESSÃO AUTOMÁTICA ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verificar se está rodando como admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "❌ Este script precisa ser executado como Administrador!" -ForegroundColor Red
    Write-Host "   Clique com direito no PowerShell e selecione 'Executar como administrador'" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit
}

$projectPath = Get-Location
$batFile = "$projectPath\iniciar-impressora.bat"

if (-not (Test-Path $batFile)) {
    Write-Host "❌ Arquivo iniciar-impressora.bat não encontrado em: $projectPath" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit
}

Write-Host "📂 Projeto localizado em: $projectPath" -ForegroundColor Green
Write-Host ""

# Opções de configuração
Write-Host "Escolha como ativar a impressão automática:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1️⃣  Adicionar ao Startup do Windows (recomendado)"
Write-Host "2️⃣  Usar Task Scheduler (mais confiável)"
Write-Host "3️⃣  Usar PM2 (gerenciado por aplicação)"
Write-Host ""

$opcao = Read-Host "Escolha (1/2/3)"

switch ($opcao) {
    "1" {
        Write-Host ""
        Write-Host "Configurando Startup..." -ForegroundColor Cyan
        
        $startupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
        $shortcutPath = "$startupFolder\Impressora Automática.lnk"
        
        # Criar atalho usando COM
        $WshShell = New-Object -ComObject WScript.Shell
        $shortcut = $WshShell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $batFile
        $shortcut.WorkingDirectory = $projectPath
        $shortcut.Description = "Serviço de Impressão Automática de Pedidos"
        $shortcut.IconLocation = "shell32.dll,100"
        $shortcut.Save()
        
        Write-Host "✅ Atalho criado em: $shortupFolder" -ForegroundColor Green
        Write-Host "   O serviço iniciará automaticamente ao ligar o PC!" -ForegroundColor Green
    }
    
    "2" {
        Write-Host ""
        Write-Host "Configurando Task Scheduler..." -ForegroundColor Cyan
        
        # Criar Task Scheduler
        $taskName = "PrintServiceAutomatico"
        $taskAction = New-ScheduledTaskAction -Execute $batFile -WorkingDirectory $projectPath
        $taskTrigger = New-ScheduledTaskTrigger -AtLogOn
        $taskSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0
        
        Register-ScheduledTask -TaskName $taskName `
            -Action $taskAction `
            -Trigger $taskTrigger `
            -Settings $taskSettings `
            -Force `
            -Description "Serviço de Impressão Automática de Pedidos" | Out-Null
        
        Write-Host "✅ Tarefa criada: $taskName" -ForegroundColor Green
        Write-Host "   O serviço iniciará automaticamente ao fazer login!" -ForegroundColor Green
    }
    
    "3" {
        Write-Host ""
        Write-Host "Verificando PM2..." -ForegroundColor Cyan
        
        $pm2 = npm list -g | Select-String "pm2"
        
        if ($null -eq $pm2) {
            Write-Host "📦 Instalando PM2..." -ForegroundColor Yellow
            npm install -g pm2 | Out-Null
        }
        
        Write-Host "Iniciando com PM2..." -ForegroundColor Cyan
        pm2 start print-service.js --name "print-service" --log "$projectPath\print-service.log"
        pm2 startup
        pm2 save
        
        Write-Host "✅ PM2 configurado!" -ForegroundColor Green
        Write-Host "   Gerenciar com: pm2 status, pm2 logs, pm2 stop/restart" -ForegroundColor Green
    }
    
    default {
        Write-Host "❌ Opção inválida!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ CONFIGURAÇÃO CONCLUÍDA!               ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Reinicie o PC para ativar (ou execute iniciar-impressora.bat manualmente)"
Write-Host "2. A impressão iniciará automaticamente"
Write-Host "3. Verifique a pasta de logs se houver problemas"
Write-Host ""

Read-Host "Pressione Enter para fechar"
