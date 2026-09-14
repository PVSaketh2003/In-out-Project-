# Connecting Docker and Microsoft Azure: The Complete Architecture & Setup Guide

This document explains **how VisionEye connects Docker and Microsoft Azure**, detailing every stage of the pipeline: from containerizing the application and provisioning the cloud VM to setting up automated GitHub Actions CI/CD deployment, Nginx reverse proxying, SSL encryption, and domain routing.

---

## 1. High-Level Architecture Overview

Here is how code moves from your local computer to the 24/7 Azure cloud environment:

```text
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                           1. LOCAL DEVELOPMENT                              │
 │   • Develop React Frontend & Django Daphne Computer Vision Backend          │
 │   • Test locally via Pytest (15/15 test suite)                              │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │ git push origin main
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                     2. GITHUB ACTIONS CI/CD ENGINE                          │
 │   • Quality Gatekeeper: Runs automated tests & frontend build check         │
 │   • Multi-Platform Docker Build: Builds container image via Buildx          │
 │   • Pushes Image: pvsairamsaketh/visioneye:latest to Docker Hub             │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │ SSH Connection via Secret Key
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                3. MICROSOFT AZURE CLOUD VM (52.255.141.13)                  │
 │   ┌─────────────────────────────────────────────────────────────────────┐   │
 │   │               Nginx Reverse Proxy Container (Port 80 & 443)         │   │
 │   │   • Terminates Let's Encrypt SSL/TLS Encryption                     │   │
 │   │   • Routes WebSockets (/ws/) & MJPEG Video (/api/video/feed)        │   │
 │   │   • Serves Landing Website (/) & Routes Web App (/live & /app)      │   │
 │   └──────────────────────────────────┬──────────────────────────────────┘   │
 │                                      │ Proxy Pass (Internal Port 8000)      │
 │                                      ▼                                      │
 │   ┌─────────────────────────────────────────────────────────────────────┐   │
 │   │               VisionEye Core Container (Port 8000)                  │   │
 │   │   • Daphne ASGI Asynchronous Python Server                          │   │
 │   │   • YOLO26n ONNX Neural Inference & ByteTrack Tracking Engine       │   │
 │   │   • Compiled React 18 / Vite Single Page Application (SPA) Dist     │   │
 │   │   • Restart Policy: ALWAYS (Auto-heals & restarts on VM reboot)     │   │
 │   └─────────────────────────────────────────────────────────────────────┘   │
 └──────────────────────────────────────▲──────────────────────────────────────┘
                                        │
                         GoDaddy DNS: pvsairamsaketh.in
                                        │
 ┌──────────────────────────────────────┴──────────────────────────────────────┐
 │                     4. END-USER DEVICES (24/7 ACCESS)                       │
 │   • Smartphones (iOS Safari / Android Chrome on Mobile 4G/5G or WiFi)       │
 │   • Desktop Computers (macOS, Windows, Linux)                               │
 │   • Smart Displays, Tablets & Universal Browsers                            │
 └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Why Docker + Microsoft Azure?

1. **Why Docker?**
   - **Consistency**: Eliminates "it works on my machine" issues. Docker bundles Python 3.11, OpenCV C++ runtime libraries, ONNX Runtime, Daphne ASGI, and the compiled React frontend into an isolated image.
   - **Portability**: The exact same image runs on macOS, Linux, Azure VMs, or AWS with zero code modifications.
   - **Isolation**: Prevents conflicts between system libraries and application dependencies.

2. **Why Microsoft Azure Cloud VM?**
   - **24/7 Independent Uptime**: Runs inside Microsoft's enterprise data center with 99.9% availability.
   - **Operates Independently of Your Personal Machine**: Your MacBook can be powered off, sleeping, or disconnected from the internet, and your Azure VM keeps serving `https://pvsairamsaketh.in` non-stop.
   - **Static Public IP (`52.255.141.13`)**: Allows your domain DNS (`pvsairamsaketh.in`) to point directly to a permanent IP address.

---

## 3. Step-by-Step Breakdown: What We Did & How It Works

### Step 1: Multi-Stage Dockerfile (`Dockerfile`)
We created a multi-stage Docker build to keep the container lightweight and secure:

1. **Stage 1 (`frontend-builder`)**:
   - Uses `node:20-alpine`.
   - Copies frontend source code and runs `npm run build`.
   - Generates production-optimized JavaScript/CSS bundles and PWA assets.
2. **Stage 2 (`runtime`)**:
   - Uses `python:3.11-slim`.
   - Installs system libraries for OpenCV and ONNX (`libgl1`, `libglib2.0-0`, etc.).
   - Copies the compiled frontend from Stage 1 into `/app/frontend/dist`.
   - Copies the backend Python code and YOLO26n ONNX neural model.
   - Runs **Daphne ASGI** server on port `8000`.

---

### Step 2: Production Docker Compose (`azure/docker-compose.prod.yml`)
To coordinate the backend and the web server, we configured `docker-compose.prod.yml` with two interconnected services:

1. **`visioneye-backend`**:
   - Runs the VisionEye Daphne container.
   - Sets environment variables (`DJANGO_SECRET_KEY`, `MODEL_PATH`, `CONFIDENCE_THRESHOLD`).
   - Configured with `restart: always` so if it ever crashes, Docker restarts it immediately.
2. **`nginx`**:
   - Uses official `nginx:alpine`.
   - Listens on **Port 80 (HTTP)** and **Port 443 (HTTPS)**.
   - Mounts Let's Encrypt SSL certificates from the host VM.
   - Proxies incoming HTTPS and WebSocket traffic to `visioneye-backend:8000`.

---

### Step 3: Azure Virtual Machine Provisioning (`azure/setup_azure_vm.sh`)
On the Azure Ubuntu Linux VM:

1. **Firewall Setup (UFW & Azure NSG)**:
   - Opened Port `22` (SSH management).
   - Opened Port `80` (HTTP and SSL verification).
   - Opened Port `443` (Secure HTTPS and WebSockets).
2. **Docker Engine Installation**:
   - Installed official Docker CE and Docker Compose plugin.
   - Enabled Docker system service to start automatically whenever the Azure VM boots.
3. **SSL Certificate Provisioning (Certbot)**:
   - Configured Certbot to issue SSL certificates for `pvsairamsaketh.in` and `www.pvsairamsaketh.in`.
   - Added automated fallback certificate generation to prevent Nginx from ever failing on boot.
   - Added a daily Cron job to automatically renew SSL certificates before expiration.

---

### Step 4: Automated CI/CD Pipeline (`.github/workflows/deploy-azure.yml`)
To achieve zero-touch deployments whenever code is pushed to GitHub:

1. **GitHub Secrets Configured**:
   - `DOCKERHUB_USERNAME`: Your Docker Hub account ID (`pvsairamsaketh`).
   - `DOCKERHUB_TOKEN`: Secure personal access token from Docker Hub.
   - `AZURE_VM_HOST`: Public IP of the Azure VM (`52.255.141.13`).
   - `AZURE_VM_USERNAME`: SSH username (`azureuser`).
   - `AZURE_VM_SSH_KEY`: Private SSH key (`.pem`) used to securely authenticate with Azure.
2. **The Automated Flow**:
   - **Test**: Runs the 15/15 Pytest test suite and frontend build.
   - **Build & Push**: Builds the Docker container and pushes `pvsairamsaketh/visioneye:latest` to Docker Hub.
   - **Deploy**: Connects to the Azure VM via SSH, pulls the latest container, runs `docker compose up -d`, and validates the `/api/health` endpoint.

---

### Step 5: Domain & DNS Connection (`pvsairamsaketh.in`)
In GoDaddy Domain DNS settings:
- **`A` Record (`@`)**: Set to Azure VM Public IP (`52.255.141.13`).
- **`CNAME` Record (`www`)**: Set to `pvsairamsaketh.in`.

When anyone types `https://pvsairamsaketh.in` in any browser:
1. DNS directs the request to Azure IP `52.255.141.13`.
2. Azure VM accepts the connection on port 443.
3. Nginx verifies the TLS/SSL certificate.
4. Nginx delivers the download website at `/` and routes `/live` or `/app` directly to the VisionEye container.

---

## 4. Why Does It Work 24/7 Even If Your Mac Is Off?

| Factor | Your Local Mac | Azure Cloud VM |
| :--- | :--- | :--- |
| **Location** | Your desk / battery power | Microsoft Azure Cloud Datacenter |
| **Power Source** | Battery / Charger (sleeps on lid close) | Redundant enterprise electrical grid |
| **Network** | Home WiFi (dynamic IP, sleeps on idle) | Dedicated high-bandwidth cloud network |
| **Process Management** | Terminal session (stops when terminal exits) | Docker Daemon + systemd (`restart: always`) |
| **Public Address** | Localhost / NAT (inaccessible externally) | Dedicated Public IP (`52.255.141.13`) |

Because Docker and Nginx run directly on the Azure VM as persistent background background services, your personal Mac is only used for writing and pushing code. The cloud server handles all user traffic 24 hours a day, 7 days a week.

---

## 5. Useful Azure & Docker Management Commands

If you ever SSH into your Azure VM (`ssh -i key.pem azureuser@52.255.141.13`), here are the key commands:

```bash
# Check status of running containers
docker ps

# View real-time backend logs
docker logs -f visioneye-app

# View Nginx web server access logs
docker logs -f visioneye-nginx

# Restart all services on Azure VM
cd /opt/visioneye
docker compose -f docker-compose.prod.yml restart

# Pull latest update manually and restart
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# Check disk & memory usage on Azure VM
free -h
df -h
```
