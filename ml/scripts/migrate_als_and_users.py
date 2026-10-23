import os
import sys
import time
import numpy as np
import joblib
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, OptimizersConfigDiff

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEATURE_STORE_DIR = os.path.join(BASE_DIR, 'feature_store')

ALS_COLLECTION = "als_tracks"
USER_COLLECTION = "user_profiles"
BATCH_SIZE = 2000

def migrate_als_and_users():
    print(f"Connecting to Qdrant at http://localhost:6333...")
    client = QdrantClient(url="http://localhost:6333", timeout=60.0)

    # ── 1. Migrate als_tracks (Collaborative Filtering Track Latent Factors) ─
    als_track_factors = np.load(os.path.join(FEATURE_STORE_DIR, 'als_track_factors.npy'), mmap_mode='r')
    track_index = joblib.load(os.path.join(FEATURE_STORE_DIR, 'track_index.pkl'))
    num_als_tracks, als_dim = als_track_factors.shape
    print(f"Loaded ALS track factors: count={num_als_tracks}, dim={als_dim}")

    collections = [c.name for c in client.get_collections().collections]
    if ALS_COLLECTION not in collections:
        print(f"Creating collection '{ALS_COLLECTION}' (dim={als_dim}, Dot distance for MIPS)...")
        client.create_collection(
            collection_name=ALS_COLLECTION,
            vectors_config=VectorParams(size=als_dim, distance=Distance.DOT),
            optimizers_config=OptimizersConfigDiff(indexing_threshold=0)
        )
    
    info_als = client.get_collection(ALS_COLLECTION)
    if info_als.points_count < num_als_tracks:
        print(f"Ingesting {num_als_tracks} ALS track factors into '{ALS_COLLECTION}'...")
        start_time = time.time()
        for start_idx in range(0, num_als_tracks, BATCH_SIZE):
            end_idx = min(start_idx + BATCH_SIZE, num_als_tracks)
            points = []
            for idx in range(start_idx, end_idx):
                points.append(
                    PointStruct(
                        id=idx,
                        vector=als_track_factors[idx].tolist(),
                        payload={"track_id": track_index[idx]}
                    )
                )
            client.upsert(collection_name=ALS_COLLECTION, points=points, wait=False)
            if (end_idx // BATCH_SIZE) % 10 == 0 or end_idx == num_als_tracks:
                print(f"ALS tracks uploaded: {end_idx}/{num_als_tracks} ({end_idx*100.0/num_als_tracks:.1f}%)")

        print("Re-enabling HNSW optimizer on 'als_tracks'...")
        client.update_collection(
            collection_name=ALS_COLLECTION,
            optimizers_config=OptimizersConfigDiff(indexing_threshold=20000)
        )
        print(f"ALS tracks migration done in {time.time() - start_time:.2f}s")
    else:
        print(f"'{ALS_COLLECTION}' already up to date with {info_als.points_count} points.")

    # ── 2. Migrate user_profiles & als_user_factors ─────────────────────────
    user_profiles = np.load(os.path.join(FEATURE_STORE_DIR, 'user_profiles.npy'), mmap_mode='r')
    user_index = joblib.load(os.path.join(FEATURE_STORE_DIR, 'user_index.pkl'))
    als_user_factors = np.load(os.path.join(FEATURE_STORE_DIR, 'als_user_factors.npy'), mmap_mode='r')
    num_users, profile_dim = user_profiles.shape
    print(f"Loaded User profiles: count={num_users}, dim={profile_dim}")

    if USER_COLLECTION not in collections:
        print(f"Creating collection '{USER_COLLECTION}' (dim={profile_dim}, Cosine distance)...")
        client.create_collection(
            collection_name=USER_COLLECTION,
            vectors_config=VectorParams(size=profile_dim, distance=Distance.COSINE)
        )

    info_users = client.get_collection(USER_COLLECTION)
    if info_users.points_count < num_users:
        print(f"Ingesting {num_users} User profiles into '{USER_COLLECTION}'...")
        start_time = time.time()
        for start_idx in range(0, num_users, BATCH_SIZE):
            end_idx = min(start_idx + BATCH_SIZE, num_users)
            points = []
            for idx in range(start_idx, end_idx):
                points.append(
                    PointStruct(
                        id=idx,
                        vector=user_profiles[idx].tolist(),
                        payload={
                            "user_id": user_index[idx],
                            "als_factor": als_user_factors[idx].tolist()
                        }
                    )
                )
            client.upsert(collection_name=USER_COLLECTION, points=points, wait=True)
            print(f"User profiles uploaded: {end_idx}/{num_users} ({end_idx*100.0/num_users:.1f}%)")

        print(f"User profiles migration done in {time.time() - start_time:.2f}s")
    else:
        print(f"'{USER_COLLECTION}' already up to date with {info_users.points_count} points.")

    # Verify collections
    for col_name in [ALS_COLLECTION, USER_COLLECTION]:
        c = client.get_collection(col_name)
        print(f"Verified collection '{col_name}': points_count={c.points_count}, status={c.status}")

if __name__ == "__main__":
    migrate_als_and_users()
