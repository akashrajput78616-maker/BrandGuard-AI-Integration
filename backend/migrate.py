"""
Database Migration Script for BrandGuard.
Connects to PostgreSQL (Neon, Supabase, or self-hosted), enables pgvector,
and executes the multi-tenant schema from db/schema.sql.

Usage:
  python backend/migrate.py
  npm run migrate
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Configure UTF-8 stdout if possible on Windows
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Load backend/.env and root .env.local if available
backend_dir = Path(__file__).resolve().parent
project_root = backend_dir.parent
load_dotenv(project_root / ".env.local")
load_dotenv(backend_dir / ".env")


def run_migrations():
    db_url = os.getenv("DATABASE_URL_UNPOOLED", "").strip() or os.getenv("DATABASE_URL", "").strip()
    if not db_url:
        print("\n[ERROR] DATABASE_URL environment variable is not set.")
        print("Please provide a valid PostgreSQL connection string (from Neon or Supabase):")
        print("Example: DATABASE_URL=postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require\n")
        sys.exit(1)

    # Standardize postgres:// to postgresql:// if needed
    if db_url.startswith("postgres://"):
        db_url = "postgresql://" + db_url[len("postgres://"):]

    print("Connecting to database...")

    try:
        import psycopg2
    except ImportError:
        print("❌ Error: psycopg2 is not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    schema_file = backend_dir / "db" / "schema.sql"
    if not schema_file.exists():
        print(f"❌ Error: Schema file not found at {schema_file}")
        sys.exit(1)

    with open(schema_file, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()

        print("Enabling extensions (uuid-ossp, vector)...")
        cur.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
        cur.execute('CREATE EXTENSION IF NOT EXISTS "vector";')

        print("Executing schema migrations...")
        cur.execute(schema_sql)

        # Verify tables created
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        tables = [row[0] for row in cur.fetchall()]

        print("\n✅ Migration completed successfully!")
        print(f"Verified {len(tables)} tables in database:")
        for t in tables:
            print(f"  • {t}")

        cur.close()
        conn.close()

    except Exception as exc:
        print(f"\n❌ Migration failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    run_migrations()
