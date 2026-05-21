#!/bin/bash
# macOS / Linux Specs Auto-Detection Script for Local LLM Matcher
# Run with: curl -s https://llmmatcher.app/detect-specs.sh | bash

echo "==============================================="
echo "    🖥️  LOCAL LLM MATCHER - HARDWARE DETECT    "
echo "==============================================="
echo "Scanning your hardware configuration... Please wait."
echo ""

# Initialize variables
OS="Linux"
CPU_LABEL="Generic CPU"
CPU_CORES=4
CPU_TIER="mid"
RAM_GB=16
GPU_LABEL="No GPU (CPU only)"
GPU_VRAM=0
IS_UNIFIED="0"
RAM_TYPE="DDR4"
RAM_BW=51
SSD_TYPE="nvme"

# Detect OS type
UNAME_S=$(uname -s)

if [ "$UNAME_S" = "Darwin" ]; then
    OS="macOS"
    
    # CPU info
    CPU_LABEL=$(sysctl -n machdep.cpu.brand_string)
    CPU_CORES=$(sysctl -n hw.physicalcpu)
    
    # Total RAM in GB
    RAM_BYTES=$(sysctl -n hw.memsize)
    RAM_GB=$((RAM_BYTES / 1024 / 1024 / 1024))
    
    # Detect Apple Silicon
    if [[ "$CPU_LABEL" == *"Apple"* ]]; then
        IS_UNIFIED="1"
        GPU_LABEL="$CPU_LABEL"
        GPU_VRAM="$RAM_GB"
        RAM_TYPE="Unified"
        
        # Bandwidth approximations based on Apple Silicon tier
        if [[ "$CPU_LABEL" == *"Ultra"* ]]; then
            RAM_BW=800
            CPU_TIER="ultra"
        elif [[ "$CPU_LABEL" == *"Max"* ]]; then
            RAM_BW=300
            CPU_TIER="ultra"
        elif [[ "$CPU_LABEL" == *"Pro"* ]]; then
            RAM_BW=150
            CPU_TIER="high"
        else
            RAM_BW=100
            CPU_TIER="high"
        fi
    else
        # Intel Mac discrete GPU detection
        GPU_INFO=$(system_profiler SPDisplaysDataType 2>/dev/null)
        GPU_NAME=$(echo "$GPU_INFO" | grep -A 2 -i "Chipset Model" | head -n1 | cut -d: -f2- | xargs)
        GPU_VRAM_RAW=$(echo "$GPU_INFO" | grep -i "VRAM" | head -n1 | cut -d: -f2- | xargs)
        
        if [ ! -z "$GPU_NAME" ]; then
            GPU_LABEL="$GPU_NAME"
            # Extract number of GB from VRAM string (e.g. "4 GB" or "4096 MB")
            if [[ "$GPU_VRAM_RAW" == *"GB"* ]]; then
                GPU_VRAM=$(echo "$GPU_VRAM_RAW" | grep -oE "[0-9]+")
            elif [[ "$GPU_VRAM_RAW" == *"MB"* ]]; then
                MB=$(echo "$GPU_VRAM_RAW" | grep -oE "[0-9]+")
                GPU_VRAM=$((MB / 1024))
            fi
        fi
        
        if [ "$CPU_CORES" -gt 6 ]; then
            CPU_TIER="high"
        else
            CPU_TIER="mid"
        fi
    fi
    SSD_TYPE="nvme" # Almost all modern Macs use NVMe-speed storage

else
    # Linux
    OS="Linux"
    
    # CPU info
    CPU_LABEL=$(grep -i "model name" /proc/cpuinfo | head -n1 | cut -d: -f2- | xargs)
    CPU_CORES=$(nproc)
    
    # Total RAM in GB
    RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    RAM_GB=$((RAM_KB / 1024 / 1024))
    
    # CPU Tier
    if [[ "$CPU_LABEL" == *"i9"* || "$CPU_LABEL" == *"Ryzen 9"* || "$CPU_LABEL" == *"Xeon"* || "$CPU_LABEL" == *"Threadripper"* ]]; then
        CPU_TIER="ultra"
    elif [[ "$CPU_LABEL" == *"i7"* || "$CPU_LABEL" == *"Ryzen 7"* ]]; then
        CPU_TIER="high"
    elif [[ "$CPU_LABEL" == *"i5"* || "$CPU_LABEL" == *"Ryzen 5"* ]]; then
        CPU_TIER="mid"
    else
        CPU_TIER="low"
    fi
    
    # GPU detection via lspci or nvidia-smi
    if command -v nvidia-smi &> /dev/null; then
        # NVIDIA GPU
        GPU_LABEL=$(nvidia-smi --query-gpu=gpu_name --format=csv,noheader | head -n1)
        VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n1)
        GPU_VRAM=$((VRAM_MB / 1024))
    elif command -v rocm-smi &> /dev/null; then
        # AMD ROCm
        GPU_LABEL="AMD Radeon GPU"
        # AMD cards might require parsing lspci
        LSPCI_AMD=$(lspci | grep -i 'VGA\|3D' | grep -i 'AMD\|Radeon' | head -n1 | cut -d: -f3- | xargs)
        if [ ! -z "$LSPCI_AMD" ]; then GPU_LABEL="$LSPCI_AMD"; fi
        GPU_VRAM=16 # Default AMD ROCm guess
    else
        # Fallback lspci
        LSPCI_VGA=$(lspci | grep -i 'VGA\|3D' | grep -iv 'intel\|integrated' | head -n1 | cut -d: -f3- | xargs)
        if [ ! -z "$LSPCI_VGA" ]; then
            GPU_LABEL="$LSPCI_VGA"
            GPU_VRAM=8 # default fallback VRAM
        fi
    fi
    
    # Storage check
    if grep -q "nvme" /proc/diskstats; then
        SSD_TYPE="nvme"
    else
        SSD_TYPE="sata"
    fi
fi

# Print summary
echo "[✓] OS:       $OS"
echo "[✓] CPU:      $CPU_LABEL ($CPU_CORES Cores)"
echo "[✓] RAM:      $RAM_GB GB"
echo "[✓] GPU:      $GPU_LABEL ($GPU_VRAM GB VRAM)"
echo "[✓] Drive:    SSD ($SSD_TYPE type)"
echo ""

# URL Encode helper
urlencode() {
    local string="${1}"
    local strlen="${#string}"
    local encoded=""
    local pos c o

    for (( pos=0 ; pos<strlen ; pos++ )); do
        c=${string:$pos:1}
        case "$c" in
            [-_.~a-zA-Z0-9] ) encoded+="${c}" ;;
            * ) printf -v o '%%%02X' "'$c"
                encoded+="${o}" ;;
        esac
    done
    echo "${encoded}"
}

# Construct URL params
GPU_ESC=$(urlencode "$GPU_LABEL")
CPU_ESC=$(urlencode "$CPU_LABEL")
CTIER_ESC=$(urlencode "$CPU_TIER")
RAMT_ESC=$(urlencode "$RAM_TYPE")
OS_ESC=$(urlencode "$OS")

BASE_URL="https://llmmatcher.app"
FULL_URL="${BASE_URL}/?gpu=${GPU_ESC}&vram=${GPU_VRAM}&ram=${RAM_GB}&cpu=${CPU_ESC}&ctier=${CTIER_ESC}&ssd=${SSD_TYPE}&os=${OS_ESC}&uni=${IS_UNIFIED}&ramt=${RAMT_ESC}&rambw=${RAM_BW}"

echo "🚀 Hardware specs scanned successfully!"
echo "Opening browser to pre-populated URL..."
echo "$FULL_URL"
echo ""

# Launch browser based on platform
if [ "$UNAME_S" = "Darwin" ]; then
    open "$FULL_URL"
else
    if command -v xdg-open &> /dev/null; then
        xdg-open "$FULL_URL"
    elif command -v sensible-browser &> /dev/null; then
        sensible-browser "$FULL_URL"
    else
        echo "Could not find a browser launcher. Please copy the URL above manually."
    fi
fi
