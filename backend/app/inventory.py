"""Stock transactions kept separate from HTTP handling."""

from .db import connect


class VehicleMissing(Exception):
    pass


class OutOfStock(Exception):
    pass


class StockLimitExceeded(Exception):
    pass


MAX_QUANTITY = 1_000_000


def change_stock(vehicle_id: int, amount: int):
    """Apply a positive restock or a one-unit purchase atomically."""
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        if amount < 0:
            cursor = db.execute("UPDATE vehicles SET quantity = quantity - 1 WHERE id = ? AND quantity > 0", (vehicle_id,))
        else:
            cursor = db.execute(
                "UPDATE vehicles SET quantity = quantity + ? WHERE id = ? AND quantity <= ?",
                (amount, vehicle_id, MAX_QUANTITY - amount),
            )

        if cursor.rowcount == 0:
            exists = db.execute("SELECT 1 FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
            db.execute("ROLLBACK")
            if exists:
                if amount > 0:
                    raise StockLimitExceeded()
                raise OutOfStock()
            raise VehicleMissing()

        row = db.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
        db.execute("COMMIT")
        return row
