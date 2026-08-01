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
        self.user_index = joblib.load(os.path.join(FEATURE_STORE_DIR, 'user_index.pkl'))
        self.user_id_to_idx = {uid: idx for idx, uid in enumerate(self.user_index)}
        
        # Load FAISS
        self.faiss_index = faiss.read_index(os.path.join(FEATURE_STORE_DIR, 'track_faiss.index'))
        faiss_params_path = os.path.join(FEATURE_STORE_DIR, 'faiss_params.json')
        if os.path.exists(faiss_params_path):
            with open(faiss_params_path, 'r') as f:
                faiss_params = json.load(f)
                self.faiss_index.hnsw.efSearch = faiss_params.get('efS', 200)
        else:
            self.faiss_index.hnsw.efSearch = 200
            
        # Load ALS
        als_user_factors = np.load(os.path.join(FEATURE_STORE_DIR, 'als_user_factors.npy'))
        als_track_factors = np.load(os.path.join(FEATURE_STORE_DIR, 'als_track_factors.npy'))
        
        # Instantiate implicit model dynamically from saved offline factors
        self.als_model = implicit.als.AlternatingLeastSquares(factors=als_user_factors.shape[1])
        self.als_model.user_factors = als_user_factors
        self.als_model.item_factors = als_track_factors
        
        # implicit's recommend() requires a user_items matrix. 
        # We pass an empty sparse matrix to skip filtering out historical listens for raw candidate generation.
        self.empty_user_items = sp.csr_matrix((len(self.user_index), len(self.track_index)))
        
        print("Candidate Generator ready.", file=sys.stderr)

    def get_content_candidates(self, user_profile_vector, K=200):
        """Channel A: ANN Content Search"""
        # Ensure vector is (1, d) float32 and L2 normalized for Inner Product = Cosine Sim
        vector = user_profile_vector.reshape(1, -1).astype(np.float32)
        faiss.normalize_L2(vector)
        
        D, I = self.faiss_index.search(vector, K)
        
        # Map internal indices back to actual string track IDs
        candidates = [self.track_index[idx] for idx in I[0] if idx != -1]
        return candidates

    def get_collab_candidates(self, user_id, K=200):
        """Channel B: ALS Collaborative Filtering"""
        if user_id not in self.user_id_to_idx:
            return [] # Cold-start user
            
        u_idx = self.user_id_to_idx[user_id]
        
        # filter_already_liked_items=False ensures we just get top N nearest vectors in the latent space
        ids, scores = self.als_model.recommend(u_idx, self.empty_user_items[u_idx], N=K, filter_already_liked_items=False)
        
        candidates = [self.track_index[idx] for idx in ids]
        return candidates

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
