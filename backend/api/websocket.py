import json
import asyncio
import logging
# pyrefly: ignore [missing-import]
from fastapi import WebSocket, WebSocketDisconnect
from typing import List

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL = 20  # seconds — keep connection alive during long inference


class Notifier:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.connections.append(websocket)
        logger.info("WebSocket client connected. Total: %d", len(self.connections))

    def remove(self, websocket: WebSocket):
        if websocket in self.connections:
            self.connections.remove(websocket)
            logger.info("WebSocket client removed. Total: %d", len(self.connections))

    async def _notify(self, message: str):
        """Broadcast to all living connections without destroying the list on failure."""
        dead: List[WebSocket] = []
        # Iterate over a snapshot — never pop mid-loop so a crash can't lose connections
        for websocket in list(self.connections):
            try:
                await websocket.send_text(message)
            except (WebSocketDisconnect, RuntimeError, Exception) as e:
                logger.warning("WebSocket send failed (%s) — marking dead", e)
                dead.append(websocket)
        # Clean up dead connections after the loop
        for ws in dead:
            self.remove(ws)

    async def notify(self, message: dict):
        await self._notify(json.dumps(message))


notifier = Notifier()


async def _keepalive(websocket: WebSocket):
    """Send a ping every HEARTBEAT_INTERVAL seconds to prevent idle timeout
    during long AI inference runs that can take 3-30 seconds."""
    while True:
        await asyncio.sleep(HEARTBEAT_INTERVAL)
        try:
            # Send a lightweight JSON ping — frontend ignores unknown message types
            await websocket.send_text(json.dumps({"type": "ping"}))
        except Exception:
            break


async def websocket_endpoint(websocket: WebSocket):
    await notifier.connect(websocket)
    # Start keepalive task for this connection
    keepalive_task = asyncio.create_task(_keepalive(websocket))
    try:
        while True:
            # Keep the receive loop running; handle both disconnect and unexpected errors
            try:
                data = await websocket.receive_text()
                # Echo back pong for client-initiated pings
                if data == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.warning("WebSocket receive error: %s", e)
                break
    finally:
        keepalive_task.cancel()
        notifier.remove(websocket)
