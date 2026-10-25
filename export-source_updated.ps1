# Use PowerShell Core (pwsh) to run this script, not Windows PowerShell. The script is designed to be cross-platform and may not work correctly in Windows PowerShell.
# & "C:\Users\budap\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe" -NoProfile -ExecutionPolicy Bypass -File "C:\novy\ngdynamic-codeline\export-source_updated.ps1" -Root "C:\novy\ngdynamic-codeline" -Output "project-snapshot.md" -UseGit -Mode data

# Alternatively, you can run the script from a PowerShell Core prompt:
# pwsh -NoProfile -ExecutionPolicy Bypass `
#   -File "C:\novy\ngdynamic-codeline\export-source_updated.ps1" `
#   -Root "." `
#   -Output "project-snapshot.md" `
#   -UseGit -Mode data

# .\export-source_updated.ps1 -Output "plexus-source-export.md" -UseGit -Mode all
# -Mode data: source + measurement data; -Mode full: also embeds audio as Base64.
param(
    [string]$Root = ".",
    [string]$Output = "source-export.md",
    [switch]$UseGit,
    [ValidateSet("developer", "test", "docs", "all", "data", "full")]
    [string]$Mode
)

$ErrorActionPreference = "Stop"

$AllExtensions = @(
    ".ts", ".tsx", ".mts", ".cts",
    ".js", ".jsx", ".mjs", ".cjs",
    ".css", ".scss", ".html",
    ".json", ".md", ".mdx", ".txt",
    ".svg",
    ".ps1", ".sh",
    ".yml", ".yaml", ".py", ".toml"
)

$DeveloperExtensions = @(
    ".ts", ".tsx", ".mts", ".cts",
    ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".py"
)

$DocumentExtensions = @(
    ".md", ".mdx", ".txt"
)

$AudioExtensions = @(".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".opus", ".aif", ".aiff")
$DataExtensions = @(".json", ".jsonl", ".csv", ".tsv", ".txt", ".md", ".mdx")
# These paths contain inputs, snapshots and generated measurements, not runtime source.
# Executable helpers inside them still follow the ordinary source filters.
$DataPaths = @(
    "tests/fixtures/",
    "tests/audio/",
    "documents/tests/fixtures/",
    "research/analyzer-lab/fixtures/",
    "research/analyzer-lab/diagnostics/",
    "research/analyzer-lab/runs/",
    "research/analyzer-lab/data/",
    "research/analyzer-lab/tmp/",
    "research/analyzer-lab/tools/harness/inventories/",
    "research/analyzer-lab/tools/harness/history/"
)

$ExcludeDirs = @(
    "node_modules",
    "dist",
    "build",
    ".git",
    ".vite",
    ".cache",
    "coverage",
    ".pnpm-store", ".venv", "__pycache__", ".pytest_cache", "graphify-out"
)

$ExcludeFiles = @(
    "package-lock.json",
    "bun.lock",
    "vite-dev.log",
    "vite-dev.err.log",
    "vite-smoke.out.log",
    "vite-smoke.err.log",
    "branch_pr_snapshot.md"
)

function Select-ExportMode {
    Write-Host ""
    Write-Host "Mit gyujtsek ossze?" -ForegroundColor Cyan
    Write-Host "1 - Csak fejlesztoi fajlok (ts, js, json, py; tesztek es meresi adatok nelkul)"
    Write-Host "2 - Csak teszt fajlok (*.spec.*, *.test.*, vite/vitest/jest tesztek)"
    Write-Host "3 - Csak dokumentumok (md, mdx, txt)"
    Write-Host "4 - Minden forras (hangfajlok es meresi adatok nelkul; ajanlott)"
    Write-Host "5 - Minden forras + teszt/analyzer adatok (hangfajlok nelkul)"
    Write-Host "6 - Teljes export: forras + adatok + hangfajlok (Base64, nagy meret!)"
    Write-Host ""

    do {
        $choice = Read-Host "Valasztas [1-6]"
    } until ($choice -in @("1", "2", "3", "4", "5", "6"))

    switch ($choice) {
        "1" { return "developer" }
        "2" { return "test" }
        "3" { return "docs" }
        "4" { return "all" }
        "5" { return "data" }
        "6" { return "full" }
    }
}

function Get-ExportModeLabel {
    param([string]$Mode)

    switch ($Mode) {
        "developer" { return "Csak fejlesztoi fajlok" }
        "test" { return "Csak teszt fajlok" }
        "docs" { return "Csak dokumentumok" }
        "all" { return "Minden forras (hangfajlok es meresi adatok nelkul)" }
        "data" { return "Minden forras + teszt/analyzer adatok (hangfajlok nelkul)" }
        "full" { return "Teljes export (forras, adatok, Base64 hangfajlok)" }
    }
}

function Test-IsTestFile {
    param([System.IO.FileInfo]$File)

    $name = $File.Name.ToLower()
    $relative = $File.FullName.Substring($RootPath.Length).ToLower()

    if ($name -match "\.(spec|test)\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$") {
        return $true
    }


    if ($name -match "\.(e2e|cy)\.(ts|tsx|js|jsx|mjs|cjs)$") {
        return $true
    }

    if ($name -match "(^test_.*|.*_test)\.py$") {
        return $true
    }

    if ($relative -match "[\\/](test|tests|__tests__|spec|specs|e2e|cypress)[\\/]") {
        return $true
    }

    return $false
}

function Should-IncludeFile {
    param(
        [System.IO.FileInfo]$File,
        [string]$Mode
    )

    if ($File.FullName -eq $OutputPath) {
        return $false
    }

    if ($ExcludeFiles -contains $File.Name) {
        return $false
    }

    foreach ($dir in $ExcludeDirs) {
        if ($File.FullName -match "[\\/]$([regex]::Escape($dir))[\\/]") {
            return $false
        }
    }

    $relative = $File.FullName.Substring($RootPath.Length).TrimStart([char[]]"\/").Replace('\', '/')
    if ($relative -match '(^|/)[^/]+\.local/' -or $relative -match '(^|/)[^/]+\.egg-info/') {
        return $false
    }

    $ext = $File.Extension.ToLower()
    # Recognize the output header rather than excluding legitimate source-export docs by name.
    if ($ext -in @(".md", ".mdx", ".txt")) {
        $reader = [System.IO.File]::OpenText($File.FullName)
        try {
            $header = New-Object char[] 128
            $count = $reader.Read($header, 0, $header.Length)
            if (([string]::new($header, 0, $count)) -match '^(# Source Export|<!-- source-export:v2 -->)(\r?\n|$)') {
                return $false
            }
        } finally {
            $reader.Dispose()
        }
    }

    if ($AudioExtensions -contains $ext) {
        return ($Mode -eq "full")
    }

    $isData = $false
    if ($DataExtensions -contains $ext) {
        foreach ($prefix in $DataPaths) {
            if ($relative.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                $isData = $true
                break
            }
        }
    }
    if ($isData -and $Mode -notin @("data", "full")) {
        return $false
    }

    $isTest = Test-IsTestFile $File

    switch ($Mode) {
        "developer" {
            return (($DeveloperExtensions -contains $ext) -and (-not $isTest))
        }
        "test" {
            return (($DeveloperExtensions -contains $ext) -and $isTest)
        }
        "docs" {
            return ($DocumentExtensions -contains $ext)
        }
        "all" {
            return ($AllExtensions -contains $ext)
        }
        { $_ -in @("data", "full") } {
            return (($AllExtensions -contains $ext) -or ($DataExtensions -contains $ext))
        }
    }

    return $false
}

function Get-SourceLineCount {
    param([System.IO.FileInfo]$File)

    $lineCount = 0
    $reader = [System.IO.File]::OpenText($File.FullName)

    try {
        while ($null -ne $reader.ReadLine()) {
            $lineCount++
        }
    } finally {
        $reader.Close()
    }

    return $lineCount
}

function Get-FileCategory {
    param(
        [System.IO.FileInfo]$File,
        [string]$Mode
    )

    $ext = $File.Extension.ToLower()

    if ($AudioExtensions -contains $ext) {
        return "Hang"
    }

    # Az eredeti viselkedés megtartása: „Minden” módban a tesztfájlok
    # továbbra is a nyelvi kategóriájukba számítanak, nem külön Teszt sorba.
    # Külön Teszt kategória csak a „Csak teszt fájlok” módban jelenik meg.
    if (($Mode -eq "test") -and (Test-IsTestFile $File)) {
        return "Teszt"
    }

    if (@(".ts", ".tsx", ".mts", ".cts") -contains $ext) {
        return "TypeScript"
    }

    if (@(".js", ".jsx", ".mjs", ".cjs") -contains $ext) {
        return "JavaScript"
    }

    if (@(".md", ".mdx", ".txt") -contains $ext) {
        return "Dokumentacio"
    }

    return "Egyeb"
}

function Format-Kb {
    param([long]$Bytes)
    return "{0:N1}" -f ($Bytes / 1KB)
}

function Write-Separator {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkGray
}

function Write-StatRow {
    param(
        [string]$Label,
        [int]$Files,
        [int]$Lines,
        [long]$Bytes
    )

    $kb = Format-Kb $Bytes
    Write-Host ("{0,-16} {1,8} fajl {2,10} sor {3,10} KB" -f $Label, $Files, $Lines, $kb)
}

$RootPath = (Resolve-Path -LiteralPath $Root).ProviderPath
$OutputPath = if ([System.IO.Path]::IsPathRooted($Output)) {
    [System.IO.Path]::GetFullPath($Output)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $RootPath $Output))
}
$ExportMode = if ($Mode) { $Mode } else { Select-ExportMode }
$ExportModeLabel = Get-ExportModeLabel $ExportMode

Write-Separator
Write-Host "Plexus source export inditasa" -ForegroundColor Cyan
Write-Host "Gyoker:  $RootPath"
Write-Host "Kimenet: $OutputPath"
Write-Host "Mod:     $ExportModeLabel"
Write-Host "Forras:  $(if ($UseGit) { 'git ls-files' } else { 'fajlrendszer' })"

if ($UseGit) {
    $files = git -C $RootPath -c core.quotepath=false ls-files | ForEach-Object {
        $relativePath = $_.Trim()

        if ([string]::IsNullOrWhiteSpace($relativePath)) {
            return
        }

        $path = Join-Path -Path $RootPath -ChildPath $relativePath

        if (Test-Path -LiteralPath $path -PathType Leaf) {
            Get-Item -LiteralPath $path
        }
    } | Where-Object {
        $_ -and (Should-IncludeFile $_ $ExportMode)
    }
} else {
    $files = Get-ChildItem -LiteralPath $RootPath -Recurse -File | Where-Object {
        Should-IncludeFile $_ $ExportMode
    }
}

if ($UseGit -and $LASTEXITCODE -ne 0) {
    throw "A git ls-files sikertelen; nem keszult ervenyes export."
}
if ($UseGit -and $ExportMode -eq "full") {
    # Local music is intentionally gitignored; only this explicit mode scans it.
    $files = @($files) + @(Get-ChildItem -LiteralPath $RootPath -Recurse -File | Where-Object {
        ($AudioExtensions -contains $_.Extension.ToLower()) -and (Should-IncludeFile $_ $ExportMode)
    })
}

$files = @($files | Sort-Object FullName -Unique)

"# Source Export" | Out-File -LiteralPath $OutputPath -Encoding UTF8
"`nRoot: $RootPath`nMode: $ExportModeLabel`nGenerated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8

$fileStats = @{}
$totals = @{
    TypeScript = @{ Files = 0; Lines = 0; Bytes = 0L }
    JavaScript = @{ Files = 0; Lines = 0; Bytes = 0L }
    Teszt = @{ Files = 0; Lines = 0; Bytes = 0L }
    Dokumentacio = @{ Files = 0; Lines = 0; Bytes = 0L }
    Egyeb = @{ Files = 0; Lines = 0; Bytes = 0L }
    Hang = @{ Files = 0; Lines = 0; Bytes = 0L }
    Osszesen = @{ Files = 0; Lines = 0; Bytes = 0L }
}

foreach ($file in $files) {
    $lineCount = if ($AudioExtensions -contains $file.Extension.ToLower()) { 0 } else { Get-SourceLineCount $file }
    $category = Get-FileCategory $file $ExportMode
    $bytes = $file.Length

    $fileStats[$file.FullName] = @{
        Lines = $lineCount
        Bytes = $bytes
        Category = $category
    }

    ($totals[$category]).Files++
    ($totals[$category]).Lines += $lineCount
    ($totals[$category]).Bytes += $bytes

    $totals.Osszesen.Files++
    $totals.Osszesen.Lines += $lineCount
    $totals.Osszesen.Bytes += $bytes
}

"`n## Osszesites`n" | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
"| Kategoria | Fajlok | Sorok | Meret KB |" | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
"|---|---:|---:|---:|" | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
$DisplayCategories = @("TypeScript", "JavaScript", "Dokumentacio", "Egyeb")
if ($ExportMode -eq "test") {
    $DisplayCategories = @("Teszt")
}
if ($ExportMode -eq "full") {
    $DisplayCategories += "Hang"
}

foreach ($category in ($DisplayCategories + @("Osszesen"))) {
    $stat = $totals[$category]
    "| $category | $($stat.Files) | $($stat.Lines) | $(Format-Kb $stat.Bytes) |" | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
}

"`n## Project Structure`n" | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8

foreach ($file in $files) {
    $relative = $file.FullName.Substring($RootPath.Length).TrimStart([char[]]"\/").Replace('\', '/')
    $stat = $fileStats[$file.FullName]
    $kb = Format-Kb $stat.Bytes
    "- $relative ($($stat.Category), $($stat.Lines) sor, $kb KB)" | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
}

foreach ($file in $files) {
    $relative = $file.FullName.Substring($RootPath.Length).TrimStart([char[]]"\/").Replace('\', '/')
    $ext = $file.Extension.TrimStart(".").ToLower()
    $stat = $fileStats[$file.FullName]
    $kb = Format-Kb $stat.Bytes

    "`n---`n" | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
    "## $relative`n" | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
    "Kategoria: $($stat.Category)  " | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
    "Sorok: $($stat.Lines)  " | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
    "Meret: $kb KB`n" | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
    if ($AudioExtensions -contains $file.Extension.ToLower()) {
        "Kodolas: Base64 (az eredeti hangfajl bajtjai); a sorszam 0.`n" | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
        '```base64' | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
        $stream = [System.IO.File]::OpenRead($file.FullName)
        $writer = [System.IO.StreamWriter]::new($OutputPath, $true, [System.Text.UTF8Encoding]::new($false))
        try {
            $buffer = New-Object byte[] (3 * 4096)
            while (($count = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                $writer.WriteLine([Convert]::ToBase64String($buffer, 0, $count))
            }
        } finally {
            $stream.Dispose()
            $writer.Dispose()
        }
    } else {
        ('```' + $ext) | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
        Get-Content -LiteralPath $file.FullName -Raw | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
    }
    '```' | Out-File -LiteralPath $OutputPath -Append -Encoding UTF8
}

Write-Separator
Write-Host "Export kesz" -ForegroundColor Green
Write-Host "Kimeneti fajl: $OutputPath"
Write-Separator
Write-Host "Osszesites" -ForegroundColor Cyan
foreach ($category in $DisplayCategories) {
    Write-StatRow $category ($totals[$category]).Files ($totals[$category]).Lines ($totals[$category]).Bytes
}
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-StatRow "Osszesen" $totals.Osszesen.Files $totals.Osszesen.Lines $totals.Osszesen.Bytes
Write-Separator
