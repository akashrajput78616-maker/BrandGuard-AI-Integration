"""
WCAG 2.1 Contrast Ratio and Relative Luminance Engine.
Implements W3C WCAG 2.1 Success Criteria 1.4.3 (Contrast Minimum - Level AA)
and 1.4.6 (Contrast Enhanced - Level AAA).
"""

from typing import Tuple, Dict, Any
from .delta_e import hex_to_rgb


def relative_luminance(r: int, g: int, b: int) -> float:
    """
    Computes WCAG 2.1 relative luminance L in [0.0, 1.0].
    L = 0.2126 * R_lin + 0.7152 * G_lin + 0.0722 * B_lin
    """
    def channel_linear(val: int) -> float:
        s = val / 255.0
        return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4

    r_lin = channel_linear(r)
    g_lin = channel_linear(g)
    b_lin = channel_linear(b)
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin


def contrast_ratio(color1_hex: str, color2_hex: str) -> float:
    """
    Computes WCAG 2.1 contrast ratio between two hex colors:
    (L1 + 0.05) / (L2 + 0.05) where L1 is the lighter color.
    Returns value between 1.0 and 21.0.
    """
    r1, g1, b1 = hex_to_rgb(color1_hex)
    r2, g2, b2 = hex_to_rgb(color2_hex)

    l1 = relative_luminance(r1, g1, b1)
    l2 = relative_luminance(r2, g2, b2)

    lighter = max(l1, l2)
    darker = min(l1, l2)

    ratio = (lighter + 0.05) / (darker + 0.05)
    return round(ratio, 2)


def evaluate_wcag(
    text_color_hex: str,
    background_color_hex: str,
    font_size_pt: float = 14.0,
    is_bold: bool = False
) -> Dict[str, Any]:
    """
    Evaluates contrast between text and background against WCAG 2.1 Level AA & AAA.
    Large text is defined as >= 18pt (24px) or >= 14pt (18.66px) bold.
    """
    ratio = contrast_ratio(text_color_hex, background_color_hex)
    is_large_text = font_size_pt >= 18.0 or (font_size_pt >= 14.0 and is_bold)

    # Thresholds:
    # AA Normal: 4.5:1, AA Large: 3:1
    # AAA Normal: 7:1, AAA Large: 4.5:1
    aa_threshold = 3.0 if is_large_text else 4.5
    aaa_threshold = 4.5 if is_large_text else 7.0

    aa_pass = ratio >= aa_threshold
    aaa_pass = ratio >= aaa_threshold

    # Suggestion if failed
    suggestions = []
    if not aa_pass:
        suggestions.append(
            f"Increase contrast between text ({text_color_hex}) and background ({background_color_hex}) "
            f"from {ratio}:1 to at least {aa_threshold}:1 for WCAG Level AA."
        )
    elif not aaa_pass:
        suggestions.append(
            f"Contrast passes Level AA ({ratio}:1) but fails Level AAA requirement ({aaa_threshold}:1)."
        )

    return {
        "text_color": text_color_hex,
        "background_color": background_color_hex,
        "contrast_ratio": ratio,
        "is_large_text": is_large_text,
        "aa_required": aa_threshold,
        "aaa_required": aaa_threshold,
        "aa_pass": aa_pass,
        "aaa_pass": aaa_pass,
        "rating": "AAA" if aaa_pass else ("AA" if aa_pass else "FAIL"),
        "suggestions": suggestions,
    }
