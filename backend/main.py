import asyncio
import socket
import logging
from typing import Optional
from fastapi import FastAPI, WebSocket, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from api.websocket import websocket_endpoint, notifier
from services.clipboard_service import start_clipboard_monitor
from services.screenshot_service import start_screenshot_monitor
from services.monitor_state import monitor_state
from database import init_db, get_server_device_pk

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Sentinel AI MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()
    pk = await get_server_device_pk()
    logger.info("Server device registered (pk=%s)", pk)
    asyncio.create_task(start_clipboard_monitor())
    asyncio.create_task(start_screenshot_monitor())


@app.websocket("/ws")
async def ws_route(ws: WebSocket):
    await websocket_endpoint(ws)


# ── Health ──────────────────────────────────────────────

@app.get("/api/health")
async def health():
    pk = await get_server_device_pk()
    return {
        "status": "ok",
        "hostname": socket.gethostname(),
        "device_pk": pk,
    }


# ── Monitoring Policies ──────────────────────────────────

@app.get("/api/policies")
async def get_policies():
    """Return the current monitoring feature flags."""
    return monitor_state.to_dict()


class PolicyUpdate(BaseModel):
    clipboard_enabled: Optional[bool] = None
    screenshot_enabled: Optional[bool] = None
    live_monitor_enabled: Optional[bool] = None
    file_upload_detection_enabled: Optional[bool] = None
    monitored_apps: Optional[list] = None
    monitored_websites: Optional[list] = None
    block_high_critical: Optional[bool] = None
    warn_medium: Optional[bool] = None
    auto_sanitize: Optional[bool] = None
    log_all: Optional[bool] = None
    allow_low: Optional[bool] = None


@app.put("/api/policies")
async def update_policies(body: PolicyUpdate):
    """Update any subset of monitoring flags — changes take effect immediately."""
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    monitor_state.update(payload)
    return monitor_state.to_dict()


# ── Events ──────────────────────────────────────────────

@app.get("/api/events")
async def list_events(
    limit: int = Query(200, le=1000),
    offset: int = Query(0, ge=0),
    risk_level: Optional[str] = None,
    employee_id: Optional[int] = None,
):
    from database import get_events, get_event_count
    events = await get_events(limit=limit, offset=offset, risk_level=risk_level, employee_id=employee_id)
    total = await get_event_count(risk_level=risk_level, employee_id=employee_id)
    return {"events": events, "total": total, "limit": limit, "offset": offset}


@app.delete("/api/events/clear")
async def clear_all_events():
    from database import clear_events
    count = await clear_events()
    return {"cleared": True, "deleted_count": count}


@app.get("/api/events/{event_id}")
async def get_event(event_id: str):
    from database import fetch_one
    row = await fetch_one("SELECT * FROM events WHERE id = ?", (event_id,))
    if not row:
        raise HTTPException(404, "Event not found")
    return row


# ── Employees ───────────────────────────────────────────

class EmployeeCreate(BaseModel):
    name: str
    email: str
    employee_id: str = ""


class EmployeeUpdate(BaseModel):
    name: str
    email: str
    employee_id: str = ""


@app.get("/api/employees")
async def list_employees():
    from database import list_employees
    return await list_employees()


@app.post("/api/employees")
async def create_employee(body: EmployeeCreate):
    from database import create_employee
    pk = await create_employee(body.name, body.email, body.employee_id)
    from database import get_employee
    emp = await get_employee(pk)
    return emp


@app.put("/api/employees/{pk}")
async def update_employee(pk: int, body: EmployeeUpdate):
    from database import update_employee, get_employee
    await update_employee(pk, body.name, body.email, body.employee_id)
    emp = await get_employee(pk)
    if not emp:
        raise HTTPException(404, "Employee not found")
    return emp


@app.delete("/api/employees/{pk}")
async def delete_employee(pk: int):
    from database import delete_employee, get_employee
    emp = await get_employee(pk)
    if not emp:
        raise HTTPException(404, "Employee not found")
    await delete_employee(pk)
    return {"deleted": True, "id": pk}


# ── Devices ─────────────────────────────────────────────

@app.get("/api/device")
async def current_device():
    from database import get_server_device_pk, list_devices
    pk = await get_server_device_pk()
    devices = await list_devices()
    for d in devices:
        if d["id"] == pk:
            return d
    return {"id": pk, "note": "Server device"}


@app.get("/api/devices")
async def list_devices_endpoint():
    from database import list_devices
    return await list_devices()


class AssignBody(BaseModel):
    employee_id: Optional[int] = None


@app.put("/api/devices/{pk}/assign")
async def assign_device(pk: int, body: AssignBody):
    from database import assign_device
    await assign_device(pk, body.employee_id)
    from database import fetch_one
    dev = await fetch_one("SELECT * FROM devices WHERE id = ?", (pk,))
    return dev


# ── Notifications ───────────────────────────────────────

@app.get("/api/notifications")
async def list_notifications():
    from database import list_notifications
    return await list_notifications()


@app.post("/api/notifications/check/{employee_id}")
async def check_notifications(employee_id: int):
    from database import check_and_notify
    result = await check_and_notify(employee_id)
    return result


@app.post("/api/notifications/check-all")
async def check_all_notifications():
    from database import list_employees, check_and_notify
    employees = await list_employees()
    results = []
    for emp in employees:
        r = await check_and_notify(emp["id"])
        results.append(r)
    return {"results": results}


# ── SMTP Settings ───────────────────────────────────────

class SmtpSettingsBody(BaseModel):
    host: str = ""
    port: int = 587
    username: str = ""
    password: str = ""
    use_tls: bool = True
    from_email: str = ""
    enabled: bool = False


@app.get("/api/settings/smtp")
async def get_smtp():
    from database import get_smtp_settings
    return await get_smtp_settings()


@app.put("/api/settings/smtp")
async def update_smtp(body: SmtpSettingsBody):
    from database import save_smtp_settings
    await save_smtp_settings(body.model_dump())
    from database import get_smtp_settings
    return await get_smtp_settings()


@app.post("/api/settings/smtp/test")
async def test_smtp(body: SmtpSettingsBody):
    from database import save_smtp_settings, send_email, get_smtp_settings
    original = await get_smtp_settings()
    config = body.model_dump()
    config["enabled"] = True
    await save_smtp_settings(config)
    recipient = body.from_email or body.username or "test@example.com"
    result = await send_email(recipient, "Sentinel AI Test", "SMTP configuration works!")
    if original.get("enabled") != config["enabled"]:
        original["enabled"] = original.get("enabled", False)
        await save_smtp_settings(original)
    return result
