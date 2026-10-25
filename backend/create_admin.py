"""Create or promote an administrator without exposing role elevation in the API."""

import argparse
import getpass

from app.db import connect, init_db
from app.security import hash_password


parser = argparse.ArgumentParser()
parser.add_argument("email")
args = parser.parse_args()
password = getpass.getpass("Admin password (8+ characters): ")
if len(password) < 8:
    parser.error("Password must contain at least 8 characters")
init_db()
with connect() as db:
    db.execute("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin') "
               "ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash, role='admin'",
               (args.email.strip().lower(), hash_password(password)))
print("Admin account ready. Log in from the app.")
