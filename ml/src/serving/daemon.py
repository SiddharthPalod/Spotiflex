import sys
import json
import os
import signal
import traceback
import queue
import threading
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

        # ── Vector Store ─────────────────────────────────────────────────────
        # User profiles: loaded dynamically from Qdrant; fallback to local mmap if file exists
        user_profiles_path = os.path.join(FEATURE_STORE_DIR, 'user_profiles.npy')
        if os.path.exists(user_profiles_path):
            user_profiles = np.load(user_profiles_path, mmap_mode='r')
        else:
            user_profiles = None

        # Track vectors: loaded dynamically from Qdrant; fallback to local mmap if file exists
        track_vectors_path = os.path.join(FEATURE_STORE_DIR, 'track_vectors.npy')
        if os.path.exists(track_vectors_path):
            base_vectors = np.load(track_vectors_path, mmap_mode='r')
            base_count = len(base_vectors)
        else:
            base_vectors = None
            base_count = 0

        # ── Fix 3: Append-Only Delta Log with Dual Fallback ────────────────────
        delta_bin_path = os.path.join(FEATURE_STORE_DIR, 'track_vectors_delta.bin')
        delta_txt_path = os.path.join(FEATURE_STORE_DIR, 'track_index_delta.log')
        delta_npy_path = os.path.join(FEATURE_STORE_DIR, 'track_vectors_delta.npy')
        track_index_path = os.path.join(FEATURE_STORE_DIR, 'track_index.pkl')

        track_index = joblib.load(track_index_path)

        delta_list = []

        # If append-only binary delta log exists, load from it
        if os.path.exists(delta_bin_path) and os.path.getsize(delta_bin_path) > 0:
            num_vecs = os.path.getsize(delta_bin_path) // (1404 * 4)
            if num_vecs > 0:
                delta_arr = np.fromfile(delta_bin_path, dtype=np.float32).reshape(num_vecs, 1404)
                delta_list = [delta_arr[i] for i in range(len(delta_arr))]
            # Also load any delta track IDs from delta log if present
            if os.path.exists(delta_txt_path):
                with open(delta_txt_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        tid = line.strip()
                        if tid and tid not in track_index:
                            track_index.append(tid)
        elif os.path.exists(delta_npy_path):
            # Seed the binary log from existing npy file if present
            delta_arr = np.load(delta_npy_path)
            delta_list = [delta_arr[i] for i in range(len(delta_arr))]
            if len(delta_list) > 0:
                with open(delta_bin_path, 'wb') as fb:
                    fb.write(delta_arr.astype(np.float32).tobytes())

        track_id_to_idx = {tid: idx for idx, tid in enumerate(track_index)}

        # Synchronization lock for modifying shared track indices and FAISS
        data_lock = threading.Lock()

        # ── Vector Access Helpers (Primary: Qdrant, Fallback: Local Base) ─────

        def get_vec(idx):
            """Single-row vector lookup — queries Qdrant first, falls back to local tier."""
            if cg.qdrant and cg.qdrant.client:
                qv = cg.qdrant.get_track_vector(idx)
                if qv is not None:
                    return qv
            if idx < base_count:
                return base_vectors[idx]
            return delta_list[idx - base_count]

        def get_vecs(indices):
            """
            Batch vector lookup — queries Qdrant first, falls back to local tier.
            """
            if cg.qdrant and cg.qdrant.client:
                q_batch = cg.qdrant.get_vectors_batch(indices)
                if q_batch is not None and len(q_batch) == len(indices):
                    return q_batch

            if not delta_list or all(i < base_count for i in indices):
                return base_vectors[indices].astype(np.float32)
            return np.array([get_vec(i) for i in indices], dtype=np.float32)

        # ── Fix 3: Constant-Time Append Persistence ───────────────────────────

        def append_delta_to_disk(track_id, synthetic_vec):
            """
            Append one vector to binary log and one ID to text log in O(1) time.
            Zero rewriting of previous items.
            """
            with open(delta_bin_path, 'ab') as fb:
                fb.write(synthetic_vec.astype(np.float32).tobytes())
            with open(delta_txt_path, 'a', encoding='utf-8') as ft:
                ft.write(f"{track_id}\n")

        # ── Fix 2: Background Thread Queue for add_track ──────────────────────
        write_queue = queue.Queue()

        def background_worker():
            """
            Pulls add_track tasks from queue and executes vector centroid synthesis,
            FAISS addition, and append-only persistence without blocking stdin reads.
            """
            while True:
                item = write_queue.get()
                if item is None:
                    break
                try:
                    action, payload = item
                    if action == "add_track":
                        track_id = payload.get("trackId")
                        similar_track_ids = payload.get("similarTrackIds", [])

                        with data_lock:
                            if track_id in track_id_to_idx:
                                write_queue.task_done()
                                continue

                            neighbor_indices = [track_id_to_idx[tid] for tid in similar_track_ids if tid in track_id_to_idx]

                            if not neighbor_indices:
                                global_centroid_path = os.path.join(FEATURE_STORE_DIR, 'global_centroid.npy')
                                if os.path.exists(global_centroid_path):
                                    synthetic_vector = np.load(global_centroid_path).astype(np.float32)
                                else:
                                    write_queue.task_done()
                                    continue
                            else:
                                neighbor_vectors = get_vecs(neighbor_indices)
                                synthetic_vector = np.mean(neighbor_vectors, axis=0).astype(np.float32)

                            # Normalize L2
                            norm = np.linalg.norm(synthetic_vector)
                            if norm > 0:
                                synthetic_vector /= norm
                            synthetic_vector_2d = synthetic_vector.reshape(1, -1)

                            new_idx = len(track_index)
                            track_index.append(track_id)
                            track_id_to_idx[track_id] = new_idx
                            cg.track_index.append(track_id)
                            delta_list.append(synthetic_vector.copy())

                            # Dynamically append to FAISS if FAISS index is loaded
                            if cg.faiss_index is not None:
                                import faiss
                                cg.faiss_index.add(synthetic_vector_2d)

                            # O(1) append to disk
                            append_delta_to_disk(track_id, synthetic_vector)

                            # Synchronize to Qdrant vector database container if reachable
                            if cg.qdrant and cg.qdrant.client:
                                cg.qdrant.upsert_track(new_idx, track_id, synthetic_vector)

                except Exception as worker_err:
                    print(json.dumps({"worker_error": str(worker_err), "trace": traceback.format_exc()}), flush=True)
                finally:
                    write_queue.task_done()

        worker_thread = threading.Thread(target=background_worker, daemon=True)
        worker_thread.start()

        # ── Graceful Shutdown ─────────────────────────────────────────────────

        def _shutdown(signum, frame):
            print(json.dumps({"status": "shutdown", "message": "draining queue and snapshotting"}), flush=True)
            write_queue.put(None)
            worker_thread.join(timeout=3.0)
            with data_lock:
                # Also write full track_index snapshot periodically on clean shutdown
                joblib.dump(track_index, track_index_path)
            sys.exit(0)

        signal.signal(signal.SIGTERM, _shutdown)
        signal.signal(signal.SIGINT,  _shutdown)

        # Send ready signal to Node.js
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
            req    = json.loads(line)
            req_id = req.get("reqId")
            action = req.get("action")

            if action == "recommend":
                user_id           = req.get("userId")
                history_track_ids = req.get("historyTrackIds", [])
                # Fix 1: Read-scoped limit (default 25 to give headroom for Node DB filtering)
                limit             = int(req.get("limit", 25))

                # Resolve User profile vector u_t (Vector DB primary, local fallback)
                u_t = None
                if cg.qdrant and cg.qdrant.client:
                    q_prof, _ = cg.qdrant.get_user_data(user_id)
                    if q_prof is not None:
                        u_t = q_prof

                with data_lock:
                    if u_t is None:
                        u_idx = cg.user_id_to_idx.get(user_id)
                        if u_idx is not None:
                            u_t = user_profiles[u_idx]
                        else:
                            # Synthesize cold-start user profile dynamically from their recent watch history
                            valid_indices = [track_id_to_idx[tid] for tid in history_track_ids if tid in track_id_to_idx]

                            if not valid_indices:
                                # Absolute cold start with no known history at all
                                print(json.dumps({"reqId": req_id, "tracks": []}), flush=True)
                                continue

                            u_t = np.mean(get_vecs(valid_indices), axis=0).astype(np.float32)
                            # Persist dynamically synthesized profile to Qdrant user_profiles collection
                            if cg.qdrant and cg.qdrant.client:
                                cg.qdrant.upsert_user_data(user_id, u_t)

                    # 1. Candidate Blending with request-scoped candidate retrieval
                    candidates = cg.generate_candidates(user_id, u_t, K=max(limit, 50))
                    if not candidates:
                        print(json.dumps({"reqId": req_id, "tracks": []}), flush=True)
                        continue

                    # 2. Extract vectors for candidates (capped to limit * 2 to minimize matrix multiply)
                    scored_candidates = candidates[:max(limit * 2, 50)]
                    cand_indices      = [track_id_to_idx[tid] for tid in scored_candidates if tid in track_id_to_idx]
                    candidates_x_a    = get_vecs(cand_indices)

                # 3. Contextual Bandit Ranking (Hybrid LinUCB)
                scores = bandit.score_candidates(user_id, u_t, candidates_x_a)

                # 4. Sort and return Top N recommendations requested by caller
                top_idx    = np.argsort(scores)[::-1][:limit]
                top_tracks = [scored_candidates[i] for i in top_idx]

                print(json.dumps({"reqId": req_id, "tracks": top_tracks}), flush=True)

            elif action == "similar":
                user_id  = req.get("userId")
                track_id = req.get("trackId")
                limit    = int(req.get("limit", 25))

                u_idx = cg.user_id_to_idx.get(user_id)

                with data_lock:
                    t_idx = track_id_to_idx.get(track_id)
                    if t_idx is None:
                        print(json.dumps({"reqId": req_id, "tracks": []}), flush=True)
                        continue

                    # 1. Nearest Neighbors for the Track (Qdrant primary, FAISS fallback)
                    vector = get_vec(t_idx).reshape(1, -1).astype(np.float32)
                    norm = np.linalg.norm(vector)
                    if norm > 0:
                        vector = vector / norm

                    retrieve_k = max(limit * 2, 50)
                    candidates = []
                    if cg.qdrant and cg.qdrant.client:
                        candidates = cg.qdrant.search_similar_vector(vector[0], limit=retrieve_k)

                    if not candidates:
                        import faiss
                        D, I = cg.faiss_index.search(vector, retrieve_k)
                        candidates = [track_index[idx] for idx in I[0] if idx != -1 and idx < len(track_index)]

                if not candidates:
                    print(json.dumps({"reqId": req_id, "tracks": []}), flush=True)
                    continue

                if u_idx is not None:
                    # Known user: Rank with Contextual Bandit
                    u_t            = user_profiles[u_idx]
                    with data_lock:
                        cand_indices   = [track_id_to_idx[tid] for tid in candidates if tid in track_id_to_idx]
                        candidates_x_a = get_vecs(cand_indices)
                    scores         = bandit.score_candidates(user_id, u_t, candidates_x_a)
                    top_idx        = np.argsort(scores)[::-1][:limit]
                    top_tracks     = [candidates[i] for i in top_idx]
                    print(json.dumps({"reqId": req_id, "tracks": top_tracks}), flush=True)
                else:
                    # Cold start user: Return the purest FAISS nearest neighbors up to limit
                    print(json.dumps({"reqId": req_id, "tracks": candidates[:limit]}), flush=True)

            elif action == "feedback":
                user_id  = req.get("userId")
                track_id = req.get("trackId")
                reward   = req.get("reward", 0.0)

                u_idx = cg.user_id_to_idx.get(user_id)
                with data_lock:
                    t_idx = track_id_to_idx.get(track_id)
                    x_a = get_vec(t_idx) if t_idx is not None else None

                if u_idx is not None and x_a is not None:
                    u_t = user_profiles[u_idx]
                    bandit.update(user_id, u_t, x_a, reward)

                print(json.dumps({"reqId": req_id, "status": "ok"}), flush=True)

            elif action == "add_track":
                # Fix 2: Immediately enqueue to background worker for non-blocking execution
                track_id          = req.get("trackId")
                similar_track_ids = req.get("similarTrackIds", [])

                with data_lock:
                    if track_id in track_id_to_idx:
                        print(json.dumps({"reqId": req_id, "status": "already_exists"}), flush=True)
                        continue

                # Enqueue write
                write_queue.put(("add_track", {"trackId": track_id, "similarTrackIds": similar_track_ids}))
                print(json.dumps({"reqId": req_id, "status": "queued"}), flush=True)

            else:
                print(json.dumps({"reqId": req_id, "error": "Unknown action"}), flush=True)

        except Exception as e:
            print(json.dumps({"error": str(e), "trace": traceback.format_exc()}), flush=True)

if __name__ == "__main__":
    main()
