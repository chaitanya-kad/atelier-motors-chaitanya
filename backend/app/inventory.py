"""Stock transactions kept separate from HTTP handling."""

from .db import connect


class VehicleMissing(Exception):
    pass


class OutOfStock(Exception):
    pass


def change_stock(vehicle_id: int, amount: int):
    """Apply a positive restock or a one-unit purchase atomically."""
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        if amount < 0:
            cursor = db.execute("UPDATE vehicles SET quantity = quantity - 1 WHERE id = ? AND quantity > 0", (vehicle_id,))
        else:
            cursor = db.execute("UPDATE vehicles SET quantity = quantity + ? WHERE id = ?", (amount, vehicle_id))

        if cursor.rowcount == 0:
            exists = db.execute("SELECT 1 FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
            db.execute("ROLLBACK")
            if exists:
                raise OutOfStock()
            raise VehicleMissing()

        row = db.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
        db.execute("COMMIT")
        return row
