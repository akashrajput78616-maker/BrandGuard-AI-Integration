"""
Slack and Microsoft Teams Webhook Notification Dispatcher with Exponential Backoff Retries.
Configurable per organization for review requests, comments, and approval decisions.
"""

import asyncio
import json
import logging
import os
import threading
import time
import uuid
from typing import Dict, List, Optional
import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger("brandguard.webhooks")


class WebhookConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    platform: str  # 'slack' or 'teams'
    url: str
    events: List[str] = Field(
        default_factory=lambda: [
            "review_requested",
            "comment_added",
            "decision_approved",
            "decision_rejected",
        ]
    )
    enabled: bool = True
    created_at: float = Field(default_factory=time.time)


class WebhookStore:
    def __init__(self, storage_path: str = "data/webhooks_store.json"):
        self.lock = threading.Lock()
        self.storage_path = storage_path
        self.webhooks: Dict[str, WebhookConfig] = {}
        self._load()

    def _load(self):
        if not os.path.exists(self.storage_path):
            return
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    w = WebhookConfig(**item)
                    self.webhooks[w.id] = w
        except Exception as e:
            logger.warning(f"Error loading webhooks: {e}")

    def _save(self):
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump([w.model_dump() for w in self.webhooks.values()], f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Failed to persist webhooks: {e}")

    def list_webhooks(self, tenant_id: str) -> List[WebhookConfig]:
        with self.lock:
            return [w for w in self.webhooks.values() if w.tenant_id == tenant_id]

    def add_webhook(self, tenant_id: str, platform: str, url: str, events: List[str] = None) -> WebhookConfig:
        with self.lock:
            cfg = WebhookConfig(
                tenant_id=tenant_id,
                platform=platform.lower(),
                url=url,
                events=events or ["review_requested", "comment_added", "decision_approved", "decision_rejected"],
            )
            self.webhooks[cfg.id] = cfg
            self._save()
            return cfg

    def delete_webhook(self, tenant_id: str, webhook_id: str) -> bool:
        with self.lock:
            if webhook_id in self.webhooks and self.webhooks[webhook_id].tenant_id == tenant_id:
                del self.webhooks[webhook_id]
                self._save()
                return True
            return False


webhook_store = WebhookStore()


def format_slack_payload(event: str, title: str, details: dict) -> dict:
    color_map = {
        "decision_approved": "#2E9E6B",
        "decision_rejected": "#D64545",
        "review_requested": "#E8962E",
        "comment_added": "#0FA3A3",
    }
    return {
        "attachments": [
            {
                "color": color_map.get(event, "#0FA3A3"),
                "blocks": [
                    {
                        "type": "header",
                        "text": {"type": "plain_text", "text": f"🛡️ BrandGuard: {title}"},
                    },
                    {
                        "type": "section",
                        "fields": [
                            {"type": "mrkdwn", "text": f"*Event:*\n`{event}`"},
                            {"type": "mrkdwn", "text": f"*Triggered By:*\n{details.get('by', 'System')}"},
                        ],
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Summary:*\n{details.get('summary', 'Action performed on brand content')}",
                        },
                    },
                ],
            }
        ]
    }


def format_teams_payload(event: str, title: str, details: dict) -> dict:
    color_map = {
        "decision_approved": "2E9E6B",
        "decision_rejected": "D64545",
        "review_requested": "E8962E",
        "comment_added": "0FA3A3",
    }
    return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": color_map.get(event, "0FA3A3"),
        "summary": title,
        "sections": [
            {
                "activityTitle": f"🛡️ BrandGuard: {title}",
                "activitySubtitle": f"Event: {event} | By: {details.get('by', 'User')}",
                "facts": [
                    {"name": "Draft Title", "value": details.get("draft_title", "Marketing Draft")},
                    {"name": "Action", "value": details.get("summary", "")},
                    {"name": "Timestamp", "value": time.strftime("%Y-%m-%d %H:%M:%S")},
                ],
                "markdown": True,
            }
        ],
    }


async def send_webhook_with_retry(
    client: httpx.AsyncClient,
    url: str,
    payload: dict,
    max_retries: int = 3,
    initial_delay: float = 1.0,
) -> bool:
    """Dispatches webhook HTTP POST with exponential backoff."""
    delay = initial_delay
    for attempt in range(1, max_retries + 1):
        try:
            resp = await client.post(url, json=payload, timeout=5.0)
            if resp.status_code in (200, 204):
                logger.info(f"Webhook delivered to {url[:40]}... on attempt {attempt}")
                return True
            logger.warning(f"Webhook returned {resp.status_code} (attempt {attempt}/{max_retries})")
        except Exception as err:
            logger.warning(f"Webhook connection error: {err} (attempt {attempt}/{max_retries})")

        if attempt < max_retries:
            await asyncio.sleep(delay)
            delay *= 2.0

    return False


async def dispatch_webhook_event(
    tenant_id: str,
    event: str,
    title: str,
    details: dict,
):
    """Asynchronously dispatches webhook to all registered Slack & Teams endpoints for tenant."""
    webhooks = webhook_store.list_webhooks(tenant_id)
    active = [w for w in webhooks if w.enabled and event in w.events]
    if not active:
        return

    async with httpx.AsyncClient() as client:
        tasks = []
        for w in active:
            if w.platform == "slack":
                payload = format_slack_payload(event, title, details)
            else:
                payload = format_teams_payload(event, title, details)
            tasks.append(send_webhook_with_retry(client, w.url, payload))

        await asyncio.gather(*tasks, return_exceptions=True)
