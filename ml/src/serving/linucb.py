import numpy as np
import time
import sqlite3
import os
from datetime import datetime

# Calculate absolute path to Spotiflix API folder's dev.db
ML_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API_DIR = os.path.dirname(ML_ROOT)
DB_PATH = os.path.join(API_DIR, 'api', 'prisma', 'dev.db')

class HybridLinUCB:
    def __init__(self, d=1404, alpha=0.1):
        """
        Hybrid LinUCB Contextual Bandit, backed persistently by SQLite via Prisma schema.
        Utilizes a strict diagonal matrix approximation to reduce memory and latency.
        """
        self.d = d
        self.alpha = alpha
        
        # Connect natively to the backend SQLite DB to persist state
        self.conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        
        # Load or initialize the Global model weights
        A_glob, b_glob = self._load_state('global')
        if A_glob is not None:
            self.A_global = A_glob
            self.b_global = b_glob
        else:
            self.A_global = np.ones(d, dtype=np.float32)
            self.b_global = np.zeros(d, dtype=np.float32)
            self._save_state('global', self.A_global, self.b_global)
        
        # In-memory dictionary acting as an LRU cache for active users
        self.users_A = {}
        self.users_b = {}
        
    def _load_state(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute("SELECT A, b FROM LinUCBState WHERE userId = ?", (user_id,))
        row = cursor.fetchone()
        if row:
            # BLOB native deserialization: insanely fast O(1) buffer read
            A = np.frombuffer(row[0], dtype=np.float32).copy()
            b = np.frombuffer(row[1], dtype=np.float32).copy()
            return A, b
        return None, None
        
    def _save_state(self, user_id, A, b):
        cursor = self.conn.cursor()
        now = datetime.utcnow().isoformat()
        cursor.execute('''
            INSERT INTO LinUCBState (userId, A, b, updatedAt)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(userId) DO UPDATE SET
                A=excluded.A,
                b=excluded.b,
                updatedAt=excluded.updatedAt
        ''', (user_id, A.tobytes(), b.tobytes(), now))
        self.conn.commit()
        
    def _init_user(self, user_id):
        if user_id not in self.users_A:
            A_u, b_u = self._load_state(user_id)
            if A_u is not None:
                self.users_A[user_id] = A_u
                self.users_b[user_id] = b_u
            else:
                self.users_A[user_id] = np.ones(self.d, dtype=np.float32)
                self.users_b[user_id] = np.zeros(self.d, dtype=np.float32)
                self._save_state(user_id, self.users_A[user_id], self.users_b[user_id])
            
    def score_candidates(self, user_id, u_t, candidates_x_a):
        self._init_user(user_id)
        
        N = candidates_x_a.shape[0]
        if N == 0:
            return np.array([])
            
        A_u = self.users_A[user_id]
        b_u = self.users_b[user_id]
        
        # Shared features interaction z_{u,a}
        z_ua = u_t * candidates_x_a
        
        beta_global = self.b_global / self.A_global
        theta_u = b_u / A_u
        
        # Expected Reward
        e_global = np.sum(z_ua * beta_global, axis=1)
        e_user = np.sum(candidates_x_a * theta_u, axis=1)
        expected_reward = e_global + e_user
        
        # Uncertainty (Upper Confidence Bound)
        cb_global = np.sum((z_ua ** 2) / self.A_global, axis=1)
        cb_user = np.sum((candidates_x_a ** 2) / A_u, axis=1)
        cb = self.alpha * np.sqrt(cb_global + cb_user)
        
        # Final Score
        score = expected_reward + cb
        return score
        
    def update(self, user_id, u_t, x_a, reward):
        self._init_user(user_id)
        
        z_ua = u_t * x_a
        
        # Memory Updates
        self.A_global += z_ua ** 2
        self.b_global += reward * z_ua
        
        self.users_A[user_id] += x_a ** 2
        self.users_b[user_id] += reward * x_a
        
        # Persist to SQLite
        self._save_state('global', self.A_global, self.b_global)
        self._save_state(user_id, self.users_A[user_id], self.users_b[user_id])

if __name__ == "__main__":
    print("Testing Hybrid LinUCB Bandit with SQLite Persistence...")
    d = 1404
    N = 100
    bandit = HybridLinUCB(d=d, alpha=0.5)
    
    user_id = "demo-user-123"
    u_t = np.random.randn(d).astype(np.float32)
    candidates_x_a = np.random.randn(N, d).astype(np.float32)
    
    # Simulate Feedback
    bandit.update(user_id, u_t, candidates_x_a[0], reward=1.0)
    
    # Reload and verify persistence
    bandit2 = HybridLinUCB(d=d, alpha=0.5)
    bandit2._init_user(user_id)
    assert np.allclose(bandit.users_A[user_id], bandit2.users_A[user_id]), "SQLite Persistence Failed!"
    print("SQLite Persistence Verified Successfully! Data matched flawlessly.")
