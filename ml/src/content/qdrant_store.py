import os
import sys
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

TRACKS_COLLECTION = "tracks"
ALS_COLLECTION = "als_tracks"
USER_COLLECTION = "user_profiles"

class QdrantVectorStore:
    def __init__(self, host=None, port=6333):
        if host is None:
            # Check QDRANT_URL, QDRANT_HOST, or check if running inside docker / localhost
            env_url = os.environ.get("QDRANT_URL") or os.environ.get("QDRANT_HOST")
            if env_url:
                host = env_url
            elif os.path.exists('/.dockerenv') or os.environ.get("IN_DOCKER"):
                host = "http://qdrant:6333"
            else:
                host = "http://localhost:6333"

            if not host.startswith("http"):
                host = f"http://{host}:{port}"
        
        self.host = host
        try:
            self.client = QdrantClient(url=self.host, timeout=5.0)
            print(f"[QdrantVectorStore] Connected to {self.host}", file=sys.stderr)
        except Exception as e:
            print(f"[QdrantVectorStore] Connection warning: {e}", file=sys.stderr)
            self.client = None

    # ── Tracks (Content-based 1404-dim) ──────────────────────────────────────
    def search_similar_vector(self, query_vector, limit=50):
        """Pure ANN vector similarity query across all points in tracks collection."""
        if not self.client:
            return []
        try:
            vec = query_vector.tolist() if hasattr(query_vector, "tolist") else list(query_vector)
            res = self.client.query_points(
                collection_name=TRACKS_COLLECTION,
                query=vec,
                limit=limit,
                with_payload=True
            )
            return [p.payload.get("track_id") for p in res.points if p.payload and "track_id" in p.payload]
        except Exception as e:
            print(f"[QdrantVectorStore] search_similar_vector error: {e}", file=sys.stderr)
            return []

    def get_track_vector(self, point_id):
        """Fetch stored vector by integer point_id."""
        if not self.client:
            return None
        try:
            res = self.client.retrieve(
                collection_name=TRACKS_COLLECTION,
                ids=[int(point_id)],
                with_vectors=True
            )
            if res and res[0].vector:
                return np.array(res[0].vector, dtype=np.float32)
            return None
        except Exception as e:
            print(f"[QdrantVectorStore] get_track_vector error: {e}", file=sys.stderr)
            return None

    def get_vectors_batch(self, point_ids):
        """Batch fetch stored vectors directly from Qdrant."""
        if not self.client or not point_ids:
            return None
        try:
            clean_ids = [int(pid) for pid in point_ids]
            res = self.client.retrieve(
                collection_name=TRACKS_COLLECTION,
                ids=clean_ids,
                with_vectors=True
            )
            vec_map = {p.id: np.array(p.vector, dtype=np.float32) for p in res if p.vector}
            return np.array([vec_map[pid] for pid in clean_ids if pid in vec_map], dtype=np.float32)
        except Exception as e:
            print(f"[QdrantVectorStore] get_vectors_batch error: {e}", file=sys.stderr)
            return None

    def upsert_track(self, point_id, track_id, vector):
        """Atomic upsert of new track point into Qdrant."""
        if not self.client:
            return False
        try:
            vec = vector.tolist() if hasattr(vector, "tolist") else list(vector)
            self.client.upsert(
                collection_name=TRACKS_COLLECTION,
                points=[
                    PointStruct(
                        id=int(point_id),
                        vector=vec,
                        payload={"track_id": track_id}
                    )
                ]
            )
            return True
        except Exception as e:
            print(f"[QdrantVectorStore] upsert_track error: {e}", file=sys.stderr)
            return False

    # ── ALS Collaborative Filtering (64/128-dim Dot Product) ──────────────────
    def query_als_candidates(self, user_factor, limit=50):
        """Execute dot product MIPS to get top collaborative tracks for user factor."""
        if not self.client:
            return []
        try:
            vec = user_factor.tolist() if hasattr(user_factor, "tolist") else list(user_factor)
            res = self.client.query_points(
                collection_name=ALS_COLLECTION,
                query=vec,
                limit=limit,
                with_payload=True
            )
            return [p.payload.get("track_id") for p in res.points if p.payload and "track_id" in p.payload]
        except Exception as e:
            print(f"[QdrantVectorStore] query_als_candidates error: {e}", file=sys.stderr)
            return []

    # ── User Profiles (1404-dim LinUCB Context + ALS Latent Factor Payload) ──
    def get_user_data(self, user_id):
        """Fetch user profile vector and ALS factor from user_profiles collection."""
        if not self.client:
            return None, None
        try:
            res = self.client.scroll(
                collection_name=USER_COLLECTION,
                scroll_filter={"must": [{"key": "user_id", "match": {"value": user_id}}]},
                limit=1,
                with_vectors=True,
                with_payload=True
            )
            points, _ = res
            if points:
                p = points[0]
                u_profile = np.array(p.vector, dtype=np.float32) if p.vector else None
                als_factor = np.array(p.payload.get("als_factor"), dtype=np.float32) if p.payload and "als_factor" in p.payload else None
                return u_profile, als_factor
            return None, None
        except Exception as e:
            print(f"[QdrantVectorStore] get_user_data error: {e}", file=sys.stderr)
            return None, None

    def upsert_user_data(self, user_id, profile_vector, als_factor=None):
        """Write/update user context vector into Qdrant user_profiles collection."""
        if not self.client:
            return False
        try:
            vec = profile_vector.tolist() if hasattr(profile_vector, "tolist") else list(profile_vector)
            payload = {"user_id": user_id}
            if als_factor is not None:
                payload["als_factor"] = als_factor.tolist() if hasattr(als_factor, "tolist") else list(als_factor)

            # Use deterministic integer hash from user_id as point ID
            point_id = abs(hash(user_id)) % (2**63 - 1)
            self.client.upsert(
                collection_name=USER_COLLECTION,
                points=[
                    PointStruct(
                        id=point_id,
                        vector=vec,
                        payload=payload
                    )
                ]
            )
            return True
        except Exception as e:
            print(f"[QdrantVectorStore] upsert_user_data error: {e}", file=sys.stderr)
            return False
