# WFConsoleWeb

A modern web interface for the [Tempest weather station by WeatherFlow](https://www.weatherflow.com/tempest). Display your Tempest data on your own web interface with real-time updates, beautiful charts, and customizable themes.

![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.9%2B-brightgreen)
![Status](https://img.shields.io/badge/status-alpha-orange)

---

## Features

- **Real-time Dashboard** — Live weather data with WebSocket streaming
- **Multiple Built-in Themes** — Dark Minimalist, Glass-morphism, Scientific, Weather-Realistic
- **Custom Themes** — Create your own themes with JSON configuration
- **Historical Data & Charts** — Beautiful visualizations of temperature, wind, pressure, humidity, lightning, and rainfall with Recharts
- **Configurable Data Retention** — User-controlled historical storage (1-min, 5-min, or hourly granularity)
- **Custom Panels** — Design your own weather metrics and displays
- **Local UDP Priority** — Fast local network data collection, optional cloud API fallback
- **Web-Based** — Access from any browser, works on desktop, tablet, and mobile
- **Cross-Platform** — Runs on Linux (Raspberry Pi, Ubuntu) and Windows
- **Encrypted Configuration** — API keys stored securely in SQLite database
- **JSON Data Export** — Download historical observations for backup or external analysis
- **Ko-fi Support Link** — Optional call-to-action for project donations

---

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/WFConsoleWeb.git
cd WFConsoleWeb

# Create a Python virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install the package
pip install -e .

# Start the web service
wfpiconsole-web
```

Then open your browser to **http://localhost:8000**

### Configuration

On first run, the app will:
1. Create a SQLite database (`wfpiconsole.db`)
2. Initialize configuration prompts
3. Guide you through API key setup and device discovery

Access the **Settings** menu to:
- Add WeatherFlow API key and device IDs
- Configure data granularity (1-min, 5-min, hourly)
- Select your preferred theme
- Manage historical data retention
- Customize panel layout

---

## Architecture

### Tech Stack

- **Backend**: FastAPI (async Python web framework)
- **Frontend**: React with Recharts for data visualization
- **Database**: SQLite with SQLAlchemy ORM
- **Real-time**: WebSocket for live observation streaming
- **Data Collection**: Local UDP (port 50222) + REST APIs
- **UI Themes**: CSS custom properties with 4 built-in themes + custom theme framework

### Project Structure

```
WFConsoleWeb/
├── wfpiconsole/                    # Main Python package
│   ├── backend/                    # FastAPI application
│   │   ├── main.py                 # App entry point
│   │   ├── websocket.py            # WebSocket manager
│   │   ├── auth.py                 # Authentication & JWT
│   │   └── routes/                 # API endpoints
│   │       ├── config.py           # Settings endpoints
│   │       ├── station.py          # Weather data endpoints
│   │       ├── history.py          # Historical data & charts
│   │       ├── themes.py           # Theme management
│   │       └── system.py           # Health, version, Ko-fi
│   ├── frontend/                   # React application
│   │   └── src/
│   │       ├── components/         # React components
│   │       ├── hooks/              # Custom React hooks
│   │       ├── services/           # API client, WebSocket
│   │       └── styles/themes/      # Built-in themes
│   ├── core/                       # Business logic
│   │   ├── observation_parser.py   # Observation data parsing
│   │   ├── astronomical.py         # Sun/moon calculations
│   │   ├── forecast.py             # Weather forecast
│   │   ├── data_archival.py        # Data retention & pruning
│   │   └── api_clients.py          # External API integration
│   ├── config/                     # Database & configuration
│   │   ├── database.py             # SQLAlchemy setup
│   │   ├── models.py               # ORM models
│   │   ├── encryption.py           # Key encryption utilities
│   │   └── settings.py             # App configuration
│   ├── service/                    # Background services
│   │   ├── udp_listener.py         # UDP observation receiver
│   │   └── startup.py              # Initialization routines
│   └── themes/                     # Theme framework
├── scripts/                        # Installation & migration scripts
├── tests/                          # Unit & integration tests
├── docs/                           # Documentation
└── README.md
```

---

## Data Sources

The app collects data from multiple sources (configurable):

| Source | Priority | Latency | Requires Internet | Metrics |
|--------|----------|---------|-------------------|---------|
| **UDP (Local)** | 1 (Primary) | <1s | No | Wind (3s), pressure, temperature, humidity, UV, radiation, lightning, rainfall |
| **WeatherFlow REST API** | 2 | 1-5m | Yes | Station metadata, complete observations, 6-hour history |
| **WeatherFlow WebSocket** | Fallback | 1-10s | Yes | Real-time observations, rapid wind updates |
| **CheckWX API** | Optional | N/A | Yes | METAR aviation weather data |

---

## Configuration

### API Keys

The app requires:
- **WeatherFlow API Key** — Get from https://tempestwx.com/settings/tokens
- **Optional: CheckWX API Key** — For METAR data at https://checkwx.com/api

### Device IDs

Auto-discovered from your API key, or manually enter:
- **Station ID** — Your Weather Station's unique identifier
- **Device ID (Tempest)** — The Tempest device SKU
- **Air Device ID** — If using Air sensor (optional)
- **Sky Device ID** — If using Sky sensor (optional)

### Data Retention

- **Granularity**: Choose data collection interval (1-min, 5-min, or hourly)
- **Retention Period**: Set max age for historical data or keep unlimited
- **Manual Pruning**: Delete data before a specified date when needed
- **Export**: Download observations as JSON for backup

---

## Themes

### Built-in Themes

1. **Dark Minimalist** — Clean, simple, dark background with minimal design
2. **Glass-morphism** — Frosted glass effect with transparency and modern gradients
3. **Scientific Dashboard** — Data-focused with emphasis on numeric accuracy
4. **Weather-Realistic** — Animated transitions and atmospheric design elements

### Custom Themes

Create your own themes using the JSON-based theme framework. See [THEME_DEVELOPMENT.md](docs/THEME_DEVELOPMENT.md) for details.

---

## Charts & Analytics

View historical weather data with interactive charts:

- **Temperature Chart** — Line chart with min/max/avg bands
- **Wind Chart** — Area chart with gust overlay and direction rose
- **Barometer Chart** — Pressure trends with 24-hour visualization
- **Humidity Chart** — Area chart with dew point overlay
- **Lightning Chart** — Strike frequency over time
- **Rainfall Chart** — Daily accumulation totals

Features:
- User-selectable time ranges (24h, 7d, 30d, or custom)
- Hover tooltips for exact values
- Zoom/pan for detailed inspection
- Download charts as PNG
- JSON export of underlying data

---

## Installation Options

### Linux (Raspberry Pi, Ubuntu, etc.)

```bash
# Install with systemd service
./scripts/install.sh

# Or manually:
pip install -e .
systemctl enable wfpiconsole-web
systemctl start wfpiconsole-web
```

### Windows

```powershell
# Run installer script
.\scripts\install.ps1

# Or manually:
pip install -e .
wfpiconsole-web
```

### Docker (Optional)

```bash
docker build -t wfconsoleweb .
docker run -p 8000:8000 -v /path/to/config:/app/data wfconsoleweb
```

---

## Development

### Setup Development Environment

```bash
git clone https://github.com/yourusername/WFConsoleWeb.git
cd WFConsoleWeb

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install in editable mode with dev dependencies
pip install -e ".[dev]"

# Start development server
uvicorn wfpiconsole.backend.main:app --reload

# In another terminal, build React frontend
cd wfpiconsole/frontend
npm install
npm start
```

### Running Tests

```bash
pytest tests/ -v --cov=wfpiconsole
```

### Code Style

```bash
# Format code
black wfpiconsole tests

# Check imports
isort wfpiconsole tests

# Lint
flake8 wfpiconsole tests
```

---

## Credits & Attribution

**Original Author**: [Pete Davis](https://github.com/peted-davis) — [WeatherFlow_PiConsole](https://github.com/peted-davis/WeatherFlow_PiConsole)

WFConsoleWeb is a web-based refactoring of the original Kivy desktop application, maintaining the same powerful data processing logic and panel concepts while providing a modern web interface accessible from any browser.

---

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) file for details.

---

## Support

If you find this project useful, consider supporting its development:

- **Ko-fi**: [Support via Ko-fi](https://ko-fi.com/michaelbeatty9142002) (link set in Settings menu)
- **GitHub**: [Star on GitHub](https://github.com/yourusername/WFConsoleWeb)
- **Issues**: Report bugs or request features on the [Issue Tracker](https://github.com/yourusername/WFConsoleWeb/issues)

---

## Documentation

- [INSTALLATION.md](docs/INSTALLATION.md) — Detailed setup guides for all platforms
- [CONFIG.md](docs/CONFIG.md) — Configuration options and database schema
- [DEVELOPMENT.md](docs/DEVELOPMENT.md) — Developer guide and architecture details
- [THEME_DEVELOPMENT.md](docs/THEME_DEVELOPMENT.md) — Creating custom themes
- [ANALYTICS.md](docs/ANALYTICS.md) — Historical data and charting features
- [API.md](docs/API.md) — REST API endpoint documentation

---

## Roadmap

- [x] Real-time weather dashboard
- [x] Multiple built-in themes
- [x] Historical data storage and visualization
- [x] Custom panels
- [x] Web-based configuration
- [ ] Mobile-optimized responsive design improvements
- [ ] Forecast integration with detailed predictions
- [ ] Alerts and notifications
- [ ] Dark/light theme toggle
- [ ] Video forecast from WeatherFlow
- [ ] Multiple station support
- [ ] InfluxDB integration for enterprise scaling

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute.

---

## Help & Troubleshooting

### Common Issues

**Port 8000 already in use?**
```bash
# Use a different port
uvicorn wfpiconsole.backend.main:app --port 8001
```

**Database locked error?**
- Ensure only one instance of the app is running
- Delete `wfpiconsole.db` to reset (you'll need to reconfigure)

**No observations appearing?**
- Check that your Tempest device is broadcasting UDP on port 50222
- Verify API key in Settings menu
- Check network connectivity between app and device

For more help, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) or open an issue on GitHub.

---

**Built with ❤️ for weather enthusiasts and Tempest users worldwide**
