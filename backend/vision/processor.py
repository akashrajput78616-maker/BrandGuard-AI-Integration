"""
Visual Governance Processor.
Coordinates file ingestion (images, slides, banners), dominant color extraction,
Delta-E brand color validation, WCAG 2.1 contrast audits, and Gemini Vision multi-modal review.
Produces a comprehensive brand compliance scorecard with bounding-box annotations.
"""

import io
import logging
from typing import List, Dict, Any, Optional
from PIL import Image

from .delta_e import DEFAULT_ACME_PALETTE, compare_against_brand_palette
from .contrast import evaluate_wcag, contrast_ratio
from .palette import extract_dominant_colors
from .gemini_vision import inspect_visual_with_gemini

logger = logging.getLogger("brandguard.vision_processor")


class VisualAuditReport:
    """Standardized result structure for a visual asset audit."""
    def __init__(
        self,
        filename: str,
        dimensions: Dict[str, int],
        file_size_bytes: int,
        dominant_colors: List[Dict[str, Any]],
        contrast_checks: List[Dict[str, Any]],
        vision_findings: List[Dict[str, Any]],
        vision_summary: str,
        overall_score: int,
        compliance_status: str,
        recommendations: List[str],
    ):
        self.filename = filename
        self.dimensions = dimensions
        self.file_size_bytes = file_size_bytes
        self.dominant_colors = dominant_colors
        self.contrast_checks = contrast_checks
        self.vision_findings = vision_findings
        self.vision_summary = vision_summary
        self.overall_score = overall_score
        self.compliance_status = compliance_status
        self.recommendations = recommendations

    def to_dict(self) -> Dict[str, Any]:
        return {
            "filename": self.filename,
            "dimensions": self.dimensions,
            "file_size_bytes": self.file_size_bytes,
            "dominant_colors": self.dominant_colors,
            "contrast_checks": self.contrast_checks,
            "vision_findings": self.vision_findings,
            "vision_summary": self.vision_summary,
            "overall_score": self.overall_score,
            "compliance_status": self.compliance_status,
            "recommendations": self.recommendations,
        }


async def audit_visual_asset(
    image_bytes: bytes,
    filename: str,
    mime_type: str = "image/png",
    api_key: Optional[str] = None,
    approved_palette: Optional[List[Dict[str, Any]]] = None,
    model: str = "gemini-2.5-flash",
) -> Dict[str, Any]:
    """
    Performs full visual brand governance pipeline on an image or slide asset.
    """
    if approved_palette is None:
        approved_palette = DEFAULT_ACME_PALETTE

    file_size = len(image_bytes)

    # 1. Parse Image Dimensions
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        width, height = pil_img.size
        format_name = pil_img.format or "UNKNOWN"
    except Exception as exc:
        logger.error("Failed to parse image file %s: %s", filename, exc)
        return {
            "error": f"Invalid or unreadable image file: {exc}",
            "filename": filename,
            "overall_score": 0,
            "compliance_status": "ERROR"
        }

    # 2. Extract Dominant Colors & Delta-E Evaluation
    dominant_colors = extract_dominant_colors(
        image_bytes,
        k=5,
        approved_palette=approved_palette
    )

    # 3. Perform Contrast Ratio Checks between extracted dominant pairs
    contrast_checks = []
    if len(dominant_colors) >= 2:
        # Check pair: dominant 1 (often background) vs dominant 2 (often text/element)
        c1 = dominant_colors[0]["hex"]
        c2 = dominant_colors[1]["hex"]
        eval_result = evaluate_wcag(c2, c1, font_size_pt=14.0, is_bold=False)
        contrast_checks.append({
            "pair_label": "Dominant Foreground vs Background",
            **eval_result
        })

        # Check against approved brand Navy (#0B1F3A) and White (#FFFFFF)
        eval_navy = evaluate_wcag(dominant_colors[0]["hex"], "#0B1F3A")
        contrast_checks.append({
            "pair_label": "Dominant Primary vs Brand Navy (#0B1F3A)",
            **eval_navy
        })

    # 4. Multi-Modal Vision Inspection (Gemini 2.5 Flash)
    vision_result = await inspect_visual_with_gemini(
        image_bytes=image_bytes,
        mime_type=mime_type,
        api_key=api_key,
        model=model,
    )

    vision_findings = vision_result.get("findings", [])
    vision_summary = vision_result.get("summary", "Visual analysis complete.")

    # 5. Synthesize Overall Compliance Score & Recommendations
    recommendations: List[str] = []

    # Score component 1: Color fidelity (max 40 pts)
    color_points = 40
    off_brand_count = sum(1 for c in dominant_colors if c.get("tolerance") == "Off-brand")
    acceptable_count = sum(1 for c in dominant_colors if c.get("tolerance") == "Acceptable")

    if off_brand_count > 0:
        color_points -= min(30, off_brand_count * 15)
        for c in dominant_colors:
            if c.get("tolerance") == "Off-brand":
                recommendations.append(
                    f"Color {c['hex']} deviates significantly (ΔE = {c.get('delta_e')}) from approved brand palette. "
                    f"Consider aligning to nearest brand color {c.get('nearest_brand_color')}."
                )

    # Score component 2: Contrast (max 30 pts)
    contrast_points = 30
    failed_contrast = sum(1 for check in contrast_checks if not check.get("aa_pass", True))
    if failed_contrast > 0:
        contrast_points -= (failed_contrast * 15)
        for check in contrast_checks:
            if not check.get("aa_pass", True):
                recommendations.extend(check.get("suggestions", []))

    # Score component 3: Visual & Logo Integrity (max 30 pts)
    vision_points = 30
    high_sev = sum(1 for f in vision_findings if f.get("severity") == "HIGH")
    med_sev = sum(1 for f in vision_findings if f.get("severity") == "MEDIUM")
    low_sev = sum(1 for f in vision_findings if f.get("severity") == "LOW")

    vision_deduction = (high_sev * 20) + (med_sev * 10) + (low_sev * 3)
    vision_points = max(0, vision_points - vision_deduction)

    for f in vision_findings:
        if f.get("suggested_fix"):
            recommendations.append(f"{f.get('issue')}: {f.get('suggested_fix')}")

    total_score = max(0, min(100, color_points + contrast_points + vision_points))

    if total_score >= 85:
        compliance_status = "APPROVED_READY"
    elif total_score >= 65:
        compliance_status = "NEEDS_REVISION"
    else:
        compliance_status = "REJECTED_OFF_BRAND"

    report = VisualAuditReport(
        filename=filename,
        dimensions={"width": width, "height": height},
        file_size_bytes=file_size,
        dominant_colors=dominant_colors,
        contrast_checks=contrast_checks,
        vision_findings=vision_findings,
        vision_summary=vision_summary,
        overall_score=total_score,
        compliance_status=compliance_status,
        recommendations=recommendations,
    )

    return report.to_dict()
