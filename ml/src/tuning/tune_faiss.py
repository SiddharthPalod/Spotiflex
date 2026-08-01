import os
import time
import numpy as np
import faiss
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEATURE_STORE_DIR = os.path.join(BASE_DIR, 'feature_store')

def main():
    print("Loading vectors...")
    track_vectors = np.load(os.path.join(FEATURE_STORE_DIR, 'track_vectors.npy')).astype(np.float32)
    user_profiles = np.load(os.path.join(FEATURE_STORE_DIR, 'user_profiles.npy')).astype(np.float32)
    
    print("Normalizing vectors...")
    faiss.normalize_L2(track_vectors)
    faiss.normalize_L2(user_profiles)
    
    d = track_vectors.shape[1]
    
    # Take a sample of 1000 users for tuning to speed it up
    np.random.seed(42)
    sample_users = user_profiles[np.random.choice(user_profiles.shape[0], 1000, replace=False)]
    
    print("Building exact ground truth (IndexFlatIP)...")
    exact_index = faiss.IndexFlatIP(d)
    exact_index.add(track_vectors)
    
    k = 200
    print(f"Querying exact index for top {k}...")
    t0 = time.time()
    _, exact_I = exact_index.search(sample_users, k)
    exact_time = time.time() - t0
    print(f"Exact search took {exact_time:.3f}s")
    
    best_recall = 0
    best_params = {}
    
    M_values = [16, 32]
    ef_construction_values = [40, 80]
    ef_search_values = [64, 128, 200]
    
    print("\nTuning HNSW...")
    for M in M_values:
        for efC in ef_construction_values:
            print(f"Building HNSW (M={M}, efConstruction={efC})...")
            index = faiss.IndexHNSWFlat(d, M, faiss.METRIC_INNER_PRODUCT)
            index.hnsw.efConstruction = efC
            index.add(track_vectors)
            
            for efS in ef_search_values:
                index.hnsw.efSearch = efS
                
                t0 = time.time()
                _, approx_I = index.search(sample_users, k)
                approx_time = time.time() - t0
                
                # Compute average recall
                recalls = []
                for i in range(len(sample_users)):
                    intersection = len(set(exact_I[i]).intersection(set(approx_I[i])))
                    recalls.append(intersection / k)
                
                avg_recall = np.mean(recalls)
                print(f"  efSearch={efS:3d} | Recall@{k}: {avg_recall:.4f} | Time: {approx_time:.3f}s")
                
                if avg_recall > best_recall:
                    best_recall = avg_recall
                    best_params = {'M': M, 'efC': efC, 'efS': efS}
                    
    print("\nBest Parameters:")
    print(best_params)
    print(f"Best Recall@{k}: {best_recall:.4f}")
    
    print("\nRebuilding final FAISS index with best parameters...")
    final_index = faiss.IndexHNSWFlat(d, best_params['M'], faiss.METRIC_INNER_PRODUCT)
    final_index.hnsw.efConstruction = best_params['efC']
    final_index.add(track_vectors)
    
    out_path = os.path.join(FEATURE_STORE_DIR, 'track_faiss.index')
    faiss.write_index(final_index, out_path)
    print(f"Saved tuned index to {out_path}")
    
    # Save best efSearch so the API knows what to use later
    with open(os.path.join(FEATURE_STORE_DIR, 'faiss_params.json'), 'w') as f:
        json.dump(best_params, f)

if __name__ == "__main__":
    main()
