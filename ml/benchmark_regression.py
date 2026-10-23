import os
import sys
import json
import numpy as np

# Ensure root ML dir is on path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from src.serving.candidate_generator import CandidateGenerator
from src.serving.linucb import HybridLinUCB

FEATURE_STORE_DIR = os.path.join(BASE_DIR, 'feature_store')

def benchmark_baseline():
    print("Loading CandidateGenerator and LinUCB for baseline...")
    cg = CandidateGenerator()
    bandit = HybridLinUCB()

    user_profiles = np.load(os.path.join(FEATURE_STORE_DIR, 'user_profiles.npy'), mmap_mode='r')
    base_vectors = np.load(os.path.join(FEATURE_STORE_DIR, 'track_vectors.npy'), mmap_mode='r')
    base_count = len(base_vectors)

    delta_path = os.path.join(FEATURE_STORE_DIR, 'track_vectors_delta.npy')
    if os.path.exists(delta_path):
        delta_arr = np.load(delta_path)
        delta_list = [delta_arr[i] for i in range(len(delta_arr))]
    else:
        delta_list = []

    def get_vec(idx):
        if idx < base_count:
            return base_vectors[idx]
        return delta_list[idx - base_count]

    def get_vecs(indices):
        if not delta_list or all(i < base_count for i in indices):
            return base_vectors[indices].astype(np.float32)
        return np.array([get_vec(i) for i in indices], dtype=np.float32)

    track_index = cg.track_index
    track_id_to_idx = {tid: idx for idx, tid in enumerate(track_index)}

    test_users = cg.user_index[:5]
    results = {}

    for uid in test_users:
        u_idx = cg.user_id_to_idx[uid]
        u_t = user_profiles[u_idx]
        cands = cg.generate_candidates(uid, u_t, K=200)
        cand_indices = [track_id_to_idx[tid] for tid in cands]
        cands_x_a = get_vecs(cand_indices)
        scores = bandit.score_candidates(uid, u_t, cands_x_a)
        top_idx = np.argsort(scores)[::-1][:10]
        results[uid] = [cands[i] for i in top_idx]

    os.makedirs(os.path.join(BASE_DIR, 'fixtures'), exist_ok=True)
    baseline_file = os.path.join(BASE_DIR, 'fixtures', 'baseline_recs.json')
    with open(baseline_file, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"Baseline saved successfully to {baseline_file} for {len(test_users)} users.")

if __name__ == "__main__":
    benchmark_baseline()
