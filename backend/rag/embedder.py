"""
Gemini Embedding client supporting batch embedding, multi-key failover,
and deterministic fallback for offline tests.
"""

import hashlib
import logging
import math
from typing import List, Optional
import numpy as np

logger = logging.getLogger("brandguard.embedder")

EMBED_MODEL = "text-embedding-004"
VECTOR_DIMENSION = 768


def generate_deterministic_embedding(text: str, dim: int = VECTOR_DIMENSION) -> List[float]:
    """
    Generates a deterministic normalized pseudo-embedding based on text content.
    Used for offline testing, local dev fallbacks, and zero-token test environments.
    """
    # Hash tokens and accumulate across dimension buckets
    vec = np.zeros(dim, dtype=np.float32)
    words = text.lower().split()
    if not words:
        words = ["empty"]

    for i, word in enumerate(words):
        h = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        weight = 1.0 / (1.0 + math.log(i + 1))
        vec[idx] += float(weight)
        # Neighboring spread
        vec[(idx + 1) % dim] += float(weight * 0.5)
        vec[(idx - 1) % dim] += float(weight * 0.5)

    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()


class GeminiEmbedder:
    def __init__(self, key_agent=None, model: str = EMBED_MODEL):
        self.key_agent = key_agent
        self.model = model

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Embeds a list of texts using Gemini Embeddings API (batch processing).
        Falls back to key failover or deterministic local embeddings if unconfigured.
        """
        if not texts:
            return []

        if not self.key_agent or self.key_agent.key_count == 0:
            logger.info("No Gemini API keys configured. Using deterministic embedding provider.")
            return [generate_deterministic_embedding(t) for t in texts]

        results: List[List[float]] = []
        batch_size = 20

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]

            def call_embed(client):
                batch_embeddings = []
                for text_item in batch:
                    try:
                        # google-genai SDK embed_content
                        res = client.models.embed_content(
                            model=self.model,
                            contents=text_item[:4000],
                        )
                        if hasattr(res, "embedding") and hasattr(res.embedding, "values"):
                            batch_embeddings.append(res.embedding.values)
                        elif hasattr(res, "embeddings") and res.embeddings:
                            batch_embeddings.append(res.embeddings[0].values)
                        else:
                            batch_embeddings.append(generate_deterministic_embedding(text_item))
                    except Exception as err:
                        logger.warning(f"Error calling embed_content for item: {err}. Using fallback vector.")
                        batch_embeddings.append(generate_deterministic_embedding(text_item))
                return batch_embeddings

            try:
                embedded_batch = self.key_agent.execute_with_failover(call_embed)
                results.extend(embedded_batch)
            except Exception as e:
                logger.warning(f"Gemini embedding batch failed: {e}. Falling back to deterministic vectors.")
                for item in batch:
                    results.append(generate_deterministic_embedding(item))

        return results

    def embed_query(self, query: str) -> List[float]:
        """Embeds a single query string."""
        res = self.embed_texts([query])
        return res[0] if res else generate_deterministic_embedding(query)
