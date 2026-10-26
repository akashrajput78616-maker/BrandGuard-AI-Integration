"""
Real-time WebSocket Room Hub for Collaborative Co-editing, Presence, Cursors, and Events.
Connections are authenticated via JWT tokens and scoped per tenant & draft room.
"""

import asyncio
import json
import logging
from typing import Dict, List, Set
from fastapi import WebSocket, WebSocketDisconnect

from auth.models import AuthenticatedUser

logger = logging.getLogger("brandguard.ws_hub")

# Assign distinctive avatar colors for real-time collaborator cursors
COLLAB_COLORS = [
    "#0FA3A3",  # Brand Teal
    "#6B5BD6",  # Indigo
    "#E8962E",  # Amber
    "#2E9E6B",  # Emerald
    "#D64545",  # Coral
    "#0ea5e9",  # Sky
]


class ConnectionContext:
    def __init__(self, websocket: WebSocket, user: AuthenticatedUser, color: str):
        self.websocket = websocket
        self.user = user
        self.color = color


class RealtimeHub:
    def __init__(self):
        # Room key: f"{tenant_id}:{draft_id}" -> List[ConnectionContext]
        self.rooms: Dict[str, List[ConnectionContext]] = {}
        # Draft text cache: f"{tenant_id}:{draft_id}" -> {"content": str, "version": int}
        self.draft_state: Dict[str, dict] = {}
        self.lock = asyncio.Lock()

    def _get_room_key(self, tenant_id: str, draft_id: str) -> str:
        return f"{tenant_id}:{draft_id}"

    async def connect(self, websocket: WebSocket, tenant_id: str, draft_id: str, user: AuthenticatedUser):
        await websocket.accept()
        room_key = self._get_room_key(tenant_id, draft_id)

        async with self.lock:
            if room_key not in self.rooms:
                self.rooms[room_key] = []
            
            # Select color based on user index
            color_idx = len(self.rooms[room_key]) % len(COLLAB_COLORS)
            color = COLLAB_COLORS[color_idx]

            ctx = ConnectionContext(websocket, user, color)
            self.rooms[room_key].append(ctx)

        logger.info(f"User {user.name} ({user.role}) connected to draft room {room_key}. Total in room: {len(self.rooms[room_key])}")

        # Broadcast updated presence to everyone in the room
        await self.broadcast_presence(room_key)

        # Send current draft state to the newly connected user
        if room_key in self.draft_state:
            await websocket.send_json({
                "type": "state_sync",
                "content": self.draft_state[room_key].get("content", ""),
                "version": self.draft_state[room_key].get("version", 1),
            })

    async def disconnect(self, websocket: WebSocket, tenant_id: str, draft_id: str):
        room_key = self._get_room_key(tenant_id, draft_id)
        async with self.lock:
            if room_key in self.rooms:
                self.rooms[room_key] = [c for c in self.rooms[room_key] if c.websocket != websocket]
                if not self.rooms[room_key]:
                    del self.rooms[room_key]

        logger.info(f"Connection closed for room {room_key}")
        await self.broadcast_presence(room_key)

    async def broadcast_presence(self, room_key: str):
        """Broadcasts current list of online users in the document room."""
        if room_key not in self.rooms:
            return

        presence_list = [
            {
                "user_id": c.user.user_id,
                "name": c.user.name,
                "role": c.user.role.value if hasattr(c.user.role, "value") else str(c.user.role),
                "avatar_url": c.user.avatar_url,
                "color": c.color,
            }
            for c in self.rooms[room_key]
        ]

        payload = {
            "type": "presence",
            "users": presence_list,
            "count": len(presence_list),
        }
        await self._broadcast_to_room(room_key, payload)

    async def broadcast_cursor(self, room_key: str, user_id: str, cursor_data: dict):
        """Broadcasts cursor coordinates and selection range."""
        payload = {
            "type": "cursor",
            "user_id": user_id,
            "position": cursor_data.get("position", 0),
            "selection_start": cursor_data.get("selection_start"),
            "selection_end": cursor_data.get("selection_end"),
        }
        await self._broadcast_to_room(room_key, payload, exclude_user_id=user_id)

    async def broadcast_content_change(self, room_key: str, user_id: str, change_data: dict):
        """Broadcasts text changes and updates server draft state."""
        content = change_data.get("content", "")
        version = change_data.get("version", 1)

        self.draft_state[room_key] = {"content": content, "version": version}

        payload = {
            "type": "content_change",
            "user_id": user_id,
            "content": content,
            "version": version,
        }
        await self._broadcast_to_room(room_key, payload, exclude_user_id=user_id)

    async def broadcast_comment_event(self, tenant_id: str, draft_id: str, event_data: dict):
        """Broadcasts a new comment, reply, or resolve/reopen event to all room collaborators."""
        room_key = self._get_room_key(tenant_id, draft_id)
        payload = {
            "type": "comment_event",
            "action": event_data.get("action", "created"),
            "comment": event_data.get("comment"),
        }
        await self._broadcast_to_room(room_key, payload)

    async def broadcast_status_change(self, tenant_id: str, draft_id: str, new_status: str, changed_by: str):
        """Broadcasts approval state transition (Draft -> In Review -> Approved/Rejected)."""
        room_key = self._get_room_key(tenant_id, draft_id)
        payload = {
            "type": "status_change",
            "status": new_status,
            "changed_by": changed_by,
        }
        await self._broadcast_to_room(room_key, payload)

    async def _broadcast_to_room(self, room_key: str, message: dict, exclude_user_id: str = None):
        if room_key not in self.rooms:
            return

        dead_connections = []
        for ctx in list(self.rooms[room_key]):
            if exclude_user_id and ctx.user.user_id == exclude_user_id:
                continue
            try:
                await ctx.websocket.send_json(message)
            except Exception:
                dead_connections.append(ctx)

        if dead_connections:
            async with self.lock:
                if room_key in self.rooms:
                    self.rooms[room_key] = [c for c in self.rooms[room_key] if c not in dead_connections]


ws_hub = RealtimeHub()
