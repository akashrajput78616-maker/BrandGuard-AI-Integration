"""
Unit tests for visual governance processor with synthesized test images.
"""

import io
import pytest
from PIL import Image, ImageDraw
from vision.processor import audit_visual_asset


@pytest.mark.asyncio
async def test_audit_visual_asset_synthesized_image():
    # Synthesize an image: 200x200 with Navy (#0B1F3A) top half and Teal (#0FA3A3) bottom half
    img = Image.new("RGB", (200, 200), color="#0B1F3A")
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 100, 200, 200], fill="#0FA3A3")

    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    png_bytes = img_byte_arr.getvalue()

    report = await audit_visual_asset(
        image_bytes=png_bytes,
        filename="test_brand_banner.png",
        mime_type="image/png",
        api_key=None,  # Tests deterministic fallback
    )

    assert "error" not in report
    assert report["filename"] == "test_brand_banner.png"
    assert report["dimensions"]["width"] == 200
    assert report["dimensions"]["height"] == 200
    assert len(report["dominant_colors"]) > 0
    assert report["overall_score"] > 0
    assert "compliance_status" in report
    assert len(report["contrast_checks"]) > 0
    assert len(report["vision_findings"]) > 0


def test_api_vision_palette():
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as client:
        res = client.get("/api/vision/palette")
        assert res.status_code == 200
        data = res.json()
        assert "palette" in data
        assert len(data["palette"]) >= 4


def test_api_vision_check_color():
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as client:
        res = client.post("/api/vision/check-color", json={"hex": "#0FA3A3", "tolerance": 5.0})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "Pass"
        assert data["delta_e"] == 0.0


def test_api_vision_check_contrast():
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as client:
        res = client.post(
            "/api/vision/check-contrast",
            json={"text_color": "#0B1F3A", "background_color": "#FFFFFF", "font_size_pt": 14.0}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["aa_pass"] is True
        assert data["rating"] == "AAA"


def test_api_vision_audit_upload(monkeypatch):
    from fastapi.testclient import TestClient
    from main import app, gemini_agent
    
    # Mock get_active_key to return None so test uses fast local heuristic without API quota
    monkeypatch.setattr(gemini_agent, "get_active_key", lambda: None)

    with TestClient(app) as client:
        img = Image.new("RGB", (100, 100), color="#0FA3A3")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        res = client.post(
            "/api/vision/audit",
            files={"file": ("test_logo.png", buf, "image/png")}
        )
        assert res.status_code == 200
        data = res.json()
        assert "overall_score" in data
        assert "dominant_colors" in data
        assert "vision_findings" in data


