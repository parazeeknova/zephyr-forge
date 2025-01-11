#!/bin/bash

# =============================================================================
#                         ZEPHYR INSTALLER
#                      Linux/Unix Installation Script
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

TERM_WIDTH=$(tput cols)
TERM_HEIGHT=$(tput lines)

center_text() {
    local text="$1"
    local color="${2:-$NC}"
    local padding=$3
    local text_length=${#text}
    local spaces=$(( (TERM_WIDTH - text_length) / 2 ))
    printf "%${spaces}s" ""
    echo -e "${color}${text}${NC}"
}

clear_screen() {
    clear
    echo -e "\n\n\n"
}

show_spinner() {
    local pid=$1
    local message="$2"
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf "\r%s [%c]  " "$message" "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep 0.1
    done
    printf "\r%s [✓]   \n" "$message"
}

print_banner() {
    clear_screen
    center_text "███████╗███████╗██████╗ ██╗  ██╗██╗   ██╗██████╗ " "$BLUE"
    center_text "╚══███╔╝██╔════╝██╔══██╗██║  ██║╚██╗ ██╔╝██╔══██╗" "$BLUE"
    center_text "  ███╔╝ █████╗  ██████╔╝███████║ ╚████╔╝ ██████╔╝" "$BLUE"
    center_text " ███╔╝  ██╔══╝  ██╔═══╝ ██╔══██║  ╚██╔╝  ██╔══██╗" "$BLUE"
    center_text "███████╗███████╗██║     ██║  ██║   ██║   ██║  ██║" "$BLUE"
    center_text "╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝" "$BLUE"
    center_text "Social Media Aggregator" "$GRAY"
    center_text "Version 1.0.0 by parazeeknova" "$GRAY"
    sleep 2
}

check_dependencies() {
    clear_screen
    center_text "🔍 Checking Dependencies" "$YELLOW"
    echo

    local deps=("git" "docker" "node" "npm")
    local all_deps_installed=true

    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            center_text "✗ $dep not found" "$RED"
            center_text "Please install $dep to continue" "$YELLOW"
            all_deps_installed=false
        else
            local version
            case $dep in
                "git") version=$(git --version | cut -d' ' -f3) ;;
                "docker") version=$(docker --version | cut -d' ' -f3 | tr -d ',') ;;
                "node") version=$(node --version) ;;
                "npm") version=$(npm --version) ;;
            esac
            center_text "✓ $dep $version" "$GREEN"
        fi
    done

    if [ "$all_deps_installed" = false ]; then
        exit 1
    fi
    sleep 2
}

get_install_location() {
    clear_screen
    center_text "📂 Installation Location" "$YELLOW"
    echo
    center_text "Where would you like to install Zephyr?" "$GRAY"
    echo
    
    PS3=$'\n'"→ Select an option (1-5): "
    options=("Current Directory" "Home Directory" "Desktop" "Documents" "Custom Location")
    
    select opt in "${options[@]}"; do
        case $opt in
            "Current Directory")
                INSTALL_DIR="$PWD/zephyr"
                break
                ;;
            "Home Directory")
                INSTALL_DIR="$HOME/zephyr"
                break
                ;;
            "Desktop")
                INSTALL_DIR="$HOME/Desktop/zephyr"
                break
                ;;
            "Documents")
                INSTALL_DIR="$HOME/Documents/zephyr"
                break
                ;;
            "Custom Location")
                read -p "Enter custom path: " custom_path
                INSTALL_DIR="$custom_path"
                break
                ;;
            *) echo "Invalid option" ;;
        esac
    done
    
    echo
    center_text "Selected location: $INSTALL_DIR" "$BLUE"
    sleep 2
    return 0
}

select_branch() {
    clear_screen
    center_text "🌿 Select Branch" "$YELLOW"
    echo
    
    PS3=$'\n'"→ Select a branch (1-2): "
    branches=("main (Stable release branch)" "development (Development branch)")
    
    select branch in "${branches[@]}"; do
        case $branch in
            "main (Stable release branch)")
                SELECTED_BRANCH="main"
                break
                ;;
            "development (Development branch)")
                SELECTED_BRANCH="development"
                break
                ;;
            *) echo "Invalid option" ;;
        esac
    done
    
    echo
    center_text "Selected branch: $SELECTED_BRANCH" "$BLUE"
    sleep 2
    return 0
}

install_zephyr() {
    clear_screen
    center_text "⚡ Installing Zephyr" "$YELLOW"
    center_text "Location: $INSTALL_DIR" "$GRAY"
    echo

    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
    fi

    center_text "Cloning repository..." "$BLUE"
    if ! git clone -b "$SELECTED_BRANCH" https://github.com/parazeeknova/zephyr.git "$INSTALL_DIR" > /dev/null 2>&1; then
        center_text "Failed to clone repository" "$RED"
        exit 1
    fi

    cd "$INSTALL_DIR" || exit 1

    if ! command -v pnpm &> /dev/null; then
        center_text "Installing pnpm..." "$BLUE"
        npm install -g pnpm
    fi

    center_text "Installing dependencies..." "$BLUE"
    if ! pnpm install > /dev/null 2>&1; then
        center_text "Failed to install dependencies" "$RED"
        exit 1
    fi

    show_completion_menu
}

show_completion_menu() {
    clear_screen
    center_text "✨ Installation Complete! ✨" "$GREEN"
    center_text "Development environment is ready!" "$YELLOW"
    center_text "Branch: $SELECTED_BRANCH" "$GRAY"
    echo
    
    PS3=$'\n'"→ What would you like to do next? (1-5): "
    options=("Open in VS Code" "Open Folder Location" "Start Development Server" "Show Project Information" "Exit")
    
    select opt in "${options[@]}"; do
        case $opt in
            "Open in VS Code")
                if command -v code &> /dev/null; then
                    code "$INSTALL_DIR"
                else
                    center_text "VS Code is not installed" "$RED"
                fi
                break
                ;;
            "Open Folder Location")
                if command -v xdg-open &> /dev/null; then
                    xdg-open "$INSTALL_DIR"
                elif command -v open &> /dev/null; then
                    open "$INSTALL_DIR"
                else
                    center_text "Cannot open folder location" "$RED"
                fi
                break
                ;;
            "Start Development Server")
                clear_screen
                center_text "Starting development server..." "$YELLOW"
                cd "$INSTALL_DIR" && pnpm run dev
                break
                ;;
            "Show Project Information")
                clear_screen
                center_text "Project Information" "$BLUE"
                echo
                center_text "Installation Directory: $INSTALL_DIR" "$GRAY"
                center_text "Selected Branch: $SELECTED_BRANCH" "$GRAY"
                center_text "Node Version: $(node --version)" "$GRAY"
                center_text "PNPM Version: $(pnpm --version)" "$GRAY"
                echo
                read -p "Press Enter to continue..."
                show_completion_menu
                ;;
            "Exit")
                center_text "Thank you for installing Zephyr!" "$GREEN"
                exit 0
                ;;
            *) echo "Invalid option" ;;
        esac
    done
}

trap 'echo -e "\n${RED}Installation interrupted${NC}"; exit 1' INT

print_banner
check_dependencies
get_install_location
select_branch
install_zephyr
