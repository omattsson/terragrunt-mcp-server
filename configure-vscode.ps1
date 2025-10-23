# PowerShell script to configure Terragrunt MCP Server for WSL in VS Code
# Run this from Windows PowerShell (not WSL)

Write-Host "🔧 Configuring Terragrunt MCP Server for VS Code with WSL..." -ForegroundColor Green

# Get VS Code settings path
$vscodeSettingsPath = "$env:APPDATA\Code\User\settings.json"

if (-not (Test-Path $vscodeSettingsPath)) {
  Write-Host "❌ VS Code settings.json not found at: $vscodeSettingsPath" -ForegroundColor Red
  Write-Host "Please make sure VS Code is installed and has been run at least once." -ForegroundColor Yellow
  exit 1
}

Write-Host "📁 Found VS Code settings at: $vscodeSettingsPath" -ForegroundColor Cyan

# Get WSL path (adjust this to match your actual path)
$wslPath = "/home/olof/git/github/terragrunt-mcp-server"
Write-Host "🐧 Using WSL path: $wslPath" -ForegroundColor Cyan

# Read current settings
$currentSettings = @{}
if (Test-Path $vscodeSettingsPath) {
  try {
    $settingsContent = Get-Content $vscodeSettingsPath -Raw
    if ($settingsContent.Trim()) {
      $currentSettings = $settingsContent | ConvertFrom-Json -AsHashtable
    }
  }
  catch {
    Write-Host "⚠️  Could not parse existing settings.json, creating new one" -ForegroundColor Yellow
  }
}

# Add MCP configuration
if (-not $currentSettings.ContainsKey("mcp.servers")) {
  $currentSettings["mcp.servers"] = @{}
}

$currentSettings["mcp.servers"]["terragrunt"] = @{
  command = "wsl"
  args    = @(
    "node",
    "$wslPath/dist/index.js"
  )
  env     = @{
    NODE_PATH = "$wslPath/node_modules"
  }
}

# Write back to settings.json
try {
  $currentSettings | ConvertTo-Json -Depth 10 | Set-Content $vscodeSettingsPath -Encoding UTF8
  Write-Host "✅ Successfully updated VS Code settings.json" -ForegroundColor Green
}
catch {
  Write-Host "❌ Failed to update settings.json: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "🎉 Configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart VS Code" -ForegroundColor White
Write-Host "2. Open your project in WSL (Remote-WSL extension)" -ForegroundColor White
Write-Host "3. Check MCP status in VS Code status bar" -ForegroundColor White
Write-Host "4. Test with Copilot: 'Search Terragrunt docs for dependencies'" -ForegroundColor White
Write-Host ""
Write-Host "📖 For troubleshooting, see WSL-SETUP.md" -ForegroundColor Cyan