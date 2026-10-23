import os
import sys
import time
import numpy as np
import joblib
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, OptimizersConfigDiff

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEATURE_STORE_DIR = os.path.join(BASE_DIR, 'feature_store')

COLLECTION_NAME = "tracks"
VECTOR_DIM = 1404
BATCH_SIZE = 1000

def migrate():
    print(f"Connecting to Qdrant at http://localhost:6333...")
    client = QdrantClient(url="http://localhost:6333", timeout=60.0)

    # 1. Load baseline & delta track IDs
    print("Loading track index...")
    track_index_path = os.path.join(FEATURE_STORE_DIR, 'track_index.pkl')
    track_index = joblib.load(track_index_path)

    delta_txt_path = os.path.join(FEATURE_STORE_DIR, 'track_index_delta.log')
    if os.path.exists(delta_txt_path):
        with open(delta_txt_path, 'r', encoding='utf-8') as f:
            for line in f:
                tid = line.strip()
                if tid and tid not in track_index:
                    track_index.append(tid)

    total_tracks = len(track_index)
    print(f"Total track IDs to migrate: {total_tracks}")

    # 2. Load vectors (base mmap + delta)
    print("Loading track vectors...")
    base_vectors = np.load(os.path.join(FEATURE_STORE_DIR, 'track_vectors.npy'), mmap_mode='r')
    base_count = len(base_vectors)

    delta_bin_path = os.path.join(FEATURE_STORE_DIR, 'track_vectors_delta.bin')
    delta_npy_path = os.path.join(FEATURE_STORE_DIR, 'track_vectors_delta.npy')
    delta_list = []

    if os.path.exists(delta_bin_path) and os.path.getsize(delta_bin_path) > 0:
        num_vecs = os.path.getsize(delta_bin_path) // (VECTOR_DIM * 4)
        if num_vecs > 0:
            delta_arr = np.fromfile(delta_bin_path, dtype=np.float32).reshape(num_vecs, VECTOR_DIM)
            delta_list = [delta_arr[i] for i in range(len(delta_arr))]
    elif os.path.exists(delta_npy_path):
        delta_arr = np.load(delta_npy_path)
        delta_list = [delta_arr[i] for i in range(len(delta_arr))]

    def get_vec(idx):
        if idx < base_count:
            return base_vectors[idx]
        return delta_list[idx - base_count]

    # 3. Create or Recreate Collection in Qdrant with Cosine distance
    collections = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        print(f"Creating Qdrant collection '{COLLECTION_NAME}' (dim={VECTOR_DIM}, Cosine)...")
        # Disable indexing during heavy initial batch upload for maximum throughput
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
            optimizers_config=OptimizersConfigDiff(indexing_threshold=0)
        )
    else:
        info = client.get_collection(COLLECTION_NAME)
        print(f"Collection '{COLLECTION_NAME}' already exists with {info.points_count} points.")
        if info.points_count >= total_tracks:
            print("Migration already up to date. Exiting.")
            return

    # 4. Upload in Batches
    print("Starting batch vector ingestion into Qdrant...")
    start_time = time.time()
    
    for start_idx in range(0, total_tracks, BATCH_SIZE):
        end_idx = min(start_idx + BATCH_SIZE, total_tracks)
        points = []
        for idx in range(start_idx, end_idx):
            vec = get_vec(idx)
            # Normalize vector to ensure cosine equivalence
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            points.append(
                PointStruct(
                    id=idx,
                    vector=vec.tolist(),
                    payload={"track_id": track_index[idx]}
                )
            )

        client.upsert(
            collection_name=COLLECTION_NAME,
            points=points,
            wait=False
        )

        if (end_idx // BATCH_SIZE) % 10 == 0 or end_idx == total_tracks:
            elapsed = time.time() - start_time
            rate = end_idx / max(elapsed, 1.0)
            print(f"Uploaded {end_idx}/{total_tracks} points ({end_idx*100.0/total_tracks:.1f}%) - {rate:.0f} pts/sec")

    # 5. Re-enable Indexing optimizer so HNSW builds in the background
    print("Re-enabling Qdrant HNSW indexing optimizer...")
    client.update_collection(
        collection_name=COLLECTION_NAME,
        optimizers_config=OptimizersConfigDiff(indexing_threshold=20000)
    )

    total_time = time.time() - start_time
    print(f"Migration completed successfully in {total_time:.2f} seconds!")

if __name__ == "__main__":
    migrate()
