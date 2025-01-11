#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

COLUMNS=$(tput cols)
LINES=$(tput lines)

center_text() {
    local text="$1"
    local color="$2"
    local offset="$3"

    local padding=$(( ($COLUMNS - ${#text}) / 2 ))
    local line_pos=$(( ($LINES / 2) + $offset ))
    
    tput cup $line_pos $padding
    echo -e "${color}${text}${NC}"
}

show_loading() {
    local text="$1"
    local offset="$2"
    local duration="$3"
    local spinner=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local start=$SECONDS
    
    while [ $(($SECONDS - $start)) -lt $duration ]; do
        for i in "${spinner[@]}"; do
            center_text "$text $i" "$YELLOW" "$offset"
            sleep 0.1
            tput cup $(( ($LINES / 2) + $offset )) 0
            printf "%${COLUMNS}s" " "
        done
    done
}

show_banner() {
    clear
    local banner="
███████╗███████╗██████╗ ██╗  ██╗██╗   ██╗██████╗ 
╚══███╔╝██╔════╝██╔══██╗██║  ██║╚██╗ ██╔╝██╔══██╗
  ███╔╝ █████╗  ██████╔╝███████║ ╚████╔╝ ██████╔╝
 ███╔╝  ██╔══╝  ██╔═══╝ ██╔══██║  ╚██╔╝  ██╔══██╗
███████╗███████╗██║     ██║  ██║   ██║   ██║  ██║
╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝"
    
    center_text "$banner" "$BLUE" "-5"
    center_text "Social Media Aggregator" "$NC" "1"
    center_text "Version 1.0.0 by parazeeknova" "$GRAY" "3"
    sleep 2
}

check_dependencies() {
    clear
    center_text "🔍 Checking Dependencies" "$YELLOW" "-2"
    
    local deps=("git" "docker" "node")
    local offset=0
    
    for dep in "${deps[@]}"; do
        if ! command -v $dep &> /dev/null; then
            center_text "✗ $dep not found" "$RED" "$offset"
            center_text "Please install $dep to continue" "$YELLOW" "$(($offset + 1))"
            exit 1
        else
            version=$($dep --version)
            center_text "✓ $dep $version" "$GREEN" "$offset"
        fi
        offset=$((offset + 2))
    done
    sleep 2
}

get_install_location() {
    clear
    center_text "📂 Installation Location" "$YELLOW" "-8"
    center_text "Where would you like to install Zephyr?" "$NC" "-6"
    
    local options=(
        "Current Directory ($PWD/zephyr)"
        "Home Directory ($HOME/zephyr)"
        "Custom Location"
    )
    
    local offset=-3
    center_text "Select installation location:" "$BLUE" "$offset"
    
    for i in "${!options[@]}"; do
        center_text "$((i+1)). ${options[$i]}" "$GRAY" "$((offset + 2 * (i+1)))"
    done
    
    center_text "→ " "$PURPLE" "8"
    read -r choice
    
    case $choice in
        1) echo "$PWD/zephyr";;
        2) echo "$HOME/zephyr";;
        3) 
            clear
            center_text "Enter custom installation path:" "$YELLOW" "-2"
            center_text "→ " "$PURPLE" "0"
            read -r custom_path
            echo "$custom_path"
            ;;
        *) echo "$PWD/zephyr";;
    esac
}

select_branch() {
    clear
    center_text "🌿 Select Branch" "$YELLOW" "-8"
    
    local branches=(
        "main:Stable release branch focused on production"
        "development:Development branch (recommended)"
    )
    
    local selected=0
    local done=false
    
    while [ "$done" = false ]; do
        clear
        center_text "🌿 Select Branch" "$YELLOW" "-8"
        center_text "Use UP/DOWN arrows to select, ENTER to confirm" "$GRAY" "-6"
        
        for i in "${!branches[@]}"; do
            IFS=':' read -r name desc <<< "${branches[$i]}"
            if [ $i -eq $selected ]; then
                center_text "→ $((i+1)). $name" "$GREEN" "$((-3 + 2 * i))"
                center_text "   $desc" "$BLUE" "$((-2 + 2 * i))"
            else
                center_text "  $((i+1)). $name" "$GRAY" "$((-3 + 2 * i))"
            fi
        done
        
        read -rsn1 key
        case "$key" in
            A) # Up arrow
                [ $selected -eq 0 ] && selected=$((${#branches[@]}-1)) || selected=$((selected-1))
                ;;
            B) # Down arrow
                [ $selected -eq $((${#branches[@]}-1)) ] && selected=0 || selected=$((selected+1))
                ;;
            "") # Enter
                done=true
                ;;
        esac
    done
    
    IFS=':' read -r name _ <<< "${branches[$selected]}"
    echo "$name"
}

install_zephyr() {
    local install_dir="$1"
    clear
    center_text "⚡ Installing Zephyr" "$YELLOW" "-2"
    center_text "Location: $install_dir" "$GRAY" "0"
    
    if [ -d "$install_dir" ]; then
        show_loading "Cleaning existing directory" "2" "3"
        rm -rf "$install_dir"
    fi
    
    branch=$(select_branch)
    show_loading "Cloning Zephyr repository" "2" "3"
    git clone -b "$branch" https://github.com/parazeeknova/zephyr.git "$install_dir" -q
    
    cd "$install_dir" || exit
    
    clear
    center_text "📦 Installing Dependencies" "$YELLOW" "-2"
    
    if ! command -v pnpm &> /dev/null; then
        center_text "Installing pnpm..." "$GRAY" "0"
        npm install -g pnpm
    fi
    
    clear
    center_text "🚀 Starting Development Environment" "$YELLOW" "-2"
    center_text "This may take a few minutes..." "$GRAY" "0"
    
    echo -e "\n\n📋 Project Logs:"
    echo -e "${GRAY}===============================${NC}\n"
    
    pnpm run start 2>&1 | while IFS= read -r line; do
        echo -e "${NC}$line"
    done
    
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        clear
        center_text "❌ Startup Failed!" "$RED" "-4"
        center_text "Please check the logs above for details." "$YELLOW" "-2"
        exit 1
    fi
    
    clear
    center_text "✨ Installation Complete! ✨" "$GREEN" "-6"
    center_text "Development environment is ready!" "$YELLOW" "-4"
    center_text "Branch: $branch" "$GRAY" "-2"
    sleep 5
}

show_banner
check_dependencies
install_dir=$(get_install_location)
install_zephyr "$install_dir"
