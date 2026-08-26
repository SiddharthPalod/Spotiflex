import { spawn } from 'child_process';
import { resolve, join } from 'path';

export class MLService {
    static instance = null;
    
    constructor() {
        this.process = null;
        this.ready = false;
        this.callbacks = new Map();
        this.reqIdCounter = 1;
        
        // ML Engine lives in the sibling directory (or path specified by ML_DIR)
        const mlDir = process.env.ML_DIR ? resolve(process.env.ML_DIR) : resolve(process.cwd(), '../ml');
        const scriptPath = join(mlDir, 'src/serving/daemon.py');
        const pythonBin = process.env.PYTHON_BIN || 'python';
        
        console.log(`[MLService] Booting Persistent Python Daemon using ${pythonBin}...`);
        this.process = spawn(pythonBin, [scriptPath], {
            cwd: mlDir,
            env: { ...process.env, OPENBLAS_NUM_THREADS: '1' },
            // Route python stderr directly to Node's console so we see crash logs
            stdio: ['pipe', 'pipe', 'inherit']
        });
        
        let buffer = '';
        
        this.process.stdout.on('data', (data) => {
            buffer += data.toString();
            // Process chunked data into exact newline-separated JSON blobs
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Retain the last incomplete fragment in the buffer
            
            for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                    const res = JSON.parse(line);
                    
                    if (res.status === 'ready') {
                        this.ready = true;
                        console.log(`[MLService] FAISS and ALS Models Loaded into RAM! Ready for inference.`);
                        continue;
                    }
                    if (res.status === 'error' && !res.reqId) {
                        console.error(`[MLService] Daemon Boot Error:`, res.message);
                        continue;
                    }
                    
                    if (res.reqId) {
                        const cb = this.callbacks.get(res.reqId);
                        if (cb) {
                            cb(res);
                            this.callbacks.delete(res.reqId);
                        }
                    } else if (res.error) {
                        console.error(`[MLService] Daemon Global Error:`, res.error, res.trace);
                    }
                } catch (e) {
                    console.error(`[MLService] Unparseable daemon stdout:`, line);
                }
            }
        });
        
        this.process.on('close', (code) => {
            console.warn(`[MLService] Python Daemon unexpectedly exited with code ${code}`);
            this.ready = false;
        });
    }

    static getInstance() {
        if (!MLService.instance) {
            MLService.instance = new MLService();
        }
        return MLService.instance;
    }

    /**
     * Waits for the Python daemon to signal ready (polls with exponential backoff).
     * The FAISS index takes ~15-30s to load into RAM on container start.
     * Prevents the race where frontend fires recs before Python finishes initializing.
     */
    waitUntilReady(maxWaitMs = 45000) {
        if (this.ready) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const start = Date.now();
            let delay = 500;
            const check = () => {
                if (this.ready) return resolve();
                if (Date.now() - start > maxWaitMs) return reject(new Error('ML Daemon did not become ready in time'));
                delay = Math.min(delay * 1.5, 2000);
                setTimeout(check, delay);
            };
            check();
        });
    }

    async getRecommendations(userId, historyTrackIds = []) {
        if (!this.ready) {
            console.warn(`[MLService] Daemon still loading — waiting up to 45s for FAISS index to load...`);
            try {
                await this.waitUntilReady();
            } catch {
                console.warn(`[MLService] Daemon did not become ready in time. Skipping.`);
                return [];
            }
        }
        
        return new Promise((resolve, reject) => {
            const reqId = this.reqIdCounter++;
            
            // Failsafe 15-second timeout so the API doesn't hang if Python freezes.
            // First request after boot can be slower due to mmap page-fault warmup.
            const timeout = setTimeout(() => {
                this.callbacks.delete(reqId);
                reject(new Error("ML Engine Inference Timeout"));
            }, 15000);
            
            // Register callback to be triggered when Python prints the matching JSON response
            this.callbacks.set(reqId, (res) => {
                clearTimeout(timeout);
                if (res.error) reject(new Error(res.error));
                else resolve(res.tracks || []);
            });
            
            // Push to Python's stdin
            const payload = JSON.stringify({ reqId, action: "recommend", userId, historyTrackIds });
            this.process.stdin.write(payload + '\n');
        });
    }

    async getSimilarTracks(userId, trackId) {
        if (!this.ready) {
            console.warn(`[MLService] Daemon still loading — waiting for FAISS index...`);
            try {
                await this.waitUntilReady();
            } catch {
                return [];
            }
        }
        
        return new Promise((resolve, reject) => {
            const reqId = this.reqIdCounter++;
            
            const timeout = setTimeout(() => {
                this.callbacks.delete(reqId);
                reject(new Error("ML Engine Similar Tracks Timeout"));
            }, 15000);
            
            this.callbacks.set(reqId, (res) => {
                clearTimeout(timeout);
                if (res.error) reject(new Error(res.error));
                else resolve(res.tracks || []);
            });
            
            const payload = JSON.stringify({ reqId, action: "similar", userId, trackId });
            this.process.stdin.write(payload + '\n');
        });
    }

    async sendFeedback(userId, trackId, reward) {
        if (!this.ready) return;
        return new Promise((resolve, reject) => {
            const reqId = this.reqIdCounter++;
            
            const timeout = setTimeout(() => {
                this.callbacks.delete(reqId);
                reject(new Error("ML Engine Feedback Timeout"));
            }, 5000);
            
            this.callbacks.set(reqId, (res) => {
                clearTimeout(timeout);
                if (res.error) reject(new Error(res.error));
                else resolve(res);
            });
            
            const payload = JSON.stringify({ reqId, action: "feedback", userId, trackId, reward });
            this.process.stdin.write(payload + '\n');
        });
    }

    async addTrackToIndex(trackId, similarTrackIds) {
        if (!this.ready) return;
        return new Promise((resolve, reject) => {
            const reqId = this.reqIdCounter++;
            
            // This might take longer since it computes centroids and updates FAISS
            const timeout = setTimeout(() => {
                this.callbacks.delete(reqId);
                reject(new Error("ML Engine Add Track Timeout"));
            }, 10000);
            
            this.callbacks.set(reqId, (res) => {
                clearTimeout(timeout);
                if (res.error) reject(new Error(res.error));
                else resolve(res);
            });
            
            const payload = JSON.stringify({ reqId, action: "add_track", trackId, similarTrackIds });
            this.process.stdin.write(payload + '\n');
        });
    }
}
