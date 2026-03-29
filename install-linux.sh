#!/bin/bash
###############################################################################
# WFConsoleWeb Linux Installation Script
###############################################################################
# This script installs WFConsoleWeb on Linux systems (Ubuntu, Debian, Raspberry Pi, etc.)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${HOME}/.local/opt/wfconsoleweb"
SERVICE_DIR="/etc/systemd/system"
LOG_FILE="${INSTALL_DIR}/install.log"
VENV_DIR="${INSTALL_DIR}/venv"
DATA_DIR="${INSTALL_DIR}/data"
INSTALL_DB_URL="sqlite:///${INSTALL_DIR}/wfpiconsole.db"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[*]${NC} $1"
}

log_ok() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

###############################################################################
# Main Installation
###############################################################################

echo ""
echo "==========================================================================="
echo "  WFConsoleWeb - Linux Installer"
echo "==========================================================================="
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    log_warning "Running as root is not recommended for user installation"
    log_warning "This script will install to user home directory"
    echo ""
fi

# Create install directory
log_info "Creating installation directory: ${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}" 2>/dev/null || true
mkdir -p "${DATA_DIR}" 2>/dev/null || true

# Redirect logs
exec > >(tee -a "${LOG_FILE}")
exec 2>&1

# Check Python version
log_info "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    log_error "Python3 is not installed"
    log_info "Install Python 3.9+ using:"
    log_info "  Ubuntu/Debian: sudo apt-get install python3 python3-venv python3-dev"
    log_info "  Fedora: sudo dnf install python3 python3-venv python3-devel"
    log_info "  Raspberry Pi: sudo apt-get install python3 python3-venv python3-dev"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
log_ok "Found Python ${PYTHON_VERSION}"

# Check pip
if ! command -v pip3 &> /dev/null; then
    log_error "pip3 is not installed"
    log_info "Install pip3 using:"
    log_info "  Ubuntu/Debian: sudo apt-get install python3-pip"
    log_info "  Fedora: sudo dnf install python3-pip"
    exit 1
fi

# Create virtual environment
log_info "Creating Python virtual environment..."
if [ -d "${VENV_DIR}" ]; then
    log_warning "Virtual environment already exists"
else
    python3 -m venv "${VENV_DIR}"
    log_ok "Virtual environment created"
fi

# Activate virtual environment
log_info "Activating virtual environment..."
source "${VENV_DIR}/bin/activate"

# Upgrade pip
log_info "Upgrading pip and build tools..."
pip install --upgrade pip setuptools wheel 2>&1 | tail -n 1

# Install WFConsoleWeb
log_info "Installing WFConsoleWeb and dependencies..."
cd "${SCRIPT_DIR}"
pip install -e . 2>&1 | grep -E "Successfully|ERROR" || true

log_ok "WFConsoleWeb installed successfully"

# Configure single admin account
log_info "Configuring admin account..."
ADMIN_USERNAME="${WF_ADMIN_USERNAME:-}"
ADMIN_PASSWORD="${WF_ADMIN_PASSWORD:-}"

if [[ -z "${ADMIN_USERNAME}" ]]; then
    read -r -p "Admin username [admin]: " ADMIN_USERNAME
    ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
fi

if [[ -z "${ADMIN_PASSWORD}" ]]; then
    read -r -s -p "Admin password: " ADMIN_PASSWORD
    echo ""
fi

if [[ -z "${ADMIN_PASSWORD}" ]]; then
    log_error "Admin password cannot be empty"
    exit 1
fi

export DATABASE_URL="${INSTALL_DB_URL}"
export DATA_DIR="${DATA_DIR}"

python3 "${SCRIPT_DIR}/scripts/setup-admin.py" \
    --username "${ADMIN_USERNAME}" \
    --password "${ADMIN_PASSWORD}" \
    --reset-existing \
    --non-interactive

unset ADMIN_PASSWORD
log_ok "Admin account configured: ${ADMIN_USERNAME}"

# Create startup script
log_info "Creating startup script..."
STARTUP_SCRIPT="${INSTALL_DIR}/run.sh"
cat > "${STARTUP_SCRIPT}" << 'EOF'
#!/bin/bash
# WFConsoleWeb Startup Script
INSTALL_DIR="$(dirname "$0")"
VENV_DIR="$(dirname "$0")/venv"
export DATABASE_URL="sqlite:///${INSTALL_DIR}/wfpiconsole.db"
export DATA_DIR="${INSTALL_DIR}/data"
cd "${INSTALL_DIR}"
source "${VENV_DIR}/bin/activate"
exec wfpiconsole-web
EOF
chmod +x "${STARTUP_SCRIPT}"
log_ok "Startup script created at ${STARTUP_SCRIPT}"

# Create systemd service file
log_info "Creating systemd service file..."
SERVICE_FILE="${INSTALL_DIR}/wfconsoleweb.service"
cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=WFConsoleWeb - Weather Station Web Interface
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${STARTUP_SCRIPT}
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
log_ok "Service file created at ${SERVICE_FILE}"

# Create configuration directory
log_info "Creating configuration directory..."
CONFIG_DIR="${INSTALL_DIR}/config"
mkdir -p "${CONFIG_DIR}"
cd "${INSTALL_DIR}"

# Create environment file template
log_info "Creating environment configuration template..."
cat > "${INSTALL_DIR}/.env.example" << 'EOF'
# WFConsoleWeb Environment Configuration
# Copy to .env and update with your values

# Server Configuration
HOST=0.0.0.0
PORT=8000
RELOAD=false

# Database
DATABASE_URL=sqlite:///./wfpiconsole.db

# Secret Key (generate with: openssl rand -hex 32)
SECRET_KEY=your-secret-key-here-change-this

# API Configuration
WEATHERFLOW_API_KEY=your-api-key-here
DEVICE_ID=your-device-id-here

# Optional: UDP listener port for local data
UDP_PORT=50222

# Logging
LOG_LEVEL=INFO
EOF
log_ok "Environment template created"

# Installation summary
echo ""
echo "==========================================================================="
echo "  Installation Complete!"
echo "==========================================================================="
echo ""

# Check for systemctl
if command -v systemctl &> /dev/null && [ $EUID -eq 0 ]; then
    log_info "To install as a system service (requires sudo):"
    echo "  sudo cp ${SERVICE_FILE} ${SERVICE_DIR}/"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable wfconsoleweb"
    echo "  sudo systemctl start wfconsoleweb"
    echo ""
fi

# Provide startup options
log_info "To start WFConsoleWeb:"
echo ""
echo "  Option 1 - Run directly:"
echo "    ${STARTUP_SCRIPT}"
echo ""
echo "  Option 2 - Run from current shell:"
echo "    source ${VENV_DIR}/bin/activate"
echo "    wfpiconsole-web"
echo ""
echo "  Option 3 - Install as system service (Linux only):"
echo "    sudo cp ${SERVICE_FILE} ${SERVICE_DIR}/"
echo "    sudo systemctl daemon-reload"
echo "    sudo systemctl enable wfconsoleweb"
echo "    sudo systemctl start wfconsoleweb"
echo ""

log_info "Access the web interface at:"
echo "  http://localhost:8000"
echo ""

log_info "Configuration files:"
echo "  Database: ${INSTALL_DIR}/wfpiconsole.db"
echo "  Environment: ${INSTALL_DIR}/.env"
echo "  Logs: ${LOG_FILE}"
echo ""

log_info "For Raspberry Pi specific setup:"
echo "  1. Make sure GPIO device is accessible to your user"
echo "  2. Check: ls -la /dev/gpiomem"
echo "  3. If needed: sudo usermod -a -G gpio ${USER}"
echo ""

log_info "Documentation:"
echo "  README: ${SCRIPT_DIR}/README.md"
echo "  Deployment: ${SCRIPT_DIR}/DEPLOYMENT.md"
echo ""
echo "==========================================================================="
echo ""
