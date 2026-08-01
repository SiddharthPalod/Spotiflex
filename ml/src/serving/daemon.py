import sys
import json
import os
import traceback
import numpy as np
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(BASE_DIR)

from src.serving.candidate_generator import CandidateGenerator
from src.serving.linucb import HybridLinUCB

FEATURE_STORE_DIR = os.path.join(BASE_DIR, 'feature_store')

def main():
    try:
        # Load heavy resources exactly once at boot
        cg = CandidateGenerator()
        bandit = HybridLinUCB()
        
        user_profiles = np.load(os.path.join(FEATURE_STORE_DIR, 'user_profiles.npy'))
        track_vectors = np.load(os.path.join(FEATURE_STORE_DIR, 'track_vectors.npy'))
        track_index = joblib.load(os.path.join(FEATURE_STORE_DIR, 'track_index.pkl'))
        track_id_to_idx = {tid: idx for idx, tid in enumerate(track_index)}
        
        # Send ready signal to Node.js so it knows the models are loaded in RAM
        print(json.dumps({"status": "ready"}), flush=True)
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}), flush=True)
        sys.exit(1)

    # Listen forever on stdin for incoming requests from Node.js
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
            
        try:
            req = json.loads(line)
            req_id = req.get("reqId")
            action = req.get("action")
            
            if action == "recommend":
                user_id = req.get("userId")
                history_track_ids = req.get("historyTrackIds", [])
                u_idx = cg.user_id_to_idx.get(user_id)
                
                if u_idx is None:
                    # Synthesize cold-start user profile dynamically from their recent watch history
                    valid_indices = [track_id_to_idx[tid] for tid in history_track_ids if tid in track_id_to_idx]
                    
                    if not valid_indices:
                        # Absolute cold start with no known history at all
                        print(json.dumps({"reqId": req_id, "tracks": []}), flush=True)
                        continue
                        
                    # Mean pooling of watched tracks to create dynamic profile
                    u_t = np.mean(track_vectors[valid_indices], axis=0).astype(np.float32)
                else:
                    u_t = user_profiles[u_idx]
                
                # 1. Candidate Blending (Fast FAISS + ALS Retrieval)
                candidates = cg.generate_candidates(user_id, u_t, K=200)
                if not candidates:
                    print(json.dumps({"reqId": req_id, "tracks": []}), flush=True)
                    continue
                    
                # 2. Extract 1404-dimensional vectors for the retrieved candidates
                cand_indices = [track_id_to_idx[tid] for tid in candidates]
                candidates_x_a = track_vectors[cand_indices]
                
                # 3. Contextual Bandit Ranking (Hybrid LinUCB)
                scores = bandit.score_candidates(user_id, u_t, candidates_x_a)
                
                # 4. Sort and return Top 200 Recommendations (Node will filter unresolvable IDs)
                top_200_idx = np.argsort(scores)[::-1][:200]
                top_200_tracks = [candidates[i] for i in top_200_idx]
                
                print(json.dumps({"reqId": req_id, "tracks": top_200_tracks}), flush=True)
                
            elif action == "similar":
                user_id = req.get("userId")
                track_id = req.get("trackId")
                
                u_idx = cg.user_id_to_idx.get(user_id)
                t_idx = track_id_to_idx.get(track_id)
                
                # If track is entirely unknown to ML Engine, return empty
                if t_idx is None:
                    print(json.dumps({"reqId": req_id, "tracks": []}), flush=True)
                    continue
                    
                import faiss
                # 1. FAISS Nearest Neighbors for the Track
                vector = track_vectors[t_idx].reshape(1, -1).astype(np.float32)
                faiss.normalize_L2(vector)
                
                # Retrieve top 200 contextually similar tracks
                D, I = cg.faiss_index.search(vector, 200)
                candidates = [track_index[idx] for idx in I[0] if idx != -1]
                
                if not candidates:
                    print(json.dumps({"reqId": req_id, "tracks": []}), flush=True)
                    continue
                
                if u_idx is not None:
                    # Known user: Rank with Contextual Bandit
                    u_t = user_profiles[u_idx]
                    cand_indices = [track_id_to_idx[tid] for tid in candidates]
                    candidates_x_a = track_vectors[cand_indices]
                    scores = bandit.score_candidates(user_id, u_t, candidates_x_a)
                    top_200_idx = np.argsort(scores)[::-1][:200]
                    top_200_tracks = [candidates[i] for i in top_200_idx]
                    print(json.dumps({"reqId": req_id, "tracks": top_200_tracks}), flush=True)
                else:
                    # Cold start user: Just return the purest FAISS nearest neighbors!
                    print(json.dumps({"reqId": req_id, "tracks": candidates}), flush=True)
                
            elif action == "feedback":
                # Streaming reward feedback to dynamically shift bandit bounds
                user_id = req.get("userId")
                track_id = req.get("trackId")
                reward = req.get("reward", 0.0)
                
                u_idx = cg.user_id_to_idx.get(user_id)
                t_idx = track_id_to_idx.get(track_id)
                
                if u_idx is not None and t_idx is not None:
                    u_t = user_profiles[u_idx]
                    x_a = track_vectors[t_idx]
                    bandit.update(user_id, u_t, x_a, reward)
                    
                print(json.dumps({"reqId": req_id, "status": "ok"}), flush=True)

            elif action == "add_track":
                # Dynamically expand the ML Feature Store with a synthesized vector
                track_id = req.get("trackId")
                similar_track_ids = req.get("similarTrackIds", [])
                
                if track_id in track_id_to_idx:
                    print(json.dumps({"reqId": req_id, "status": "already_exists"}), flush=True)
                    continue
                    
                # Extract vectors of known neighbors
                neighbor_indices = [track_id_to_idx[tid] for tid in similar_track_ids if tid in track_id_to_idx]
                
                if not neighbor_indices:
                    # If we don't know ANY of the Last.fm neighbors, fall back to the global centroid!
                    global_centroid_path = os.path.join(FEATURE_STORE_DIR, 'global_centroid.npy')
                    if os.path.exists(global_centroid_path):
                        synthetic_vector = np.load(global_centroid_path).astype(np.float32)
                    else:
                        print(json.dumps({"reqId": req_id, "status": "skipped", "reason": "no known neighbors and no global centroid"}), flush=True)
                        continue
                else:
                    # Compute mathematical centroid of known neighbors
                    neighbor_vectors = track_vectors[neighbor_indices]
                    synthetic_vector = np.mean(neighbor_vectors, axis=0).astype(np.float32)
                
                # Normalize L2
                synthetic_vector /= np.linalg.norm(synthetic_vector)
                synthetic_vector = synthetic_vector.reshape(1, -1)
                
                # Append to Python data structures
                new_idx = len(track_index)
                track_index.append(track_id)
                track_id_to_idx[track_id] = new_idx
                cg.track_index.append(track_id)  # MUST keep CandidateGenerator in sync to prevent IndexError
                
                # Append to numpy array
                track_vectors = np.vstack([track_vectors, synthetic_vector])
                
                # Dynamically append to FAISS
                import faiss
                cg.faiss_index.add(synthetic_vector)
                
                # Persist mathematically synthesized dataset to disk
                np.save(os.path.join(FEATURE_STORE_DIR, 'track_vectors.npy'), track_vectors)
                joblib.dump(track_index, os.path.join(FEATURE_STORE_DIR, 'track_index.pkl'))
                faiss.write_index(cg.faiss_index, os.path.join(FEATURE_STORE_DIR, 'track_faiss.index'))
                
                print(json.dumps({"reqId": req_id, "status": "added", "neighbors_used": len(neighbor_indices)}), flush=True)
                
            else:
                print(json.dumps({"reqId": req_id, "error": "Unknown action"}), flush=True)
                
        except Exception as e:
            # In case of bad input, don't crash the persistent daemon
            print(json.dumps({"error": str(e), "trace": traceback.format_exc()}), flush=True)

if __name__ == "__main__":
    main()
