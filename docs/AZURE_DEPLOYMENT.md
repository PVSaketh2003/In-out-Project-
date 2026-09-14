# VisionEye Azure Cloud Deployment Guide

This guide provides the complete, production-ready procedure to deploy VisionEye as a universal Dockerized service on **Microsoft Azure** using account **`pvsaketh1@gmail.com`** and connected to **`https://pvsairamsaketh.in`**.

---

## Architecture Overview

```text
                  Developer (git push main)
                             │
                             ▼
              GitHub Actions CI Quality Gate
           (Pytest 13/13, Vite build, Docker dry-run)
                             │
                  [ Passes 100% Only ]
                             │
                             ▼
             Docker Hub Multi-Platform Container
               pvsairamsaketh/visioneye:latest
                             │
                             ▼
             Azure Cloud Instance (pvsaketh1@gmail.com)
            ┌─────────────────────────────────────────┐
            │  Azure Ubuntu Linux VM (B2s / D2s_v5)   │
            │                                         │
            │  ┌───────────────────────────────────┐  │
            │  │  Nginx Reverse Proxy (Port 80/443)│  │
            │  │  • Let's Encrypt SSL Certificates │  │
            │  │  • WebSocket Streaming (/ws/)     │  │
            │  │  • MJPEG Video Feed (/api/feed)   │  │
            │  └─────────────────┬─────────────────┘  │
            │                    ▼                    │
            │  ┌───────────────────────────────────┐  │
            │  │  VisionEye Container (Port 8000)  │  │
            │  │  • React SPA Frontend Dist        │  │
            │  │  • Django Daphne ASGI Backend     │  │
            │  │  • YOLO26n ONNX Inference         │  │
            │  └───────────────────────────────────┘  │
            └─────────────────────────────────────────┘
                             ▲
                             │
              GoDaddy DNS: pvsairamsaketh.in
```

---

## Step 1: Create Azure Virtual Machine

1. Log in to the [Azure Portal](https://portal.azure.com) using **`pvsaketh1@gmail.com`**.
2. Navigate to **Virtual Machines** -> **Create** -> **Azure virtual machine**.
3. Configure the VM settings:
   - **Subscription**: Your Azure subscription.
   - **Resource Group**: Create `visioneye-rg`.
   - **Virtual Machine Name**: `visioneye-vm`.
   - **Region**: Closest to your target users (e.g., `Central India`, `East US`, `West Europe`).
   - **Image**: `Ubuntu Server 22.04 LTS - x64 Gen2` or `Ubuntu Server 24.04 LTS`.
   - **Size**: `Standard_B2s` (2 vCPUs, 4 GiB memory) or `Standard_D2s_v5` (Recommended for smooth ONNX CPU inference).
   - **Authentication Type**: `SSH public key`.
   - **Username**: `azureuser`.
   - **SSH Key Source**: Generate new key pair or use existing public key (Save `visioneye-key.pem` securely).
4. **Networking**:
   - Inbound ports: Check **HTTP (80)**, **HTTPS (443)**, and **SSH (22)**.
5. Click **Review + Create**, then **Create**.
6. Once deployed, note down the **Public IP Address** (e.g., `20.xxx.xxx.xxx`).

---

## Step 2: One-Command VM Initialization

SSH into your newly created Azure VM:

```bash
ssh -i /path/to/visioneye-key.pem azureuser@<YOUR_AZURE_VM_IP>
```

Run the automated provisioning script directly on the VM:

```bash
# Clone the repository or download the setup script
git clone https://github.com/pvsairamsaketh/visioneye.git /opt/visioneye-repo
cd /opt/visioneye-repo

# Make setup script executable and run
chmod +x azure/setup_azure_vm.sh
./azure/setup_azure_vm.sh
```

The script automatically:
- Installs Docker Engine and Docker Compose plugin.
- Configures UFW firewall rules for ports 22, 80, and 443.
- Sets up `/opt/visioneye` working directory.
- Requests Let's Encrypt SSL certificates for `pvsairamsaketh.in`.

---

## Step 3: Configure GitHub Actions CI/CD Secrets

To enable automated zero-downtime deployment whenever code is pushed to `main`:

1. Open your GitHub repository: `https://github.com/pvsairamsaketh/visioneye`.
2. Go to **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.
3. Add the following secrets:

| Secret Name | Description | Example Value |
| :--- | :--- | :--- |
| `DOCKERHUB_USERNAME` | Docker Hub username | `pvsairamsaketh` |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token / Password | `dckr_pat_xxxx` |
| `AZURE_VM_HOST` | Public IP or DNS of your Azure VM | `20.xxx.xxx.xxx` |
| `AZURE_VM_USERNAME` | SSH username configured on Azure VM | `azureuser` |
| `AZURE_VM_SSH_KEY` | Private SSH key (Contents of `.pem` file) | `-----BEGIN OPENSSH PRIVATE KEY----- ...` |

---

## Step 4: Verification & Automated Pipeline Flow

Whenever you commit code to the `main` branch:

1. **Gatekeeper CI (`.github/workflows/ci.yml`)**:
   - Executes Python 3.11 tests (`pytest backend/tests/`).
   - Builds Frontend Vite SPA.
   - Dry-runs Docker container build.
   - **Rule**: If any test fails, deployment is aborted immediately.
2. **Automated CD (`.github/workflows/deploy-azure.yml`)**:
   - Builds multi-platform Docker container and tags as `latest` + `${GITHUB_SHA}`.
   - Pushes to Docker Hub.
   - Connects to Azure VM via SSH.
   - Runs `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`.
   - Performs automated healthcheck verification on `https://pvsairamsaketh.in/api/health`.

---

## Step 5: Manual Management Commands (If Needed)

If you need to manage the VM directly:

```bash
# Check container status
docker ps

# View real-time backend logs
docker logs -f visioneye-app

# View Nginx access & error logs
docker logs -f visioneye-nginx

# Restart service
cd /opt/visioneye
docker compose -f docker-compose.prod.yml restart

# Force update image manually
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```
