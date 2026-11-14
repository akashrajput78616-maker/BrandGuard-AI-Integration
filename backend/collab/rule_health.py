"""
Rule Health and Override Analytics Engine.
Tracks human-reviewer decisions across guidelines, calculates override/dismissal rates,
identifies drifting marketing channels, and generates actionable rule rewording suggestions.
"""

import json
import logging
import os
import threading
import time
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("brandguard.rule_health")


class RuleHealthStat(BaseModel):
    rule_id: str
    rule_title: str
    category: str
    findings_count: int
    decisions_count: int
    accepted_count: int
    override_count: int
    override_rate: float  # 0.0 to 100.0 %
    status: str  # 'healthy', 'needs_attention', 'high_drift'
    suggested_amendment: Optional[str] = None


class ChannelDriftStat(BaseModel):
    channel: str
    total_reviews: int
    violations_count: int
    violation_rate: float
    top_violated_rule: str


class RuleHealthStore:
    def __init__(self, storage_path: str = "data/rule_health_store.json"):
        self.lock = threading.Lock()
        self.storage_path = storage_path
        self._seed_data()

    def _seed_data(self):
        # Default enterprise rule health metrics with realistic distributions
        self.rules_stats = [
            RuleHealthStat(
                rule_id="claims",
                rule_title="Claims Policy §3.2 (Substantiated claims)",
                category="Claims",
                findings_count=48,
                decisions_count=44,
                accepted_count=31,
                override_count=13,
                override_rate=29.5,
                status="needs_attention",
                suggested_amendment="Clarify allowed terminology for comparative sync speeds when referencing 2026 third-party audit reports.",
            ),
            RuleHealthStat(
                rule_id="tone",
                rule_title="Voice & Tone §1.4 (Confident, clear, helpful)",
                category="Tone",
                findings_count=35,
                decisions_count=32,
                accepted_count=19,
                override_count=13,
                override_rate=40.6,
                status="high_drift",
                suggested_amendment="Allow energetic language in product launch social teasers while maintaining clear facts in formal announcements.",
            ),
            RuleHealthStat(
                rule_id="terms",
                rule_title="Terminology Guide §2.1 (Acme CloudSync naming)",
                category="Terminology",
                findings_count=62,
                decisions_count=60,
                accepted_count=56,
                override_count=4,
                override_rate=6.7,
                status="healthy",
                suggested_amendment=None,
            ),
            RuleHealthStat(
                rule_id="access",
                rule_title="Accessibility Standard §4.1 (Alt text & contrast)",
                category="Accessibility",
                findings_count=22,
                decisions_count=21,
                accepted_count=19,
                override_count=2,
                override_rate=9.5,
                status="healthy",
                suggested_amendment=None,
            ),
            RuleHealthStat(
                rule_id="facts",
                rule_title="Approved Facts §2.4 (Storage limits & recovery)",
                category="Facts",
                findings_count=28,
                decisions_count=27,
                accepted_count=24,
                override_count=3,
                override_rate=11.1,
                status="healthy",
                suggested_amendment=None,
            ),
        ]

        self.channels_stats = [
            ChannelDriftStat(
                channel="Instagram & Social",
                total_reviews=42,
                violations_count=19,
                violation_rate=45.2,
                top_violated_rule="Voice & Tone §1.4",
            ),
            ChannelDriftStat(
                channel="Product & App Copy",
                total_reviews=68,
                violations_count=9,
                violation_rate=13.2,
                top_violated_rule="Terminology Guide §2.1",
            ),
            ChannelDriftStat(
                channel="Blog & Press Releases",
                total_reviews=34,
                violations_count=12,
                violation_rate=35.3,
                top_violated_rule="Claims Policy §3.2",
            ),
            ChannelDriftStat(
                channel="Lifecycle & Email",
                total_reviews=51,
                violations_count=8,
                violation_rate=15.7,
                top_violated_rule="Accessibility Standard §4.1",
            ),
        ]

    def record_decision(self, rule_id: str, decision: str):
        """Record human reviewer decision: 'accepted' or 'dismissed'/'overridden'"""
        with self.lock:
            for r in self.rules_stats:
                if r.rule_id == rule_id:
                    r.findings_count += 1
                    r.decisions_count += 1
                    if decision.lower() in ("accepted", "approved"):
                        r.accepted_count += 1
                    else:
                        r.override_count += 1
                    r.override_rate = round((r.override_count / max(1, r.decisions_count)) * 100, 1)
                    if r.override_rate > 35:
                        r.status = "high_drift"
                    elif r.override_rate > 20:
                        r.status = "needs_attention"
                    else:
                        r.status = "healthy"
                    break

    def get_summary(self) -> dict:
        with self.lock:
            total_findings = sum(r.findings_count for r in self.rules_stats)
            total_decisions = sum(r.decisions_count for r in self.rules_stats)
            total_overrides = sum(r.override_count for r in self.rules_stats)
            avg_override_rate = round((total_overrides / max(1, total_decisions)) * 100, 1)
            needing_attention = len([r for r in self.rules_stats if r.status != "healthy"])
            
            top_drift = max(self.channels_stats, key=lambda c: c.violation_rate) if self.channels_stats else None

            return {
                "total_rules_tracked": len(self.rules_stats),
                "total_findings": total_findings,
                "total_overrides": total_overrides,
                "average_override_rate": avg_override_rate,
                "rules_needing_attention": needing_attention,
                "top_drifting_channel": top_drift.model_dump() if top_drift else None,
                "rules": [r.model_dump() for r in self.rules_stats],
                "channels": [c.model_dump() for c in self.channels_stats],
            }


rule_health_store = RuleHealthStore()
