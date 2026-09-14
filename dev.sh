#!/usr/bin/env bash
# ==============================================================================
# VisionEye Real-Time Foot-Traffic Analytics System
# Unified One-Command Launcher for macOS Apple Silicon (M4) / Linux / Windows
# ==============================================================================

set -e

# Color codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                  VISIONEYE FOOT-TRAFFIC ANALYTICS SYSTEM                   ║"
echo "║         Real-Time Person Tracking & Occupancy • Apple Silicon M4           ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
VENV_DIR="${BACKEND_DIR}/venv"
MODEL_PATH="${BACKEND_DIR}/models/yolo26n.onnx"

# 1. Check Python 3
echo -e "${CYAN}[1/6] Checking Python runtime...${NC}"
if command -v python3 &>/dev/null; then
    PYTHON_BIN="python3"
elif command -v python &>/dev/null; then
    PYTHON_BIN="python"
else
    echo -e "${RED}Error: Python is not installed. Please install Python 3.10+${NC}"
    exit 1
fi

PY_VERSION=$($PYTHON_BIN -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo -e "  ${GREEN}✓${NC} Python version: ${BOLD}${PY_VERSION}${NC}"

# 2. Check Node.js and npm
echo -e "${CYAN}[2/6] Checking Node.js and npm runtime...${NC}"
if ! command -v node &>/dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js (v18+)${NC}"
    exit 1
fi
if ! command -v npm &>/dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo -e "  ${GREEN}✓${NC} Node.js: ${BOLD}${NODE_VERSION}${NC} | npm: ${BOLD}${NPM_VERSION}${NC}"

# 3. Setup Python Virtual Environment
echo -e "${CYAN}[3/6] Setting up Python virtual environment...${NC}"
if [ ! -d "${VENV_DIR}" ]; then
    echo "  Creating virtual environment at backend/venv..."
    $PYTHON_BIN -m venv "${VENV_DIR}"
fi

VENV_PYTHON="${VENV_DIR}/bin/python"
VENV_PIP="${VENV_DIR}/bin/pip"

if [ ! -f "${VENV_PYTHON}" ]; then
    VENV_PYTHON="${VENV_DIR}/Scripts/python.exe"
    VENV_PIP="${VENV_DIR}/Scripts/pip.exe"
fi

# Verify core dependencies
if ! "${VENV_PYTHON}" -c "import django, channels, daphne, onnxruntime, cv2, numpy" &>/dev/null; then
    echo "  Installing backend Python dependencies from backend/requirements.txt..."
    "${VENV_PIP}" install --upgrade pip
    "${VENV_PIP}" install -r "${BACKEND_DIR}/requirements.txt"
else
    echo -e "  ${GREEN}✓${NC} Backend Python dependencies verified."
fi

# 4. Setup Frontend Dependencies
echo -e "${CYAN}[4/6] Checking frontend dependencies...${NC}"
if [ ! -d "${FRONTEND_DIR}/node_modules" ]; then
    echo "  Installing frontend dependencies (npm install)..."
    (cd "${FRONTEND_DIR}" && npm install)
else
    echo -e "  ${GREEN}✓${NC} Frontend dependencies verified."
fi

# 5. Verify YOLO26n ONNX Model
echo -e "${CYAN}[5/6] Verifying YOLO26n ONNX model...${NC}"
if [ ! -f "${MODEL_PATH}" ] || [ ! -s "${MODEL_PATH}" ]; then
    (cd "${ROOT_DIR}" && PYTHONPATH="${BACKEND_DIR}" "${VENV_PYTHON}" "${BACKEND_DIR}/models/setup_model.py" "${MODEL_PATH}")
fi
echo -e "  ${GREEN}✓${NC} YOLO26n ONNX model ready at: ${BOLD}${MODEL_PATH}${NC}"

# Run Django database migrations
echo "  Applying database migrations..."
(cd "${BACKEND_DIR}" && "${VENV_PYTHON}" manage.py migrate --noinput > /dev/null 2>&1)

# Clean up any dangling processes on ports 8000, 5173, 5174 for maximum reliability
if command -v lsof &>/dev/null; then
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    lsof -ti:5174 | xargs kill -9 2>/dev/null || true
fi

# 6. Launching Backend and Frontend
echo -e "${CYAN}[6/6] Launching VisionEye servers...${NC}"

# Cleanup handler on Ctrl+C / SIGINT / SIGTERM
cleanup() {
    echo -e "\n${YELLOW}${BOLD}Shutting down VisionEye services...${NC}"
    if [ -n "${BACKEND_PID}" ]; then
        kill -SIGTERM "${BACKEND_PID}" 2>/dev/null || true
    fi
    if [ -n "${FRONTEND_PID}" ]; then
        kill -SIGTERM "${FRONTEND_PID}" 2>/dev/null || true
    fi
    wait 2>/dev/null || true
    echo -e "${GREEN}✓ VisionEye stopped cleanly.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start Django Channels ASGI Backend with Daphne
cd "${ROOT_DIR}"
export PYTHONPATH="${BACKEND_DIR}:${PYTHONPATH}"
"${VENV_DIR}/bin/daphne" -b 0.0.0.0 -p 8000 config.asgi:application &
BACKEND_PID=$!

# Start React / Vite Frontend
(cd "${FRONTEND_DIR}" && npm run dev) &
FRONTEND_PID=$!

sleep 1.5

echo -e "\n${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════════"
echo -e "           VISIONEYE REAL-TIME PLATFORM IS ONLINE & READY!                  "
echo -e "════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "  ${CYAN}${BOLD}Frontend Dashboard:${NC}   ${BOLD}http://127.0.0.1:5173${NC}"
echo -e "  ${PURPLE}${BOLD}Backend REST & WS:${NC}   ${BOLD}http://127.0.0.1:8000${NC}"
echo -e "  ${GREEN}${BOLD}Video Stream Feed:${NC}   ${BOLD}http://127.0.0.1:8000/api/video/feed${NC}"
echo -e "  ${YELLOW}${BOLD}WebSocket Stream:${NC}    ${BOLD}ws://127.0.0.1:8000/ws/analytics/${NC}"
echo -e "  ${BOLD}Platform Target:${NC}     Apple Silicon M4 / macOS arm64"
echo -e "  ${BOLD}Detection Model:${NC}     YOLO26n ONNX"
echo -e "════════════════════════════════════════════════════════════════════════════"
echo -e "${YELLOW}Press [Ctrl+C] to stop all VisionEye services cleanly.${NC}\n"

# Keep script running and wait for background processes
wait "${BACKEND_PID}" "${FRONTEND_PID}"
