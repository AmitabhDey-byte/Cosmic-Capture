# Manual 16-commit sequence

No commits were created by Codex. Run this sequence yourself from PowerShell after reviewing the files. Replace the remote placeholder at the end.

```powershell
git init
git branch -M main

git add .gitignore package.json package-lock.json vite.config.ts tsconfig*.json index.html .oxlintrc.json public/favicon.svg public/icons.svg
git commit -m "chore: scaffold stellar arena web application"

git add src/main.tsx src/index.css
git commit -m "feat: initialize responsive React game shell"

git add src/App.tsx
git commit -m "feat: build cosmic capture game experience"

git add src/App.css
git commit -m "feat: add manga panel visual system and responsive layout"

git add public/art
git commit -m "feat: add original cosmic arena visual assets"

git add src/lib/wallets.ts
git commit -m "feat: support Freighter and Albedo pilot identity"

git add src/lib/api.ts
git commit -m "feat: persist pilot profiles and local match outcomes"

git add src/lib/observability.ts
git commit -m "feat: add optional analytics and error monitoring"

git add backend/__init__.py backend/run.py backend/app/__init__.py backend/app/config.py backend/app/database.py backend/app/schemas.py backend/requirements.txt
git commit -m "feat: establish FastAPI and asyncpg service foundation"

git add backend/app/main.py
git commit -m "feat: implement FastAPI game, Kira, and ledger routes"

git add backend/scripts db/migrations
git commit -m "feat: add PostgreSQL schema and migration runner"

git add Dockerfile docker-compose.yml
git commit -m "chore: containerize FastAPI service and local Postgres"

git add contracts/stellar-arena/Cargo.toml contracts/stellar-arena/Cargo.lock contracts/stellar-arena/src/lib.rs
git commit -m "feat: add Soroban result and cosmetic contract"

git add .github/workflows/ci.yml
git commit -m "ci: verify frontend FastAPI and Soroban contract"

git add .github/workflows/deploy.yml
git commit -m "ci: add guarded Vercel web deployment"

git add README.md .env.example COMMIT_GUIDE.md
git commit -m "docs: document local setup environment and handoff"

git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

Before pushing, check `git status`; `.env`, `.venv`, build output, and Rust build output are ignored and must not be staged.
