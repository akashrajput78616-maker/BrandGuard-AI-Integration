"""
CIEDE2000 (Delta-E 2000) Color Difference Engine.
Accurately computes perceptual color differences according to CIE ISO/CIE 11664-6:2014.
Converts sRGB -> CIE XYZ -> CIE L*a*b* using standard D65 2° illuminant.
"""

import math
from typing import List, Tuple, Any

# Standard D65 reference white points (2° observer)
REF_X = 95.047
REF_Y = 100.000
REF_Z = 108.883


def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Parses a hex color string like '#0FA3A3' into (R, G, B) in range [0, 255]."""
    cleaned = hex_color.strip().lstrip("#")
    if len(cleaned) == 3:
        cleaned = "".join(c * 2 for c in cleaned)
    if len(cleaned) != 6:
        return (0, 0, 0)
    return (
        int(cleaned[0:2], 16),
        int(cleaned[2:4], 16),
        int(cleaned[4:6], 16),
    )


def rgb_to_xyz(r: int, g: int, b: int) -> Tuple[float, float, float]:
    """Converts sRGB [0..255] to CIE XYZ using sRGB gamma expansion and standard matrix."""
    # 1. Normalize and gamma expansion (linearize sRGB)
    def pivot(v: float) -> float:
        v = v / 255.0
        return ((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92

    lr = pivot(r) * 100.0
    lg = pivot(g) * 100.0
    lb = pivot(b) * 100.0

    # 2. Standard sRGB to XYZ transformation matrix (D65)
    x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375
    y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750
    z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041

    return (x, y, z)


def xyz_to_lab(x: float, y: float, z: float) -> Tuple[float, float, float]:
    """Converts CIE XYZ to CIE L*a*b* relative to D65 reference white point."""
    xr = x / REF_X
    yr = y / REF_Y
    zr = z / REF_Z

    epsilon = 0.008856  # 216 / 24389
    kappa = 903.3       # 24389 / 27

    def f(val: float) -> float:
        return val ** (1.0 / 3.0) if val > epsilon else (kappa * val + 16.0) / 116.0

    fx = f(xr)
    fy = f(yr)
    fz = f(zr)

    l = max(0.0, 116.0 * fy - 16.0)
    a = 500.0 * (fx - fy)
    b = 200.0 * (fy - fz)

    return (l, a, b)


def rgb_to_lab(r: int, g: int, b: int) -> Tuple[float, float, float]:
    """Converts sRGB [0..255] directly to CIE L*a*b*."""
    x, y, z = rgb_to_xyz(r, g, b)
    return xyz_to_lab(x, y, z)


def hex_to_lab(hex_color: str) -> Tuple[float, float, float]:
    """Converts hex color string to CIE L*a*b*."""
    r, g, b = hex_to_rgb(hex_color)
    return rgb_to_lab(r, g, b)


def ciede2000(
    lab1: Tuple[float, float, float],
    lab2: Tuple[float, float, float],
    kL: float = 1.0,
    kC: float = 1.0,
    kH: float = 1.0,
) -> float:
    """
    Computes the CIEDE2000 color difference (Delta-E 2000) between two Lab colors.
    Accurately accounts for non-uniformities in chroma and hue angle.
    """
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2

    # 1. Calculate C_i and mean C
    C1 = math.sqrt(a1 * a1 + b1 * b1)
    C2 = math.sqrt(a2 * a2 + b2 * b2)
    C_bar = (C1 + C2) / 2.0

    # 2. Factor G
    C_bar7 = C_bar ** 7
    G = 0.5 * (1.0 - math.sqrt(C_bar7 / (C_bar7 + 25.0 ** 7)))

    # 3. Adjusted a' and C'
    a1_prime = (1.0 + G) * a1
    a2_prime = (1.0 + G) * a2
    C1_prime = math.sqrt(a1_prime * a1_prime + b1 * b1)
    C2_prime = math.sqrt(a2_prime * a2_prime + b2 * b2)

    # 4. Hue angles h' in degrees [0, 360)
    def compute_h(a_p: float, b_p: float) -> float:
        if a_p == 0 and b_p == 0:
            return 0.0
        deg = math.degrees(math.atan2(b_p, a_p))
        return deg + 360.0 if deg < 0 else deg

    h1_prime = compute_h(a1_prime, b1)
    h2_prime = compute_h(a2_prime, b2)

    # 5. Delta L', Delta C', Delta H'
    delta_L_prime = L2 - L1
    delta_C_prime = C2_prime - C1_prime

    if C1_prime * C2_prime == 0:
        delta_h_prime = 0.0
    elif abs(h2_prime - h1_prime) <= 180.0:
        delta_h_prime = h2_prime - h1_prime
    elif h2_prime - h1_prime > 180.0:
        delta_h_prime = (h2_prime - h1_prime) - 360.0
    else:
        delta_h_prime = (h2_prime - h1_prime) + 360.0

    delta_H_prime = 2.0 * math.sqrt(C1_prime * C2_prime) * math.sin(math.radians(delta_h_prime / 2.0))

    # 6. Mean values: L_bar', C_bar', h_bar'
    L_bar_prime = (L1 + L2) / 2.0
    C_bar_prime = (C1_prime + C2_prime) / 2.0

    if C1_prime * C2_prime == 0:
        h_bar_prime = h1_prime + h2_prime
    elif abs(h1_prime - h2_prime) <= 180.0:
        h_bar_prime = (h1_prime + h2_prime) / 2.0
    elif h1_prime + h2_prime < 360.0:
        h_bar_prime = (h1_prime + h2_prime + 360.0) / 2.0
    else:
        h_bar_prime = (h1_prime + h2_prime - 360.0) / 2.0

    # 7. Weighting functions: S_L, S_C, S_H
    T = (
        1.0
        - 0.17 * math.cos(math.radians(h_bar_prime - 30.0))
        + 0.24 * math.cos(math.radians(2.0 * h_bar_prime))
        + 0.32 * math.cos(math.radians(3.0 * h_bar_prime + 6.0))
        - 0.20 * math.cos(math.radians(4.0 * h_bar_prime - 63.0))
    )

    L_term = (L_bar_prime - 50.0) ** 2
    S_L = 1.0 + (0.015 * L_term) / math.sqrt(20.0 + L_term)
    S_C = 1.0 + 0.045 * C_bar_prime
    S_H = 1.0 + 0.015 * C_bar_prime * T

    # 8. Rotation term R_T
    delta_theta = 30.0 * math.exp(-(((h_bar_prime - 275.0) / 25.0) ** 2))
    C_bar_prime7 = C_bar_prime ** 7
    R_C = 2.0 * math.sqrt(C_bar_prime7 / (C_bar_prime7 + 25.0 ** 7))
    R_T = -math.sin(math.radians(2.0 * delta_theta)) * R_C

    # 9. Total CIEDE2000 color difference
    vL = delta_L_prime / (kL * S_L)
    vC = delta_C_prime / (kC * S_C)
    vH = delta_H_prime / (kH * S_H)

    de00_sq = vL * vL + vC * vC + vH * vH + R_T * vC * vH
    return math.sqrt(max(0.0, de00_sq))


def ciede2000_from_hex(hex1: str, hex2: str) -> float:
    """Computes CIEDE2000 directly between two hex color codes."""
    lab1 = hex_to_lab(hex1)
    lab2 = hex_to_lab(hex2)
    return ciede2000(lab1, lab2)


# Default Approved Brand Palette (Acme CloudSync)
DEFAULT_ACME_PALETTE = [
    {"name": "Deep Navy", "hex": "#0B1F3A", "usage": "Primary Background & Heavy Headers"},
    {"name": "Vibrant Teal", "hex": "#0FA3A3", "usage": "Primary Accent & CTAs"},
    {"name": "Warning Amber", "hex": "#E8962E", "usage": "Secondary Alert & Highlights"},
    {"name": "Creative Purple", "hex": "#6B5BD6", "usage": "Product Illustrations & Badges"},
    {"name": "Clean White", "hex": "#FFFFFF", "usage": "Backgrounds & Card Containers"},
]


def compare_against_brand_palette(
    extracted_hex: str,
    approved_palette: Any = None,
    tolerance: float = 5.0,
) -> dict:
    """
    Finds closest brand palette color and evaluates perceptual distance:
    - Delta-E < 2.0: Imperceptible (Exact match / Pass)
    - 2.0 <= Delta-E <= tolerance: Acceptable variance
    - Delta-E > tolerance: Off-brand violation (Fail)
    """
    if approved_palette is None:
        palette_list = DEFAULT_ACME_PALETTE
    else:
        palette_list = approved_palette

    # Normalize palette to list of (name, hex)
    normalized: List[Tuple[str, str]] = []
    for item in palette_list:
        if isinstance(item, dict):
            normalized.append((item.get("name", item.get("hex", "#0FA3A3")), item.get("hex", "#0FA3A3")))
        elif isinstance(item, str):
            normalized.append((item, item))

    if not normalized:
        normalized = [("Teal", "#0FA3A3")]

    extracted_lab = hex_to_lab(extracted_hex)
    best_name, best_hex = normalized[0]
    min_de = float("inf")

    for name, brand_hex in normalized:
        brand_lab = hex_to_lab(brand_hex)
        de = ciede2000(extracted_lab, brand_lab)
        if de < min_de:
            min_de = de
            best_name = name
            best_hex = brand_hex

    # Determine status
    if min_de < 2.0:
        status = "Pass"
        tolerance_label = "Pass"
        description = "Exact / Imperceptible color match to approved palette"
    elif min_de <= tolerance:
        status = "Acceptable"
        tolerance_label = "Acceptable"
        description = "Acceptable shade variation within brand tolerance"
    else:
        status = "Off-brand"
        tolerance_label = "Off-brand"
        description = f"Off-brand color (Delta-E {min_de:.1f} exceeds tolerance {tolerance:.1f})"

    return {
        "extracted_hex": extracted_hex.upper(),
        "closest_brand_hex": best_hex.upper(),
        "nearest_brand_color": best_hex.upper(),
        "nearest_brand_name": best_name,
        "delta_e": round(min_de, 2),
        "status": status,
        "tolerance": tolerance_label,
        "description": description,
    }

