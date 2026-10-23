import os
import sys
import json
import numpy as np
import faiss
import implicit
import joblib
import scipy.sparse as sp

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEATURE_STORE_DIR = os.path.join(BASE_DIR, 'feature_store')

class CandidateGenerator:
    def __init__(self):
        print("Initializing Candidate Generator...", file=sys.stderr)
        
        # Load indices mapping
        self.track_index = joblib.load(os.path.join(FEATURE_STORE_DIR, 'track_index.pkl'))
        delta_txt_path = os.path.join(FEATURE_STORE_DIR, 'track_index_delta.log')
        if os.path.exists(delta_txt_path):
            with open(delta_txt_path, 'r', encoding='utf-8') as f:
                for line in f:
                    tid = line.strip()
                    if tid and tid not in self.track_index:
                        self.track_index.append(tid)

        self.user_index = joblib.load(os.path.join(FEATURE_STORE_DIR, 'user_index.pkl'))
        self.user_id_to_idx = {uid: idx for idx, uid in enumerate(self.user_index)}
        
        # Optional fallback: Load FAISS only if index file exists
        faiss_index_path = os.path.join(FEATURE_STORE_DIR, 'track_faiss.index')
        if os.path.exists(faiss_index_path):
            self.faiss_index = faiss.read_index(faiss_index_path)
            self.faiss_index.hnsw.efSearch = 200
        else:
            self.faiss_index = None

        # Optional fallback: Load ALS implicit model only if factor files exist
        als_user_path = os.path.join(FEATURE_STORE_DIR, 'als_user_factors.npy')
        als_track_path = os.path.join(FEATURE_STORE_DIR, 'als_track_factors.npy')
        if os.path.exists(als_user_path) and os.path.exists(als_track_path):
            als_user_factors = np.load(als_user_path)
            als_track_factors = np.load(als_track_path)
            self.als_model = implicit.als.AlternatingLeastSquares(factors=als_user_factors.shape[1])
            self.als_model.user_factors = als_user_factors
            self.als_model.item_factors = als_track_factors
            self.empty_user_items = sp.csr_matrix((len(self.user_index), len(self.track_index)))
        else:
            self.als_model = None
            self.empty_user_items = None
        
        # Initialize optional Qdrant Vector Store connection
        try:
            from src.content.qdrant_store import QdrantVectorStore
            self.qdrant = QdrantVectorStore()
        except Exception:
            self.qdrant = None

        print("Candidate Generator ready.", file=sys.stderr)

    def get_content_candidates(self, user_profile_vector, K=200):
        """Channel A: ANN Content Search (tries Qdrant first, falls back to FAISS)"""
        vector = user_profile_vector.reshape(1, -1).astype(np.float32)
        faiss.normalize_L2(vector)
        
        # Try Qdrant container first
        if self.qdrant and self.qdrant.client:
            q_candidates = self.qdrant.search_similar_vector(vector[0], limit=K)
            if q_candidates:
                return q_candidates

        # Fallback to in-process FAISS
        D, I = self.faiss_index.search(vector, K)
        candidates = [self.track_index[idx] for idx in I[0] if idx != -1 and idx < len(self.track_index)]
        return candidates

    def get_collab_candidates(self, user_id, K=200):
        """Channel B: ALS Collaborative Filtering (Direct Qdrant Dot Product Search)"""
        # 1. Primary: Query user factor directly from Qdrant and execute dot product search
        if self.qdrant and self.qdrant.client:
            _, user_factor = self.qdrant.get_user_data(user_id)
            if user_factor is not None:
                q_collab = self.qdrant.query_als_candidates(user_factor, limit=K)
                if q_collab:
                    return q_collab

        # 2. Fallback to in-memory ALS model if Qdrant user lookup missed
        if user_id in self.user_id_to_idx:
            u_idx = self.user_id_to_idx[user_id]
            if self.qdrant and self.qdrant.client:
                user_factor = self.als_model.user_factors[u_idx]
                q_collab = self.qdrant.query_als_candidates(user_factor, limit=K)
                if q_collab:
                    return q_collab

            ids, scores = self.als_model.recommend(u_idx, self.empty_user_items[u_idx], N=K, filter_already_liked_items=False)
            candidates = [self.track_index[idx] for idx in ids if idx < len(self.track_index)]
            return candidates

        return [] # Cold-start user

    def generate_candidates(self, user_id, user_profile_vector, K=200):
        """Union of both channels"""
        content_cands = self.get_content_candidates(user_profile_vector, K)
        collab_cands = self.get_collab_candidates(user_id, K)
        
        # Set union removes duplicates
        blended = list(set(content_cands).union(set(collab_cands)))
        return blended

if __name__ == "__main__":
    import time
    cg = CandidateGenerator()
    
    # Mock testing with an existing user
    test_user = cg.user_index[0]
    user_profiles = np.load(os.path.join(FEATURE_STORE_DIR, 'user_profiles.npy'))
    test_vector = user_profiles[0]
    
    print(f"\nBenchmarking candidate generation for user: {test_user}")
    
    # Warmup
    cg.generate_candidates(test_user, test_vector, K=200)
    
    # Benchmark
    t0 = time.time()
    cands = cg.generate_candidates(test_user, test_vector, K=200)
    t1 = time.time()
    
    print(f"Retrieved {len(cands)} unique blended candidates.")
    print(f"Inference Time: {(t1 - t0) * 1000:.2f} ms")
