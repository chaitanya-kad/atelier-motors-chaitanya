"""Populate an empty local database for screenshots and quick evaluation."""

from app.db import connect, init_db


DEMO = [
    ("Porsche", "911 Carrera", "Coupe", 11440000, 2),
    ("Volvo", "XC60", "SUV", 4935000, 4),
    ("Tesla", "Model 3", "Electric", 3899000, 3),
    ("Mercedes-Benz", "C-Class", "Sedan", 4775000, 1),
    ("Ford", "Bronco", "SUV", 3999500, 0),
    ("BMW", "i4", "Electric", 5290000, 2),
]

init_db()
with connect() as db:
    if db.execute("SELECT COUNT(*) FROM vehicles").fetchone()[0]:
        print("Inventory already has vehicles; no demo records added.")
    else:
        db.executemany("INSERT INTO vehicles (make, model, category, price_cents, quantity) VALUES (?, ?, ?, ?, ?)", DEMO)
        print(f"Added {len(DEMO)} demo vehicles.")
