"""
Unit tests for WCAG 2.1 contrast ratio calculations and AA/AAA evaluation.
"""

import pytest
from vision.contrast import relative_luminance, contrast_ratio, evaluate_wcag


def test_relative_luminance_extremes():
    # Pure black has luminance 0.0, pure white has luminance 1.0
    assert pytest.approx(relative_luminance(0, 0, 0), abs=1e-4) == 0.0
    assert pytest.approx(relative_luminance(255, 255, 255), abs=1e-4) == 1.0


def test_contrast_ratio_black_and_white():
    ratio = contrast_ratio("#000000", "#FFFFFF")
    assert pytest.approx(ratio, abs=0.1) == 21.0

    # Symmetric: order does not matter
    ratio_rev = contrast_ratio("#FFFFFF", "#000000")
    assert ratio == ratio_rev


def test_evaluate_wcag_pass_fail():
    # High contrast: Navy text on White background
    navy_on_white = evaluate_wcag("#0B1F3A", "#FFFFFF", font_size_pt=14.0)
    assert navy_on_white["aa_pass"] is True
    assert navy_on_white["aaa_pass"] is True
    assert navy_on_white["contrast_ratio"] > 10.0
    assert navy_on_white["rating"] == "AAA"

    # Low contrast: Light grey on white
    grey_on_white = evaluate_wcag("#CCCCCC", "#FFFFFF", font_size_pt=14.0)
    assert grey_on_white["aa_pass"] is False
    assert grey_on_white["aaa_pass"] is False
    assert grey_on_white["rating"] == "FAIL"
    assert len(grey_on_white["suggestions"]) > 0
