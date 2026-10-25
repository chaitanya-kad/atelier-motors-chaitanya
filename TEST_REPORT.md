# Test report

Captured on 24 October 2026 in the project workspace.

## Backend

Command: `cd backend && python -m pytest -q`

```text
.......                                                                  [100%]
7 passed, 1 warning in 1.49s
```

The warning originates in the installed Starlette TestClient integration (`httpx` deprecation). There were no test failures. The seven cases cover registration/login and invalid credentials; duplicate emails; admin CRUD and search; purchase, sold-out conflict and restock; validation and missing IDs; concurrent final-unit purchases; and persistence when a new app instance opens the same SQLite file.

Coverage command: `cd backend && python -m pytest --cov=app --cov-report=term-missing -q`

```text
Name               Stmts   Miss  Cover
app/__init__.py        0      0   100%
app/db.py             20      0   100%
app/inventory.py      20      0   100%
app/main.py          143      1    99%
app/security.py       27      3    89%
TOTAL                210      4    98%
7 passed, 1 warning in 1.57s
```

## Frontend

Command: `cd frontend && npm run build`

```text
vite v6.4.5 building for production...
✓ 1579 modules transformed.
dist/index.html                   0.43 kB │ gzip:  0.30 kB
dist/assets/index-YMcnsDNa.css   20.49 kB │ gzip:  5.54 kB
dist/assets/index-CkfoGlpD.js   249.76 kB │ gzip: 77.01 kB
✓ built in 2.12s
```

The build verifies bundling, not browser interaction. Browser screenshots and manual UI review remain pending.
