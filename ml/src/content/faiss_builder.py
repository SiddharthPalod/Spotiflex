import os
import numpy as np
import faiss

# Define paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEATURE_STORE_DIR = os.path.join(BASE_DIR, 'feature_store')

def main():
    print("Loading track vectors...")
    vectors_path = os.path.join(FEATURE_STORE_DIR, 'track_vectors.npy')
    track_vectors = np.load(vectors_path)
    
    # Ensure float32
    if track_vectors.dtype != np.float32:
        track_vectors = track_vectors.astype(np.float32)
        
    num_tracks, d = track_vectors.shape
    print(f"Loaded {num_tracks} track vectors of dimension {d}")
    
    print("L2 Normalizing vectors for Inner Product search...")
    # In-place normalization
    faiss.normalize_L2(track_vectors)
    
    print("Building IndexHNSWFlat...")
    # Optimal parameters from tuning
    index = faiss.IndexHNSWFlat(d, 32, faiss.METRIC_INNER_PRODUCT)
    index.hnsw.efConstruction = 80
    
    print("Adding vectors to index...")
    index.add(track_vectors)
    
    print(f"Index built with {index.ntotal} vectors.")
    
    out_path = os.path.join(FEATURE_STORE_DIR, 'track_faiss.index')
    print(f"Saving index to {out_path} ...")
    faiss.write_index(index, out_path)
    
    print("Running sanity query...")
    k = 5
    D, I = index.search(track_vectors[:1], k)
    print(f"Top {k} distances: {D}")
    print(f"Top {k} indices: {I}")
    
    print("Phase 4 FAISS Builder completed successfully.")

if __name__ == "__main__":
    main()
