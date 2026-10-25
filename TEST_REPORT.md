# Test report

Captured on 25 October 2026 in the project workspace. Run these commands after installing dependencies.

## Backend

Command: `cd backend && python -m pytest --cov=app --cov-report=term-missing -q`

```text
....................                                                     [100%]
Name               Stmts   Miss  Cover   Missing
------------------------------------------------
app/__init__.py        0      0   100%
app/db.py             20      0   100%
app/inventory.py      25      0   100%
app/main.py          156      2    99%   51, 92
app/security.py       28      3    89%   23-24, 30
------------------------------------------------
TOTAL                229      5    98%
20 passed, 1 warning in 2.90s
```

The warning comes from the installed Starlette TestClient integration (`httpx` deprecation). Tests cover auth, validation, search, admin CRUD, role boundaries, purchase/restock caps, malformed inputs, expired tokens, deleted users, persistence, and 20 synchronized buyers for 5 units.

## Frontend

Command: `cd frontend && npm test`

```text
✓ src/App.test.jsx (5 tests)
Test Files  1 passed (1)
Tests       5 passed (5)
```

DOM tests cover API search, pending-search progress, stale-stock refresh, sold-out controls, and editing a custom category.

Command: `cd frontend && npm run build`

```text
vite v6.4.5 building for production...
✓ 1583 modules transformed.
dist/index.html                   0.47 kB │ gzip:  0.31 kB
dist/assets/index-D3YHW_Hz.css   21.06 kB │ gzip:  5.76 kB
dist/assets/index-DGycYOdW.js   252.00 kB │ gzip: 77.70 kB
✓ built in 1.92s
```

DOM tests and a production build do not replace a real browser visual and keyboard review. Genuine screenshots remain pending.
