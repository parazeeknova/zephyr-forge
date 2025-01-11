# =============================================================================
#                         ZEPHYR INSTALLER
#                      Windows Installation Script
# =============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$host.UI.RawUI.WindowTitle = "⚡ Zephyr Installer"
$windowSize = $host.UI.RawUI.WindowSize
$width = $windowSize.Width
$height = $windowSize.Height


$colors = @{
    Red = [System.ConsoleColor]::Red
    Green = [System.ConsoleColor]::Green
    Yellow = [System.ConsoleColor]::Yellow
    Blue = [System.ConsoleColor]::Cyan
    White = [System.ConsoleColor]::White
    Gray = [System.ConsoleColor]::DarkGray
    Purple = [System.ConsoleColor]::Magenta
}

function Set-DarkBackground {
    Clear-Host
    [Console]::BackgroundColor = [System.ConsoleColor]::Black
    [Console]::ForegroundColor = [System.ConsoleColor]::White
    [Console]::Clear()
}

function Clear-HostScreen {
    Set-DarkBackground
}

function Write-CenteredText {
    param (
        [string]$Text,
        [System.ConsoleColor]$Color = [System.ConsoleColor]::White,
        [int]$OffsetY = 0
    )
    $lines = $Text -split "`n"
    foreach ($line in $lines) {
        $padding = [math]::Max(0, ($width - $line.Length) / 2)
        $yPos = [math]::Max(0, ($height / 2) - ($lines.Length / 2) + $OffsetY)
        [Console]::SetCursorPosition([math]::Floor($padding), [math]::Floor($yPos))
        Write-Host $line -ForegroundColor $Color
        $OffsetY++
    }
}

function Get-InstallLocation {
    Clear-HostScreen
    Write-CenteredText "📂 Installation Location" -Color $colors.Yellow -OffsetY -8
    Write-CenteredText "Where would you like to install Zephyr?" -Color $colors.White -OffsetY -6
    $currentPath = Get-Location
    $presets = @{
        "1" = @{
            Name = "Current Directory"
            Path = Join-Path $currentPath "zephyr"
        }
        "2" = @{
            Name = "Downloads"
            Path = Join-Path $HOME "Downloads\zephyr"
        }
        "3" = @{
            Name = "Desktop"
            Path = Join-Path $HOME "Desktop\zephyr"
        }
        "4" = @{
            Name = "GitHub Directory"
            Path = "C:\GitHub\zephyr"
        }
        "5" = @{
            Name = "Custom Location"
            Path = $null
        }
    }

    $offsetY = -3
    Write-CenteredText "Select installation location:" -Color $colors.Blue -OffsetY $offsetY
    
    foreach ($key in $presets.Keys) {
        $preset = $presets[$key]
        $displayText = "$key. $($preset.Name)"
        if ($preset.Path) {
            $displayText += " ($($preset.Path))"
        }
        Write-CenteredText $displayText -Color $colors.Gray -OffsetY ($offsetY + 2 * [int]$key)
    }

    $inputPadding = [math]::Max(0, ($width - 50) / 2)
    $inputY = [math]::Floor($height / 2) + 8
    [Console]::SetCursorPosition($inputPadding, $inputY)
    Write-Host "→ " -NoNewline -ForegroundColor $colors.Purple
    
    $choice = Read-Host

    if ($presets.ContainsKey($choice)) {
        if ($choice -eq "5") {
            Clear-HostScreen
            Write-CenteredText "Enter custom installation path:" -Color $colors.Yellow -OffsetY -2
            [Console]::SetCursorPosition($inputPadding, $inputY)
            Write-Host "→ " -NoNewline -ForegroundColor $colors.Purple
            $customPath = Read-Host
            return [System.IO.Path]::GetFullPath($customPath)
        }
        return $presets[$choice].Path
    }
    
    return Join-Path $currentPath "zephyr"
}

function Show-LoadingAnimation {
    param (
        [string]$Text,
        [int]$OffsetY = 0,
        [int]$DurationSeconds = 3
    )
    $spinner = "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"
    $startTime = Get-Date
    $i = 0
    
    do {
        $padding = [math]::Max(0, ($width - ($Text.Length + 2)) / 2)
        $yPos = [math]::Floor($height / 2) + $OffsetY
        [Console]::SetCursorPosition([math]::Floor($padding), $yPos)
        Write-Host $Text -NoNewline -ForegroundColor $colors.Yellow
        Write-Host " $($spinner[$i])" -NoNewline -ForegroundColor $colors.Blue
        Start-Sleep -Milliseconds 100
        [Console]::SetCursorPosition([math]::Floor($padding), $yPos)
        Write-Host (" " * ($Text.Length + 2))
        $i = ($i + 1) % $spinner.Length
    } while ((Get-Date).Subtract($startTime).TotalSeconds -lt $DurationSeconds)
}

function Show-Banner {
    Clear-HostScreen
    $banner = @"
███████╗███████╗██████╗ ██╗  ██╗██╗   ██╗██████╗ 
╚══███╔╝██╔════╝██╔══██╗██║  ██║╚██╗ ██╔╝██╔══██╗
  ███╔╝ █████╗  ██████╔╝███████║ ╚████╔╝ ██████╔╝
 ███╔╝  ██╔══╝  ██╔═══╝ ██╔══██║  ╚██╔╝  ██╔══██╗
███████╗███████╗██║     ██║  ██║   ██║   ██║  ██║
╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝
"@
    Write-CenteredText $banner -Color $colors.Blue -OffsetY -5
    Write-CenteredText "Social Media Aggregator" -Color $colors.White -OffsetY 1
    Write-CenteredText "Version 1.0.0 by parazeeknova" -Color $colors.Gray -OffsetY 3
    Start-Sleep -Seconds 2
}

function Show-CheckingDependencies {
    Clear-HostScreen
    Write-CenteredText "🔍 Checking Dependencies" -Color $colors.Yellow -OffsetY -2
    $deps = @{
        "Git" = "git --version"
        "Docker" = "docker --version"
        "Node.js" = "node --version"
    }
    
    $offsetY = 0
    foreach ($dep in $deps.GetEnumerator()) {
        try {
            $version = Invoke-Expression $dep.Value 2>&1
            Write-CenteredText "✓ $($dep.Key) $(if($version){$version}else{'installed'})" -Color $colors.Green -OffsetY $offsetY
        } catch {
            Write-CenteredText "✗ $($dep.Key) not found" -Color $colors.Red -OffsetY $offsetY
            Write-CenteredText "Please install $($dep.Key) to continue" -Color $colors.Yellow -OffsetY ($offsetY + 1)
            exit 1
        }
        $offsetY += 2
    }
    Start-Sleep -Seconds 2
}

function Get-KeyPress {
    if ([Console]::KeyAvailable) {
        return [Console]::ReadKey($true)
    }
    return $null
}

function Get-BranchSelection {
    Clear-HostScreen
    Write-CenteredText "🌿 Select Branch" -Color $colors.Yellow -OffsetY -8
    
    $branches = @(
        @{Key="1";Name="main";Description="Stable release branch focused on production"}
        @{Key="2";Name="development";Description="Development branch (recommended)"}
    )
    
    $selectedIndex = 0
    $done = $false
    
    while (-not $done) {
        Clear-HostScreen
        Write-CenteredText "🌿 Select Branch" -Color $colors.Yellow -OffsetY -8
        Write-CenteredText "Use ↑↓ arrows to select, Enter to confirm" -Color $colors.Gray -OffsetY -6
        
        for ($i = 0; $i -lt $branches.Count; $i++) {
            $branch = $branches[$i]
            $color = if ($i -eq $selectedIndex) { $colors.Green } else { $colors.Gray }
            $prefix = if ($i -eq $selectedIndex) { "→ " } else { "  " }
            Write-CenteredText "$prefix$($branch.Key). $($branch.Name)" -Color $color -OffsetY (-3 + $i * 2)
            if ($i -eq $selectedIndex) {
                Write-CenteredText "   $($branch.Description)" -Color $colors.Blue -OffsetY (-2 + $i * 2)
            }
        }
        
        $key = [Console]::ReadKey($true)
        switch ($key.Key) {
            "UpArrow" { $selectedIndex = if ($selectedIndex -eq 0) { $branches.Count - 1 } else { $selectedIndex - 1 } }
            "DownArrow" { $selectedIndex = if ($selectedIndex -eq $branches.Count - 1) { 0 } else { $selectedIndex + 1 } }
            "Enter" { $done = $true }
        }
    }
    
    return $branches[$selectedIndex].Name
}

function Install-Zephyr([string]$InstallDir) {
    Clear-HostScreen
    Write-CenteredText "⚡ Installing Zephyr" -Color $colors.Yellow -OffsetY -2
    Write-CenteredText "Location: $InstallDir" -Color $colors.Gray -OffsetY 0
    
    if (Test-Path $InstallDir) {
        Show-LoadingAnimation "Cleaning existing directory" -OffsetY 2
        Remove-Item -Path $InstallDir -Recurse -Force
    }
    
    try {
        $selectedBranch = Get-BranchSelection
        Show-LoadingAnimation "Cloning Zephyr repository" -OffsetY 2
        git clone -b $selectedBranch https://github.com/parazeeknova/zephyr.git $InstallDir -q
        Set-Location $InstallDir
        
        Clear-HostScreen
        Write-CenteredText "📦 Installing Dependencies" -Color $colors.Yellow -OffsetY -2
        
        if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
            Write-CenteredText "Installing pnpm..." -Color $colors.Gray -OffsetY 0
            npm install -g pnpm
        }

        Clear-HostScreen
        Write-CenteredText "🚀 Starting Development Environment" -Color $colors.Yellow -OffsetY -2
        Write-CenteredText "This may take a few minutes..." -Color $colors.Gray -OffsetY 0
        
        try {
            Write-CenteredText "Current Directory: $(Get-Location)" -Color $colors.Gray -OffsetY 2
            Write-CenteredText "Starting project..." -Color $colors.Gray -OffsetY 4
            Clear-HostScreen
            Write-Host "`n`n📋 Project Logs:" -ForegroundColor $colors.Blue
            Write-Host "===============================`n" -ForegroundColor $colors.Gray
            $process = Start-Process pnpm -ArgumentList "run", "start" -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\pnpm-output.log" -RedirectStandardError "$env:TEMP\pnpm-error.log"
            while (!$process.HasExited) {
                if (Test-Path "$env:TEMP\pnpm-output.log") {
                    Get-Content "$env:TEMP\pnpm-output.log" -Wait | ForEach-Object {
                        Write-Host $_ -ForegroundColor $colors.White
                    }
                }
                if (Test-Path "$env:TEMP\pnpm-error.log") {
                    Get-Content "$env:TEMP\pnpm-error.log" -Wait | ForEach-Object {
                        Write-Host $_ -ForegroundColor $colors.Red
                    }
                }
                Start-Sleep -Milliseconds 100
            }
            if ($process.ExitCode -ne 0) {
                $errorOutput = Get-Content "$env:TEMP\pnpm-error.log" -Raw
                throw "Project startup failed with exit code $($process.ExitCode)`nError Output: $errorOutput"
            }
            Remove-Item "$env:TEMP\pnpm-output.log" -ErrorAction SilentlyContinue
            Remove-Item "$env:TEMP\pnpm-error.log" -ErrorAction SilentlyContinue
            
        } catch {
            Clear-HostScreen
            Write-CenteredText "❌ Startup Failed!" -Color $colors.Red -OffsetY -4
            Write-CenteredText "Error Details:" -Color $colors.Yellow -OffsetY -2
            Write-CenteredText $_.Exception.Message -Color $colors.Gray -OffsetY 0
            
            Write-CenteredText "Debugging Information:" -Color $colors.Yellow -OffsetY 2
            Write-CenteredText "Current Directory: $(Get-Location)" -Color $colors.Gray -OffsetY 4
            Write-CenteredText "Node Version: $(node --version)" -Color $colors.Gray -OffsetY 5
            Write-CenteredText "PNPM Version: $(pnpm --version)" -Color $colors.Gray -OffsetY 6

            if (Test-Path "$env:TEMP\pnpm-output.log") {
                Write-Host "`n`nFull Output Log:" -ForegroundColor $colors.Yellow
                Get-Content "$env:TEMP\pnpm-output.log"
            }
            if (Test-Path "$env:TEMP\pnpm-error.log") {
                Write-Host "`n`nFull Error Log:" -ForegroundColor $colors.Red
                Get-Content "$env:TEMP\pnpm-error.log"
            }
            Remove-Item "$env:TEMP\pnpm-output.log" -ErrorAction SilentlyContinue
            Remove-Item "$env:TEMP\pnpm-error.log" -ErrorAction SilentlyContinue
            Set-Location ..
            Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
            
            Write-Host "`nPress any key to exit..." -ForegroundColor $colors.Gray
            $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
            exit 1
        }

        Clear-HostScreen
        Write-CenteredText "Installation Complete! ✨" -Color $colors.Green -OffsetY -8
        Write-CenteredText "Development environment is ready!" -Color $colors.Yellow -OffsetY -6
        Write-CenteredText "Branch: $selectedBranch" -Color $colors.Gray -OffsetY -4

        Write-CenteredText "What would you like to do next?" -Color $colors.Blue -OffsetY -1
        
        $options = @(
            @{Key="1"; Name="Open in Visual Studio Code"; Action={ code $InstallDir }}
            @{Key="2"; Name="Open Folder Location"; Action={ explorer $InstallDir }}
            @{Key="3"; Name="Start Development Server"; Action={ 
                Set-Location $InstallDir
                pnpm run dev
            }}
            @{Key="4"; Name="Exit"; Action={ exit 0 }}
        )
        
        $selectedIndex = 0
        $done = $false
        
        while (-not $done) {
            foreach ($i in 0..($options.Count - 1)) {
                $option = $options[$i]
                $color = if ($i -eq $selectedIndex) { $colors.Green } else { $colors.Gray }
                $prefix = if ($i -eq $selectedIndex) { "→ " } else { "  " }
                Write-CenteredText "$prefix$($option.Key). $($option.Name)" -Color $color -OffsetY (1 + $i)
            }
            
            $key = [Console]::ReadKey($true)
            switch ($key.Key) {
                "UpArrow" { 
                    $selectedIndex = if ($selectedIndex -eq 0) { $options.Count - 1 } else { $selectedIndex - 1 }
                    Clear-HostScreen
                    Write-CenteredText "✨ Installation Complete! ✨" -Color $colors.Green -OffsetY -8
                    Write-CenteredText "Development environment is ready!" -Color $colors.Yellow -OffsetY -6
                    Write-CenteredText "Branch: $selectedBranch" -Color $colors.Gray -OffsetY -4
                    Write-CenteredText "What would you like to do next?" -Color $colors.Blue -OffsetY -1
                }
                "DownArrow" { 
                    $selectedIndex = if ($selectedIndex -eq $options.Count - 1) { 0 } else { $selectedIndex + 1 }
                    Clear-HostScreen
                    Write-CenteredText "✨ Installation Complete! ✨" -Color $colors.Green -OffsetY -8
                    Write-CenteredText "Development environment is ready!" -Color $colors.Yellow -OffsetY -6
                    Write-CenteredText "Branch: $selectedBranch" -Color $colors.Gray -OffsetY -4
                    Write-CenteredText "What would you like to do next?" -Color $colors.Blue -OffsetY -1
                }
                "Enter" { 
                    Clear-HostScreen
                    Write-CenteredText "Executing: $($options[$selectedIndex].Name)..." -Color $colors.Yellow -OffsetY -2
                    Start-Sleep -Seconds 1
                    & $options[$selectedIndex].Action
                    $done = $true
                }
            }
        }
        
        Start-Sleep -Seconds 2
        
    } catch {
        Clear-HostScreen
        Write-CenteredText "❌ Installation Failed!" -Color $colors.Red -OffsetY -4
        Write-CenteredText "Error Details:" -Color $colors.Yellow -OffsetY -2
        Write-CenteredText $_.Exception.Message -Color $colors.Gray -OffsetY 0
        exit 1
    }
}

Show-Banner
Show-CheckingDependencies
$installLocation = Get-InstallLocation
Install-Zephyr -InstallDir $installLocation
