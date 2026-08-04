#!/usr/bin/env bash
set -e

echo "🗓  Schedule Organiser — Setup"
echo "================================"

# --- Check Python ---
if ! command -v python3 &>/dev/null; then
  echo "❌ Python 3 not found. Install Python 3.11+ from https://python.org"
  exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PYTHON_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
PYTHON_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")
if [ "$PYTHON_MAJOR" -lt 3 ] || { [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 11 ]; }; then
  echo "❌ Python 3.11+ required (found $PYTHON_VERSION)"
  exit 1
fi
echo "✅ Python $PYTHON_VERSION"

# --- Check Node ---
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install Node 18+ from https://nodejs.org"
  exit 1
fi
NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ Node 18+ required (found v$NODE_VERSION)"
  exit 1
fi
echo "✅ Node v$NODE_VERSION"

# --- Python venv ---
if [ ! -d ".venv" ]; then
  echo "📦 Creating Python virtual environment..."
  python3 -m venv .venv
fi
echo "📦 Installing Python dependencies..."
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r backend/requirements.txt
echo "✅ Python dependencies installed"

# --- .env ---
if [ ! -f ".env" ]; then
  echo "🔑 Creating .env with auto-generated SECRET_KEY..."
  SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  sed "s/change-me-to-a-random-32-char-string/$SECRET_KEY/" .env.example > .env
  echo "✅ .env created (SECRET_KEY auto-generated)"
else
  echo "✅ .env already exists — skipping"
fi

# --- Frontend ---
echo "🌐 Installing frontend dependencies..."
cd frontend
npm install --silent
echo "🔨 Building frontend..."
npm run build --silent
cd ..
echo "✅ Frontend built"

echo ""
echo "✨ Setup complete!"
echo ""
echo "To start the app:"
echo "  source .venv/bin/activate"
echo "  uvicorn backend.main:app --host 0.0.0.0 --port 8000"
echo ""
echo "Then open: http://localhost:8000"
echo "Go to Settings to add your AI API key (OpenAI, Claude, etc.)"
echo ""
echo "Or just run: make run"
