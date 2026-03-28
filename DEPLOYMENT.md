# WFConsoleWeb Deployment Guide

A comprehensive guide to deploying WFConsoleWeb on various platforms and environments.

---

## Table of Contents

1. [Local Installation](#local-installation)
2. [Docker Deployment](#docker-deployment)
3. [Linux Systemd Service](#linux-systemd-service)
4. [Windows Service](#windows-service)
5. [Raspberry Pi Deployment](#raspberry-pi-deployment)
6. [Network Configuration](#network-configuration)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Local Installation

### Prerequisites

- **Python 3.9+** — Visit [python.org](https://www.python.org)
- **Node.js 18+** (optional, only needed for building frontend)
- **Git** (for cloning the repository)
- **pip** (Python package manager, bundled with Python)

### Windows Installation

1. **Clone or Download the Repository**
   ```bash
   git clone https://github.com/yourusername/WFConsoleWeb.git
   cd WFConsoleWeb
   ```

2. **Run the Installation Script**
   ```bash
   install-windows.bat
   ```
   
   This script will:
   - Create a Python virtual environment
   - Install all dependencies
   - Create a desktop shortcut for easy launching
   - Generate startup scripts

3. **Configure WFConsoleWeb**
   - Launch using the desktop shortcut "WFConsoleWeb"
   - Open your browser to `http://localhost:8000`
   - Go to Settings and add your WeatherFlow API credentials:
     - WeatherFlow API Key
     - Device ID (your Tempest device)

4. **Optional: Install as Windows Service**
   ```bash
   # Using NSSM (Non-Sucking Service Manager)
   # Download from: https://nssm.cc/download
   
   # Extract NSSM and add to PATH, then:
   nssm install WFConsoleWeb "C:\path\to\AppData\Local\WFConsoleWeb\run.bat"
   nssm start WFConsoleWeb
   ```

### Linux Installation (Ubuntu, Debian, Raspberry Pi)

1. **Update System Packages**
   ```bash
   sudo apt-get update
   sudo apt-get upgrade -y
   ```

2. **Install Python and Dependencies**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install -y python3 python3-venv python3-dev python3-pip git curl
   
   # Raspberry Pi (includes GPIO support)
   sudo apt-get install -y python3 python3-venv python3-dev python3-pip git \
       build-essential libssl-dev libffi-dev
   ```

3. **Clone Repository and Install**
   ```bash
   git clone https://github.com/yourusername/WFConsoleWeb.git
   cd WFConsoleWeb
   chmod +x install-linux.sh
   ./install-linux.sh
   ```
   
   The script will:
   - Create a dedicated installation directory at `~/.local/opt/wfconsoleweb`
   - Set up Python virtual environment
   - Install all Python dependencies
   - Create systemd service file
   - Generate startup scripts

4. **Start WFConsoleWeb**
   ```bash
   # Option 1: Direct execution
   ~/.local/opt/wfconsoleweb/run.sh
   
   # Option 2: As a systemd service (recommended)
   sudo cp ~/.local/opt/wfconsoleweb/wfconsoleweb.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable wfconsoleweb
   sudo systemctl start wfconsoleweb
   
   # Check status
   sudo systemctl status wfconsoleweb
   ```

5. **Configure Application**
   - Open browser to `http://localhost:8000`
   - Add WeatherFlow API key and Device ID in Settings

---

## Docker Deployment

### Prerequisites

- **Docker** — [Install Docker](https://docs.docker.com/engine/install/)
- **Docker Compose** — Bundled with Docker Desktop, or [install separately](https://docs.docker.com/compose/install/)

### Quick Start

1. **Prepare Environment File**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Build and Run**
   ```bash
   docker-compose up -d
   ```

3. **Access Application**
   - Open browser to `http://localhost:8000`
   - Complete initial setup in Settings

4. **View Logs**
   ```bash
   docker-compose logs -f wfconsoleweb
   ```

5. **Stop Service**
   ```bash
   docker-compose down
   ```

### Production Docker Deployment

For production environments with SSL/TLS, reverse proxy, and persistent volumes:

```bash
# Build custom image
docker build -t my-registry/wfconsoleweb:latest .

# Run with persistent storage
docker run -d \
  --name wfconsoleweb \
  --restart unless-stopped \
  -p 8000:8000 \
  -v wfconsole_data:/app/data \
  -e SECRET_KEY=$(openssl rand -hex 32) \
  -e WEATHERFLOW_API_KEY=your-api-key \
  -e DEVICE_ID=your-device-id \
  my-registry/wfconsoleweb:latest

# With Docker Compose (recommended for complex setups)
docker-compose -f docker-compose.yml up -d
```

### Docker Networking

For UDP support (local Tempest data):

```yaml
services:
  wfconsoleweb:
    network_mode: "host"  # Required for UDP listener
    # ... rest of config
```

---

## Linux Systemd Service

### Automatic Installation

The Linux install script creates a systemd service file automatically. To manually install:

1. **Copy Service File**
   ```bash
   sudo cp wfconsoleweb.service /etc/systemd/system/
   ```

2. **Create Service User (optional but recommended)**
   ```bash
   sudo useradd -r -s /bin/bash -d /opt/wfconsoleweb wfconsole
   sudo mkdir -p /opt/wfconsoleweb
   sudo chown -R wfconsole:wfconsole /opt/wfconsoleweb
   ```

3. **Create Configuration Directory**
   ```bash
   sudo mkdir -p /opt/wfconsoleweb
   sudo touch /opt/wfconsoleweb/.env
   sudo chmod 600 /opt/wfconsoleweb/.env
   sudo chown wfconsole:wfconsole /opt/wfconsoleweb/.env
   ```

4. **Configure Environment**
   ```bash
   sudo nano /opt/wfconsoleweb/.env
   # Add your WeatherFlow API key and Device ID
   ```

5. **Enable and Start Service**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable wfconsoleweb
   sudo systemctl start wfconsoleweb
   ```

6. **Check Status**
   ```bash
   sudo systemctl status wfconsoleweb
   sudo journalctl -u wfconsoleweb -f  # View live logs
   ```

---

## Windows Service

### Using NSSM (Non-Sucking Service Manager)

Windows doesn't have a built-in way to run Python apps as services easily. NSSM provides a simple solution.

1. **Download NSSM**
   - Visit [https://nssm.cc/download](https://nssm.cc/download)
   - Download the latest version
   - Extract to a folder (e.g., `C:\nssm`)

2. **Add NSSM to PATH** (optional)
   ```
   Windows Settings → Environment Variables → PATH → Add C:\nssm\win64
   ```

3. **Install Service**
   ```bash
   # Open Command Prompt as Administrator
   cd C:\nssm\win64  # or the folder where NSSM is extracted
   
   nssm install WFConsoleWeb "C:\Users\YourUsername\AppData\Local\WFConsoleWeb\run.bat"
   ```

4. **Configure Service** (optional)
   ```bash
   # Set startup directory
   nssm set WFConsoleWeb AppDirectory "C:\Users\YourUsername\AppData\Local\WFConsoleWeb"
   
   # Set to restart on abnormal exit
   nssm set WFConsoleWeb AppExit Default Restart
   
   # Set restart delay to 10 seconds
   nssm set WFConsoleWeb AppRestartDelay 10000
   ```

5. **Start Service**
   ```bash
   nssm start WFConsoleWeb
   ```

6. **Manage Service**
   ```bash
   # View service status
   nssm status WFConsoleWeb
   
   # Stop service
   nssm stop WFConsoleWeb
   
   # Restart service
   nssm restart WFConsoleWeb
   
   # Remove service
   nssm remove WFConsoleWeb confirm
   ```

### Using Windows Task Scheduler (Alternative)

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (At startup, or on a schedule)
4. Set action to run: `C:\Users\YourUsername\AppData\Local\WFConsoleWeb\run.bat`
5. Check "Run with highest privileges" if needed

---

## Raspberry Pi Deployment

### Dedicated Installation

Raspberry Pi requires some special considerations for GPIO access and system integration.

1. **Install Raspberry Pi OS**
   - Use Raspberry Pi Imager
   - Select Raspberry Pi OS (32-bit or 64-bit)
   - Include SSH and WiFi configuration

2. **Update System**
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   sudo rpi-update  # Update firmware
   ```

3. **Install Build Tools**
   ```bash
   sudo apt-get install -y \
       build-essential python3-dev libssl-dev libffi-dev \
       git curl wget
   ```

4. **Install WFConsoleWeb**
   ```bash
   git clone https://github.com/yourusername/WFConsoleWeb.git
   cd WFConsoleWeb
   chmod +x install-linux.sh
   ./install-linux.sh
   ```

5. **Configure for GPIO Access** (if using GPIO features)
   ```bash
   # Add current user to GPIO group
   sudo usermod -a -G gpio $USER
   
   # Verify GPIO access
   ls -la /dev/gpiomem
   
   # Log out and back in for group changes to take effect
   exit
   ```

6. **Enable Services**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable wfconsoleweb
   sudo systemctl start wfconsoleweb
   ```

7. **Optimize for Low Power**
   ```bash
   # Reduce GPU memory (headless operation)
   sudo raspi-config
   # Advanced Options → Memory Split → Set to 16MB
   ```

### Headless Operation

If running Raspberry Pi headless (no monitor):

```bash
# SSH access
ssh pi@your-pi-hostname.local

# Or use it as a remote station on your network and access via:
# http://your-pi-hostname.local:8000
```

---

## Network Configuration

### Local Network Access

To access WFConsoleWeb from other machines on your network:

1. **Find Local IP Address**
   ```bash
   # Linux/Mac
   hostname -I
   
   # Windows (PowerShell)
   Get-NetIPAddress -AddressFamily IPv4
   ```

2. **Access from Other Machine**
   ```
   http://your-local-ip:8000
   
   Example: http://192.168.1.100:8000
   ```

3. **Enable mDNS (optional, easier hostname access)**
   ```bash
   # Linux/Raspberry Pi (install avahi)
   sudo apt-get install avahi-daemon
   sudo systemctl start avahi-daemon
   
   # Then access as:
   # http://your-hostname.local:8000
   ```

### Remote Access (Internet)

⚠️ **Security Warning**: Only expose WFConsoleWeb on the internet if properly secured with:
- Proper firewall rules
- Strong authentication
- HTTPS/SSL certificate
- Fail2ban or similar protection

**Using Reverse Proxy (Nginx)**

```nginx
server {
    listen 443 ssl http2;
    server_name weather.example.com;

    ssl_certificate /etc/letsencrypt/live/weather.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/weather.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Security Considerations

### Essential Steps

1. **Generate Strong Secret Key**
   ```bash
   openssl rand -hex 32
   # Add to .env: SECRET_KEY=<output>
   ```

2. **Secure API Credentials**
   - Never commit `.env` file to version control
   - Use strong passwords for API keys
   - Rotate keys periodically

3. **Enable Firewall**
   ```bash
   # Linux (UFW)
   sudo ufw enable
   sudo ufw allow 8000/tcp
   ```

4. **Use HTTPS/TLS**
   - Install SSL certificate (Let's Encrypt recommended)
   - Enable HTTPS in reverse proxy
   - Redirect HTTP to HTTPS

5. **Regular Updates**
   ```bash
   # Update system packages regularly
   sudo apt-get update && sudo apt-get upgrade -y
   
   # Update Python dependencies
   pip install --upgrade -r requirements.txt
   ```

6. **Database Backup**
   ```bash
   # Backup SQLite database
   cp wfpiconsole.db wfpiconsole.db.backup
   
   # For Docker deployments
   docker cp wfconsoleweb:/app/data/wfpiconsole.db ./backup/
   ```

### Monitoring and Logging

1. **Monitor Service Health**
   ```bash
   # Check systemd service status
   systemctl status wfconsoleweb
   
   # View journalctl logs
   journalctl -u wfconsoleweb -n 100 -f
   ```

2. **Log Rotation**
   ```bash
   # Create logrotate config
   sudo nano /etc/logrotate.d/wfconsoleweb
   
   # Content:
   /var/log/wfconsoleweb.log {
       daily
       rotate 14
       compress
       delaycompress
       notifempty
       create 0644 wfconsole wfconsole
       sharedscripts
   }
   ```

---

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000  # Linux/Mac
netstat -ano | findstr :8000  # Windows

# Kill the process
kill -9 <PID>  # Linux/Mac
taskkill /PID <PID> /F  # Windows
```

#### Python Virtual Environment Issues

```bash
# Recreate virtual environment
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### Database Corruption

```bash
# Reset database (WARNING: deletes all data)
rm wfpiconsole.db
# Restart application to reinitialize
```

#### Permission Denied (Linux)

```bash
# Fix directory permissions
sudo chown -R $USER:$USER ~/.local/opt/wfconsoleweb

# Or if using systemd service
sudo chown -R wfconsole:wfconsole /opt/wfconsoleweb
```

#### WebSocket Connection Failures

1. Check firewall allows WebSocket connections
2. For reverse proxy, ensure WebSocket upgrade headers are passed
3. Check browser console for specific errors

#### UDP Listener Not Receiving Data

1. Verify Tempest is on same local network
2. Check UDP port 50222 is not blocked by firewall
3. Ensure container has host network access (Docker)
4. Check application logs: `journalctl -u wfconsoleweb -f`

### Getting Help

1. **Check Logs**
   ```bash
   # Systemd service
   journalctl -u wfconsoleweb -n 50
   
   # Docker container
   docker logs -f wfconsoleweb
   ```

2. **Enable Debug Logging**
   ```bash
   # In .env file:
   LOG_LEVEL=DEBUG
   ```

3. **Check Configuration**
   ```bash
   # Verify environment variables
   cat /opt/wfconsoleweb/.env
   
   # Or for Docker
   docker inspect wfconsoleweb
   ```

4. **Report Issues**
   - Open an issue on GitHub with logs
   - Include Python version, OS, and deployment method
   - Attach relevant configuration (without API keys)

---

## Update and Maintenance

### Applying Updates

```bash
# Pull latest code
git pull origin main

# Rebuild (updates dependencies)
python build.py

# Reinstall package
pip install dist/wfconsoleweb-*.whl

# Restart service
sudo systemctl restart wfconsoleweb
```

### Database Migrations

The application uses SQLAlchemy for database management. For significant updates:

```bash
# Back up database first
cp wfpiconsole.db wfpiconsole.db.backup

# Application will auto-migrate on startup
# Check logs for migration status
journalctl -u wfconsoleweb -f
```

---

## Next Steps

1. Complete [Quick Start](#local-installation) for your platform
2. Configure API credentials in Settings
3. Review [Security Considerations](#security-considerations)
4. Set up monitoring (systemd service recommended)
5. Configure remote access if needed (with proper security)
6. Join the community and share feedback!

---

**Questions or Issues?**

- GitHub Issues: [WFConsoleWeb Issues](https://github.com/yourusername/WFConsoleWeb/issues)
- Documentation: [README.md](README.md)
- Community: Tempest Weather Station forums
