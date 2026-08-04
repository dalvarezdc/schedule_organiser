.PHONY: setup run dev dev-frontend test build-frontend clean

# One-command setup
setup:
	@bash setup.sh

# Run the full app (backend serves built frontend)
run:
	@echo "Starting Schedule Organiser at http://localhost:8000"
	@. .venv/bin/activate && uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Development mode (hot reload for backend)
# Run 'make dev-frontend' in a second terminal for frontend hot reload
dev:
	@echo "Starting backend (dev mode) at http://localhost:8000"
	@echo "Run 'make dev-frontend' in a second terminal for frontend hot reload"
	@. .venv/bin/activate && uvicorn backend.main:app --reload

dev-frontend:
	@echo "Starting frontend dev server at http://localhost:5173"
	@cd frontend && npm run dev

# Run backend tests
test:
	@. .venv/bin/activate && pytest tests/ -v

# Rebuild just the frontend (after frontend code changes)
build-frontend:
	@cd frontend && npm run build
	@echo "✅ Frontend rebuilt"

# Remove build artifacts and venv (for a clean start)
clean:
	@rm -rf .venv frontend/dist frontend/node_modules __pycache__ backend/__pycache__
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@echo "✅ Cleaned"
