# WhatsApp Auto-Reply Bot

A Docker-based Node.js application that automatically sends good morning and good evening messages with images to WhatsApp contacts using Playwright and WhatsApp Web.

## Features

- ✅ Automated good morning messages (8 AM)
- ✅ Automated good evening messages (6 PM)
- ✅ Day-specific images (different image for each day of the week)
- ✅ Image clipboard copy-paste integration
- ✅ WhatsApp Web session persistence
- ✅ Docker & Docker Compose support
- ✅ VNC remote access support
- ✅ Timezone support (America/Sao_Paulo)

## Prerequisites

- Docker & Docker Compose
- WhatsApp account (for Web scanning)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/proxy-node-docker-whatsapp.git
cd proxy-node-docker-whatsapp
```

2. Add your images to the `images/` folder:
   - `bom-dia-domingo.jpeg` through `bom-dia-sabado.jpeg` (good morning images)
   - `boa-noite-domingo.jpeg` through `boa-noite-sabado.jpeg` (good evening images)

3. Build and start the container:
```bash
docker-compose up -d
```

## Usage

### First Time Setup

1. Access the browser via VNC or logs to see the QR code
2. Scan the QR code with your WhatsApp mobile app
3. The bot will start automatically at scheduled times

### API Endpoints

- **`GET /login`** - Start the browser and display WhatsApp Web QR code

### Scheduled Messages

- **8:00 AM** - Good morning message with day-specific image
- **6:00 PM** - Good evening message with day-specific image

Messages are sent to all contacts in your recent chat list.

## Configuration

### Environment Variables

Edit `docker-compose.yaml`:

```yaml
environment:
  - APP_USER=guest
  - REDIS_URL=redis://192.168.0.7:6379
  - TZ=America/Sao_Paulo
```

### VNC Access

- Port: `5901`
- Password: `forabozo` (set in docker-compose.yaml)

### WhatsApp Session

- Persistent storage: `/tmp/whatsapp_userdata`
- Volume: `userdata` (Docker volume)

## File Structure

```
.
├── main.js                 # Main application file
├── Dockerfile             # Docker image configuration
├── docker-compose.yaml    # Docker Compose setup
├── package.json           # Node.js dependencies
├── images/                # Day-specific message images
│   ├── bom-dia-*.jpeg
│   └── boa-noite-*.jpeg
└── resources/             # VNC and startup scripts
    ├── entrypoint.sh
    └── xstartup
```

## Logging

Logs include timestamps in America/Sao_Paulo timezone:

```
2026-01-01T08:00:00-03:00 - info [proxy-node-docker-whatsapp]: [good-morning] It's time to auto-reply!
2026-01-01T08:00:05-03:00 - info [proxy-node-docker-whatsapp]: Clicking on contact: John Doe
```

## Troubleshooting

### QR Code not appearing
- Check VNC connection or Docker logs
- Ensure browser has focus
- Try reloading with `/login` endpoint

### Images not sending
- Verify image files exist in `images/` folder
- Check file permissions
- Ensure clipboard permissions are enabled

### Timezone issues
- The container uses `America/Sao_Paulo` timezone
- Cron schedules run in server time

## Technologies Used

- **Node.js** - Runtime
- **Playwright** - Browser automation
- **Express.js** - Web server
- **node-cron** - Scheduled tasks
- **Winston** - Logging
- **Docker** - Containerization
- **VNC** - Remote access

## License

MIT

## Author

Thiago - 2026