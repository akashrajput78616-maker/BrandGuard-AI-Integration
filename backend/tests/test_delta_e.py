"""
Unit tests for CIEDE2000 (Delta-E) calculation and color space conversions.
"""

import pytest
from vision.delta_e import (
    hex_to_rgb,
    rgb_to_xyz,
    xyz_to_lab,
    ciede2000,
    ciede2000_from_hex,
    compare_against_brand_palette,
    DEFAULT_ACME_PALETTE
)


def test_hex_to_rgb():
    assert hex_to_rgb("#0FA3A3") == (15, 163, 163)
    assert hex_to_rgb("0FA3A3") == (15, 163, 163)
    assert hex_to_rgb("#FFF") == (255, 255, 255)
    assert hex_to_rgb("#000000") == (0, 0, 0)


def test_delta_e_identical_colors():
    # Identical colors should have ΔE = 0.0
    de = ciede2000_from_hex("#0FA3A3", "#0FA3A3")
    assert pytest.approx(de, abs=0.01) == 0.0

    de_navy = ciede2000_from_hex("#0B1F3A", "#0B1F3A")
    assert pytest.approx(de_navy, abs=0.01) == 0.0


def test_delta_e_perceptible_vs_distant():
    # Subtle variation of Teal
    de_subtle = ciede2000_from_hex("#0FA3A3", "#12A5A5")
    assert de_subtle < 2.0  # Barely perceptible or acceptable

    # High contrast / distant colors: Navy vs Bright Yellow
    de_distant = ciede2000_from_hex("#0B1F3A", "#FFFF00")
    assert de_distant > 40.0


def test_compare_against_brand_palette():
    # Test brand exact match
    result = compare_against_brand_palette("#0FA3A3", DEFAULT_ACME_PALETTE)
    assert result["nearest_brand_color"] == "#0FA3A3"
    assert result["delta_e"] == 0.0
    assert result["tolerance"] == "Pass"

    # Test an off-brand color (e.g. bright hot pink)
    pink_result = compare_against_brand_palette("#FF1493", DEFAULT_ACME_PALETTE)
    assert pink_result["tolerance"] == "Off-brand"
    assert pink_result["delta_e"] > 10.0
