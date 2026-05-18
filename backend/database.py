import sqlite3
import os
import asyncio
import logging
import socket
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "sentinel.db")


SCHEMA_SQL = """
    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        employee_id TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT UNIQUE NOT NULL,
        hostname TEXT DEFAULT '',
        ip_address TEXT DEFAULT '',
        employee_id INTEGER REFERENCES employees(id),
        first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        timestamp REAL NOT NULL,
        source TEXT NOT NULL,
        original_content TEXT DEFAULT '',
        sanitized_content TEXT DEFAULT '',
        risk_level TEXT NOT NULL,
        severity INTEGER DEFAULT 1,
        confidence REAL DEFAULT 0,
        category TEXT DEFAULT '',
        reason TEXT DEFAULT '',
        recommended_action TEXT DEFAULT '',
        device_id INTEGER REFERENCES devices(id),
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_events_risk ON events(risk_level);
    CREATE INDEX IF NOT EXISTS idx_events_device ON events(device_id);
    -- Add severity column to existing DBs that pre-date this migration
    -- SQLite ignores ADD COLUMN if it already exists via 'IF NOT EXISTS' workaround
    -- We use a no-op safe approach: catch the error in Python at startup instead.
    CREATE TABLE IF NOT EXISTS email_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER REFERENCES employees(id),
        threat_count INTEGER DEFAULT 0,
        notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS smtp_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        host TEXT DEFAULT '',
        port INTEGER DEFAULT 587,
        username TEXT DEFAULT '',
        password TEXT DEFAULT '',
        use_tls INTEGER DEFAULT 1,
        from_email TEXT DEFAULT '',
        enabled INTEGER DEFAULT 0
    );
    INSERT OR IGNORE INTO smtp_settings (id) VALUES (1);
"""


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    return conn


def _init():
    c = _conn()
    # Migration: add severity column to existing databases that predate this schema
    try:
        c.execute("ALTER TABLE events ADD COLUMN severity INTEGER DEFAULT 1")
        c.commit()
        logger.info("Migration applied: events.severity column added")
    except Exception:
        pass  # Column already exists — safe to ignore
    c.close()
    logger.info("DB ready at %s", DB_PATH)


async def init_db():
    await asyncio.to_thread(_init)


def _exec(query: str, params: tuple = ()) -> None:
    c = _conn()
    c.execute(query, params)
    c.commit()
    c.close()


async def execute(query: str, params: tuple = ()) -> None:
    await asyncio.to_thread(_exec, query, params)


def _fetch_all(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    c = _conn()
    rows = c.execute(query, params).fetchall()
    c.close()
    return [dict(r) for r in rows]


async def fetch_all(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_fetch_all, query, params)


def _fetch_one(query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    c = _conn()
    row = c.execute(query, params).fetchone()
    c.close()
    return dict(row) if row else None


async def fetch_one(query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_fetch_one, query, params)


# ── Events ──────────────────────────────────────────────

async def save_event(data: dict, device_pk: Optional[int] = None) -> None:
    await execute(
        """INSERT OR IGNORE INTO events
           (id, timestamp, source, original_content, sanitized_content,
            risk_level, severity, confidence, category, reason, recommended_action, device_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            data["id"], data["timestamp"], data["source"],
            data.get("original_content", ""), data.get("sanitized_content", ""),
            data["risk_level"], data.get("severity", 1), data.get("confidence", 0),
            data.get("category", ""), data.get("reason", ""),
            data.get("recommended_action", ""), device_pk,
        ),
    )


async def get_events(
    limit: int = 200, offset: int = 0,
    risk_level: Optional[str] = None,
    employee_id: Optional[int] = None,
    device_pk: Optional[int] = None,
) -> List[Dict[str, Any]]:
    q = "SELECT * FROM events"
    params: list = []
    conds: list = []
    if risk_level:
        conds.append("risk_level = ?")
        params.append(risk_level)
    if employee_id:
        conds.append("device_id IN (SELECT id FROM devices WHERE employee_id = ?)")
        params.append(employee_id)
    if device_pk:
        conds.append("device_id = ?")
        params.append(device_pk)
    if conds:
        q += " WHERE " + " AND ".join(conds)
    q += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    return await fetch_all(q, tuple(params))


async def get_event_count(
    risk_level: Optional[str] = None,
    employee_id: Optional[int] = None,
) -> int:
    q = "SELECT COUNT(*) as cnt FROM events e"
    params: list = []
    conds: list = []
    if risk_level:
        conds.append("e.risk_level = ?")
        params.append(risk_level)
    if employee_id:
        conds.append("e.device_id IN (SELECT id FROM devices WHERE employee_id = ?)")
        params.append(employee_id)
    if conds:
        q += " WHERE " + " AND ".join(conds)
    row = await fetch_one(q, tuple(params))
    return row["cnt"] if row else 0


# ── Employees ───────────────────────────────────────────

async def create_employee(name: str, email: str, employee_id: str = "") -> int:
    await execute(
        "INSERT INTO employees (name, email, employee_id) VALUES (?,?,?)",
        (name, email, employee_id or None),
    )
    row = await fetch_one("SELECT id FROM employees WHERE email = ?", (email,))
    return row["id"] if row else 0


async def update_employee(pk: int, name: str, email: str, employee_id: str) -> None:
    await execute(
        "UPDATE employees SET name=?, email=?, employee_id=? WHERE id=?",
        (name, email, employee_id or None, pk),
    )


async def delete_employee(pk: int) -> None:
    await execute("UPDATE devices SET employee_id = NULL WHERE employee_id = ?", (pk,))
    await execute("DELETE FROM employees WHERE id = ?", (pk,))


async def list_employees() -> List[Dict[str, Any]]:
    rows = await fetch_all(
        """SELECT e.*,
           (SELECT COUNT(*) FROM devices d WHERE d.employee_id = e.id) as device_count,
           (SELECT COUNT(*) FROM events ev JOIN devices d ON ev.device_id = d.id WHERE d.employee_id = e.id) as event_count,
           (SELECT COUNT(*) FROM events ev JOIN devices d ON ev.device_id = d.id WHERE d.employee_id = e.id AND ev.risk_level IN ('HIGH','CRITICAL')) as threat_count
           FROM employees e ORDER BY e.name"""
    )
    return rows


async def get_employee(pk: int) -> Optional[Dict[str, Any]]:
    return await fetch_one("SELECT * FROM employees WHERE id = ?", (pk,))


# ── Devices ─────────────────────────────────────────────

async def register_device(
    device_id: str, hostname: str = "", ip_address: str = ""
) -> int:
    existing = await fetch_one(
        "SELECT id FROM devices WHERE device_id = ?", (device_id,)
    )
    if existing:
        await execute(
            "UPDATE devices SET last_seen = CURRENT_TIMESTAMP, ip_address = ?, hostname = ? WHERE id = ?",
            (ip_address, hostname, existing["id"]),
        )
        return existing["id"]
    await execute(
        "INSERT INTO devices (device_id, hostname, ip_address) VALUES (?,?,?)",
        (device_id, hostname, ip_address),
    )
    row = await fetch_one("SELECT id FROM devices WHERE device_id = ?", (device_id,))
    return row["id"] if row else 0


async def list_devices() -> List[Dict[str, Any]]:
    return await fetch_all(
        """SELECT d.*, e.name as employee_name, e.email as employee_email, e.employee_id as emp_eid,
           (SELECT COUNT(*) FROM events ev WHERE ev.device_id = d.id) as event_count,
           (SELECT COUNT(*) FROM events ev WHERE ev.device_id = d.id AND ev.risk_level IN ('HIGH','CRITICAL')) as threat_count
           FROM devices d LEFT JOIN employees e ON d.employee_id = e.id
           ORDER BY d.last_seen DESC"""
    )


async def assign_device(device_pk: int, employee_pk: Optional[int]) -> None:
    await execute(
        "UPDATE devices SET employee_id = ? WHERE id = ?",
        (employee_pk, device_pk),
    )


# ── SMTP Settings ───────────────────────────────────────

async def get_smtp_settings() -> dict:
    row = await fetch_one("SELECT * FROM smtp_settings WHERE id = 1")
    if not row:
        return {"host": "", "port": 587, "username": "", "password": "", "use_tls": True, "from_email": "", "enabled": False}
    return {
        "host": row["host"] or "",
        "port": row["port"] or 587,
        "username": row["username"] or "",
        "password": row["password"] or "",
        "use_tls": bool(row["use_tls"]),
        "from_email": row["from_email"] or "",
        "enabled": bool(row["enabled"]),
    }


async def save_smtp_settings(settings: dict) -> None:
    await execute(
        """UPDATE smtp_settings SET
           host=?, port=?, username=?, password=?, use_tls=?, from_email=?, enabled=?
           WHERE id=1""",
        (
            settings.get("host", ""),
            settings.get("port", 587),
            settings.get("username", ""),
            settings.get("password", ""),
            1 if settings.get("use_tls", True) else 0,
            settings.get("from_email", ""),
            1 if settings.get("enabled", False) else 0,
        ),
    )


async def send_email(recipient: str, subject: str, body: str) -> dict:
    import smtplib, email.utils
    from email.mime.text import MIMEText

    settings = await get_smtp_settings()
    if not settings.get("enabled") or not settings.get("host"):
        return {"success": False, "error": "SMTP not configured"}

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings["from_email"] or settings["username"]
    msg["To"] = recipient
    msg["Date"] = email.utils.formatdate()

    try:
        if settings["use_tls"]:
            with smtplib.SMTP(settings["host"], settings["port"]) as s:
                s.starttls()
                if settings["username"]:
                    s.login(settings["username"], settings["password"])
                s.send_message(msg)
        else:
            with smtplib.SMTP_SSL(settings["host"], settings["port"]) as s:
                if settings["username"]:
                    s.login(settings["username"], settings["password"])
                s.send_message(msg)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Email Notifications ─────────────────────────────────

async def check_and_notify(employee_pk: int) -> dict:
    emp = await get_employee(employee_pk)
    if not emp:
        return {"notified": False, "reason": "Employee not found"}

    recent = await fetch_one(
        """SELECT MAX(notified_at) as last FROM email_notifications WHERE employee_id = ?""",
        (employee_pk,),
    )
    since = 0
    if recent and recent["last"]:
        dt = datetime.fromisoformat(recent["last"])
        since = dt.timestamp()

    threat_count = 0
    if since > 0:
        row = await fetch_one(
            """SELECT COUNT(*) as cnt FROM events e
               JOIN devices d ON e.device_id = d.id
               WHERE d.employee_id = ? AND e.timestamp > ? AND e.risk_level IN ('HIGH','CRITICAL')""",
            (employee_pk, since),
        )
        if row:
            threat_count = row["cnt"]
    else:
        rows = await fetch_all(
            """SELECT COUNT(*) as cnt FROM events e
               JOIN devices d ON e.device_id = d.id
               WHERE d.employee_id = ? AND e.risk_level IN ('HIGH','CRITICAL')""",
            (employee_pk,),
        )
        if rows:
            threat_count = rows[0]["cnt"]

    THRESHOLD = 3
    if threat_count >= THRESHOLD:
        await execute(
            "INSERT INTO email_notifications (employee_id, threat_count) VALUES (?,?)",
            (employee_pk, threat_count),
        )
        sent = await send_email(
            emp["email"],
            f"Sentinel AI Alert — {threat_count} threats on {emp['name']}'s device",
            f"""Sentinel AI - Security Alert

Employee: {emp['name']} ({emp['email']})
Recent high/critical threats: {threat_count}

Please review the security dashboard for details.

This is an automated alert from Sentinel AI.
100% local — no data leaves your device.""",
        )
        if sent["success"]:
            logger.info(
                "EMAIL SENT to %s (%s) — %d high/critical threats",
                emp["name"], emp["email"], threat_count,
            )
        else:
            logger.info(
                "NOTIFICATION: %s (%s) has %d high/critical threats (email: %s)",
                emp["name"], emp["email"], threat_count, sent.get("error", "SMTP not configured"),
            )
        return {
            "notified": True,
            "email_sent": sent["success"],
            "email_error": sent.get("error"),
            "employee": emp["name"],
            "email": emp["email"],
            "threat_count": threat_count,
        }
    return {
        "notified": False,
        "employee": emp["name"],
        "email": emp["email"],
        "threat_count": threat_count,
        "reason": f"Below threshold ({threat_count}/{THRESHOLD})",
    }


async def list_notifications(limit: int = 50) -> List[Dict[str, Any]]:
    return await fetch_all(
        """SELECT n.*, e.name as employee_name, e.email as employee_email
           FROM email_notifications n
           JOIN employees e ON n.employee_id = e.id
           ORDER BY n.notified_at DESC LIMIT ?""",
        (limit,),
    )


# ── Clear Events ─────────────────────────────────────────

async def clear_events() -> int:
    rows = await fetch_all("SELECT COUNT(*) as cnt FROM events")
    count = rows[0]["cnt"] if rows else 0
    await execute("DELETE FROM events")
    await execute("DELETE FROM email_notifications")
    return count


# ── Server Device ──────────────────────────────────────

_server_pk: Optional[int] = None

async def get_server_device_pk() -> int:
    global _server_pk
    if _server_pk is None:
        hostname = socket.gethostname()
        try:
            ip = socket.gethostbyname(hostname)
        except Exception:
            ip = "127.0.0.1"
        _server_pk = await register_device(hostname, hostname, ip)
    return _server_pk


# ── Initialize tables at module load ────────────────────

try:
    _init()
    logger.info("Database tables ready at %s", DB_PATH)
except Exception as e:
    logger.warning("Could not initialize database: %s", e)
