# Windows Specs Auto-Detection Script for Local LLM Matcher
# Run with: powershell -c "irm https://llm-matcher.vercel.app/detect-specs.ps1 | iex"

$ErrorActionPreference = "SilentlyContinue"
Clear-Host

Write-Host "===============================================" -ForegroundColor Green
Write-Host "    🖥️  LOCAL LLM MATCHER - HARDWARE DETECT    " -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host "Scanning your hardware configuration... Please wait.`n" -ForegroundColor Cyan

# 1. OS Info
$osName = "Windows"

# 2. CPU Specs
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$cpuLabel = $cpu.Name.Trim() -replace '\s+', ' '
$cpuCores = $cpu.NumberOfCores
if (-not $cpuCores) { $cpuCores = [Environment]::ProcessorCount }

# Determine CPU Tier
$cpuTier = "mid"
if ($cpuLabel -like "*i9*" -or $cpuLabel -like "*Ryzen 9*" -or $cpuLabel -like "*Threadripper*" -or $cpuLabel -like "*Xeon*") {
    $cpuTier = "ultra"
} elseif ($cpuLabel -like "*i7*" -or $cpuLabel -like "*Ryzen 7*") {
    $cpuTier = "high"
} elseif ($cpuLabel -like "*i5*" -or $cpuLabel -like "*Ryzen 5*") {
    $cpuTier = "mid"
} else {
    $cpuTier = "low"
}

# 3. System RAM
$ramBytes = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
$ramGB = [Math]::Round($ramBytes / 1GB)

# RAM Bandwidth factor based on Speed (DDR4 vs DDR5)
$ramSpeed = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Speed -Maximum).Maximum
$ramBandwidth = 51
$ramTypeLabel = "DDR4"
if ($ramSpeed -ge 4800) {
    $ramBandwidth = 77
    $ramTypeLabel = "DDR5"
}

# 4. Storage Type (NVMe vs SATA)
$ssdType = "sata"
$disk = Get-PhysicalDisk | Where-Object { $_.MediaType -eq "SSD" } | Select-Object -First 1
if ($disk) {
    if ($disk.FriendlyName -like "*NVMe*" -or $disk.BusType -eq "NVMe" -or $disk.Model -like "*NVMe*") {
        $ssdType = "nvme"
    }
}

# 5. GPU & VRAM
$gpus = Get-CimInstance Win32_VideoController
# Filter out integrated controllers if discrete GPU exists
$discreteGpu = $gpus | Where-Object { $_.AdapterRAM -gt 2GB } | Select-Object -First 1
if (-not $discreteGpu) {
    $discreteGpu = $gpus | Where-Object { $_.Name -notmatch "Intel\(R\) HD" -and $_.Name -notmatch "Microsoft Basic" -and $_.Name -notmatch "AMD Radeon\(TM\) Graphics" } | Select-Object -First 1
}
if (-not $discreteGpu) {
    $discreteGpu = $gpus | Select-Object -First 1
}

$gpuLabel = "No GPU (CPU only)"
$gpuVRAM = 0
$isUnified = $false

if ($discreteGpu -and $discreteGpu.Name -notmatch "Microsoft Basic") {
    $gpuLabel = $discreteGpu.Name.Trim() -replace '\s+', ' '
    
    # Handle WMI negative number AdapterRAM overflow for large buffers (>2GB signed 32-bit overflow)
    $rawVram = $discreteGpu.AdapterRAM
    if ($rawVram -lt 0) {
        $rawVram = [uint32]$rawVram
    }
    $gpuVRAM = [Math]::Round($rawVram / 1GB)
    
    # Precise VRAM correction mapping for known cards if WMI reports 0 or inaccurate values
    if ($gpuVRAM -eq 0 -or $gpuVRAM -gt 48) {
        if ($gpuLabel -like "*RTX 5090*") { $gpuVRAM = 32 }
        elseif ($gpuLabel -like "*RTX 5080*") { $gpuVRAM = 16 }
        elseif ($gpuLabel -like "*RTX 4090*") { $gpuVRAM = 24 }
        elseif ($gpuLabel -like "*RTX 4080*") { $gpuVRAM = 16 }
        elseif ($gpuLabel -like "*RTX 4070 Ti*") { $gpuVRAM = 16 }
        elseif ($gpuLabel -like "*RTX 4070*") { $gpuVRAM = 12 }
        elseif ($gpuLabel -like "*RTX 4060 Ti*") { $gpuVRAM = 16 } # could be 8, assume 16 for safety
        elseif ($gpuLabel -like "*RTX 4060*") { $gpuVRAM = 8 }
        elseif ($gpuLabel -like "*RTX 3090*") { $gpuVRAM = 24 }
        elseif ($gpuLabel -like "*RTX 3080 Ti*") { $gpuVRAM = 12 }
        elseif ($gpuLabel -like "*RTX 3080*") { $gpuVRAM = 10 }
        elseif ($gpuLabel -like "*RTX 3070*") { $gpuVRAM = 8 }
        elseif ($gpuLabel -like "*RTX 3060 Ti*") { $gpuVRAM = 8 }
        elseif ($gpuLabel -like "*RTX 3060*") { $gpuVRAM = 12 }
        elseif ($gpuLabel -like "*RTX 2080 Ti*") { $gpuVRAM = 11 }
        elseif ($gpuLabel -like "*RTX 2080*") { $gpuVRAM = 8 }
        elseif ($gpuLabel -like "*RTX 2060*") { $gpuVRAM = 6 }
        elseif ($gpuLabel -like "*GTX 1080 Ti*") { $gpuVRAM = 11 }
        elseif ($gpuLabel -like "*GTX 1080*") { $gpuVRAM = 8 }
        elseif ($gpuLabel -like "*RX 7900 XTX*") { $gpuVRAM = 24 }
        elseif ($gpuLabel -like "*RX 7900 XT*") { $gpuVRAM = 20 }
        elseif ($gpuLabel -like "*RX 7800 XT*") { $gpuVRAM = 16 }
        elseif ($gpuLabel -like "*RX 7700 XT*") { $gpuVRAM = 12 }
        elseif ($gpuLabel -like "*RX 7600*") { $gpuVRAM = 8 }
        elseif ($gpuLabel -like "*RX 6900 XT*") { $gpuVRAM = 16 }
        elseif ($gpuLabel -like "*RX 6800 XT*") { $gpuVRAM = 16 }
        elseif ($gpuLabel -like "*RX 6800*") { $gpuVRAM = 16 }
        elseif ($gpuLabel -like "*RX 6700 XT*") { $gpuVRAM = 12 }
        elseif ($gpuLabel -like "*RX 6600 XT*") { $gpuVRAM = 8 }
        elseif ($gpuLabel -like "*Arc A770*") { $gpuVRAM = 16 }
        elseif ($gpuLabel -like "*Arc A750*") { $gpuVRAM = 8 }
        elseif ($gpuLabel -like "*Arc A580*") { $gpuVRAM = 8 }
        else { $gpuVRAM = 8 } # Generic safe discrete GPU VRAM size
    }
}

# Print Scan Summary
Write-Host "[✓] OS:       $osName" -ForegroundColor Green
Write-Host "[✓] CPU:      $cpuLabel ($cpuCores Cores)" -ForegroundColor Green
Write-Host "[✓] RAM:      $ramGB GB ($ramTypeLabel at $ramSpeed MHz)" -ForegroundColor Green
Write-Host "[✓] GPU:      $gpuLabel ($gpuVRAM GB VRAM)" -ForegroundColor Green
Write-Host "[✓] Drive:    SSD ($ssdType type)" -ForegroundColor Green

# 6. Open Web Application
$baseUrl = "https://llm-matcher.vercel.app"
$params = @{
    gpu   = $gpuLabel
    vram  = $gpuVRAM
    ram   = $ramGB
    cpu   = $cpuLabel
    ctier = $cpuTier
    ssd   = $ssdType
    os    = $osName
    uni   = if ($isUnified) { "1" } else { "0" }
    ramt  = $ramTypeLabel
    rambw = $ramBandwidth
}

# Construct escaping query string
$queryParts = @()
foreach ($key in $params.Keys) {
    $val = [uri]::EscapeDataString($params[$key].ToString())
    $queryParts += "$key=$val"
}
$queryString = $queryParts -join "&"
$fullUrl = "$baseUrl/?$queryString"

Write-Host "`n🚀 Hardware specs scanned successfully!" -ForegroundColor Green
Write-Host "Opening your browser with your custom URL..." -ForegroundColor Cyan
Write-Host "$fullUrl`n" -ForegroundColor DarkGray

Start-Process $fullUrl
