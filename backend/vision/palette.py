"""
Dominant Color Extraction & Brand Palette Clustering Engine.
Extracts dominant colors from uploaded visual assets using k-means clustering,
computes pixel representation percentages, and validates against approved brand color specs.
"""

import io
from typing import List, Dict, Any, Optional
import numpy as np
from PIL import Image

try:
    from sklearn.cluster import MiniBatchKMeans
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

from .delta_e import compare_against_brand_palette, DEFAULT_ACME_PALETTE


def rgb_to_hex(r: int, g: int, b: int) -> str:
    """Formats RGB integer tuple to #RRGGBB."""
    return f"#{int(round(r)):02X}{int(round(g)):02X}{int(round(b)):02X}"


def extract_dominant_colors(
    image_bytes: bytes,
    k: int = 5,
    sample_size: int = 150,
    approved_palette: Optional[List[Dict[str, Any]]] = None
) -> List[Dict[str, Any]]:
    """
    Extracts top k dominant colors from image bytes and evaluates each against
    the approved brand palette.
    """
    if approved_palette is None:
        approved_palette = DEFAULT_ACME_PALETTE

    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        return []

    # Handle transparent PNG/WEBP
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        # Extract pixels with non-zero alpha
        rgba_data = np.array(rgba)
        mask = rgba_data[:, :, 3] > 32  # ignore mostly transparent pixels
        rgb_pixels = rgba_data[:, :, :3][mask]
        if len(rgb_pixels) == 0:
            rgb_pixels = rgba_data[:, :, :3].reshape(-1, 3)
    else:
        rgb = img.convert("RGB")
        # Resize for speed
        rgb.thumbnail((sample_size, sample_size), Image.Resampling.LANCZOS)
        rgb_pixels = np.array(rgb).reshape(-1, 3)

    if len(rgb_pixels) < k:
        return []

    # Subsample if pixel array is large
    if len(rgb_pixels) > 10000:
        indices = np.random.choice(len(rgb_pixels), 10000, replace=False)
        rgb_pixels = rgb_pixels[indices]

    if HAS_SKLEARN:
        kmeans = MiniBatchKMeans(n_clusters=k, random_state=42, n_init=3, batch_size=256)
        kmeans.fit(rgb_pixels)
        centers = kmeans.cluster_centers_
        labels = kmeans.labels_
    else:
        # Fallback naive histogram binning
        from collections import Counter
        # Quantize to 32 steps per channel
        quantized = (rgb_pixels // 32) * 32 + 16
        tuples = [tuple(p) for p in quantized]
        counts = Counter(tuples).most_common(k)
        centers = [c[0] for c in counts]
        total_p = sum(c[1] for c in counts)
        results = []
        for color, count in counts:
            r, g, b = int(color[0]), int(color[1]), int(color[2])
            hex_code = rgb_to_hex(r, g, b)
            brand_eval = compare_against_brand_palette(hex_code, approved_palette)
            results.append({
                "hex": hex_code,
                "rgb": [r, g, b],
                "percentage": round((count / total_p) * 100, 1),
                **brand_eval
            })
        return results

    # Count clusters for percentage presence
    counts = np.bincount(labels, minlength=k)
    total_samples = len(labels)

    # Sort dominant colors descending by frequency
    sorted_indices = np.argsort(-counts)

    dominant_colors = []
    for idx in sorted_indices:
        count = counts[idx]
        if count == 0:
            continue
        center = centers[idx]
        r = int(np.clip(round(center[0]), 0, 255))
        g = int(np.clip(round(center[1]), 0, 255))
        b = int(np.clip(round(center[2]), 0, 255))
        hex_code = rgb_to_hex(r, g, b)
        pct = round((count / total_samples) * 100, 1)

        # Compare against brand palette
        brand_match = compare_against_brand_palette(hex_code, approved_palette)

        dominant_colors.append({
            "hex": hex_code,
            "rgb": [r, g, b],
            "percentage": pct,
            **brand_match
        })

    return dominant_colors
