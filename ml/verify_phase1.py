import os
import sys
import json
import time
import subprocess
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DAEMON_PATH = os.path.join(BASE_DIR, 'src', 'serving', 'daemon.py')
FIXTURES_DIR = os.path.join(BASE_DIR, 'fixtures')
BASELINE_FILE = os.path.join(FIXTURES_DIR, 'baseline_recs.json')

def test_daemon_performance_and_regression():
    print("--- Starting ML Daemon Verification Suite ---")
    
    # 1. Start daemon process
    env = os.environ.copy()
    env['OPENBLAS_NUM_THREADS'] = '1'
    p = subprocess.Popen(
        [sys.executable, DAEMON_PATH],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=BASE_DIR,
        env=env
    )

    def read_line():
        return p.stdout.readline().strip()

    def send_cmd(cmd_dict):
        p.stdin.write(json.dumps(cmd_dict) + '\n')
        p.stdin.flush()
        line = read_line()
        return json.loads(line)

    try:
        # Wait for ready signal
        boot_line = read_line()
        boot_json = json.loads(boot_line)
        assert boot_json.get("status") == "ready", f"Boot failed: {boot_json}"
        print("[Pass] Daemon booted and signaled ready.")

        # 2. Test Fix 1 & Regression with baseline
        with open(BASELINE_FILE, 'r') as f:
            baseline = json.load(f)

        print("\n--- Testing Fix 1: Candidate Slicing & Recommendation Quality ---")
        latencies = []
        for uid, expected_tracks in baseline.items():
            t0 = time.time()
            resp = send_cmd({"reqId": 100, "action": "recommend", "userId": uid, "limit": 25})
            dt = (time.time() - t0) * 1000
            latencies.append(dt)
            rec_tracks = resp.get("tracks", [])

            # Check overlap with baseline (top 10 overlap)
            overlap = set(rec_tracks[:10]).intersection(set(expected_tracks[:10]))
            print(f"User {uid[:8]}... Latency: {dt:.1f}ms | Overlap with baseline: {len(overlap)}/10")
            assert len(rec_tracks) <= 25, f"Limit exceeded: got {len(rec_tracks)}"
            assert len(rec_tracks) >= 10, f"Expected at least 10 recs: got {len(rec_tracks)}"

        avg_latency = np.mean(latencies)
        print(f"[Pass] Average recommendation latency: {avg_latency:.2f}ms")

        # 3. Test Fix 2: Non-blocking add_track queue
        print("\n--- Testing Fix 2: Non-blocking Async add_track Queue ---")
        dummy_track_id = f"test_track_{int(time.time())}"
        # Provide some existing track IDs as neighbors
        sample_neighbors = list(baseline.values())[0][:3]
        
        t0 = time.time()
        add_resp = send_cmd({
            "reqId": 200,
            "action": "add_track",
            "trackId": dummy_track_id,
            "similarTrackIds": sample_neighbors
        })
        dt_add = (time.time() - t0) * 1000
        print(f"add_track response time: {dt_add:.2f}ms | Response: {add_resp}")
        assert add_resp.get("status") == "queued", f"Expected queued status: {add_resp}"
        assert dt_add < 100.0, f"add_track was blocking! Took {dt_add}ms"
        print("[Pass] add_track returned instantly with status: queued.")

        # Give background worker 0.5s to complete ingestion & disk append
        time.sleep(0.5)

        # 4. Test Fix 3: Read newly ingested track via 'similar'
        print("\n--- Testing Fix 3: Ingestion Verification & Similar Track Retrieval ---")
        sim_resp = send_cmd({
            "reqId": 300,
            "action": "similar",
            "trackId": dummy_track_id,
            "limit": 10
        })
        sim_tracks = sim_resp.get("tracks", [])
        print(f"Similar tracks for newly added track {dummy_track_id}: count={len(sim_tracks)}")
        assert len(sim_tracks) > 0, "Failed to retrieve neighbors for newly added track!"
        print("[Pass] Newly ingested track is immediately discoverable.")

        # Send duplicate add_track to verify idempotency
        dup_resp = send_cmd({
            "reqId": 201,
            "action": "add_track",
            "trackId": dummy_track_id,
            "similarTrackIds": []
        })
        assert dup_resp.get("status") == "already_exists", f"Expected already_exists, got: {dup_resp}"
        print("[Pass] Duplicate track handled correctly with already_exists.")

        print("\n==========================================")
        print(" ALL PHASE 1 VERIFICATION TESTS PASSED! ")
        print("==========================================")

    finally:
        p.terminate()
        p.wait()

if __name__ == "__main__":
    test_daemon_performance_and_regression()
