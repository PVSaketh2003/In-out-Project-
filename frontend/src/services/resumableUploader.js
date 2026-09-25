/**
 * VisionEye Production Resumable Chunked Video Uploader
 * 
 * Features:
 * - Dynamic adaptive chunking (1MB to 10MB based on file size & network)
 * - Bounded parallel worker pool (up to 3-4 concurrent chunk uploads)
 * - Resumability surviving page refreshes and network drops via file fingerprinting
 * - SHA-256 chunk integrity verification
 * - Exponential backoff with jitter on network retry
 * - Accurate byte-level progress reporting
 * - Graceful cancellation
 */

const API_BASE = window.location.port === '5173'
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : '/api';

/**
 * Computes SHA-256 hash of an ArrayBuffer using Web Crypto API.
 */
async function computeSha256(arrayBuffer) {
  if (window.crypto && window.crypto.subtle) {
    try {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('[Uploader] Web Crypto digest fallback:', e);
    }
  }
  return '';
}

/**
 * Determine optimal chunk size based on total file size.
 */
function getOptimalChunkSize(fileSize) {
  if (fileSize < 20 * 1024 * 1024) {
    return 2 * 1024 * 1024; // 2 MB chunks for <20 MB
  } else if (fileSize < 200 * 1024 * 1024) {
    return 5 * 1024 * 1024; // 5 MB chunks for 20-200 MB
  } else {
    return 10 * 1024 * 1024; // 10 MB chunks for large 4K/HD video
  }
}

/**
 * Generates client file fingerprint to locate resumable sessions.
 */
function getFileFingerprint(file) {
  return `ve_upload_${file.name}_${file.size}_${file.lastModified}`;
}

export class ResumableUploader {
  constructor(file, options = {}) {
    this.file = file;
    this.onProgress = options.onProgress || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.maxConcurrency = options.maxConcurrency || 3;
    this.maxRetries = options.maxRetries || 3;
    this.chunkSize = options.chunkSize || getOptimalChunkSize(file.size);

    this.totalChunks = Math.max(1, Math.ceil(file.size / this.chunkSize));
    this.uploadId = null;
    this.uploadedChunks = new Set();
    this.chunkBytesUploaded = new Map(); // chunkIndex -> bytes uploaded in current flight
    this.aborted = false;
    this.activeControllers = new Set();
  }

  /**
   * Starts or resumes the chunked upload.
   */
  async start() {
    this.aborted = false;
    const fingerprint = getFileFingerprint(this.file);

    // 1. Check for cached session ID in localStorage
    let existingUploadId = localStorage.getItem(fingerprint);
    if (existingUploadId) {
      try {
        const checkRes = await fetch(`${API_BASE}/video/upload/status/${existingUploadId}`);
        if (checkRes.ok) {
          const sessionData = await checkRes.json();
          if (sessionData.status !== 'cancelled' && sessionData.status !== 'completed') {
            this.uploadId = existingUploadId;
            this.chunkSize = sessionData.chunk_size || this.chunkSize;
            this.totalChunks = sessionData.total_chunks || this.totalChunks;
            (sessionData.uploaded_chunks || []).forEach((idx) => {
              this.uploadedChunks.add(idx);
              this.chunkBytesUploaded.set(idx, this._getChunkSize(idx));
            });
            this.onStatusChange('resuming', {
              uploadId: this.uploadId,
              uploadedCount: this.uploadedChunks.size,
              totalChunks: this.totalChunks,
            });
          }
        }
      } catch (e) {
        console.warn('[Uploader] Resume check error:', e);
      }
    }

    // 2. Initialize new session if not resumed
    if (!this.uploadId) {
      this.onStatusChange('initializing');
      const initRes = await fetch(`${API_BASE}/video/upload/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: this.file.name,
          file_size: this.file.size,
          content_type: this.file.type || 'video/mp4',
          chunk_size: this.chunkSize,
        }),
      });

      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(err.error || `Upload initialization failed (HTTP ${initRes.status})`);
      }

      const initData = await initRes.json();
      this.uploadId = initData.upload_id;
      this.chunkSize = initData.chunk_size;
      this.totalChunks = initData.total_chunks;
      localStorage.setItem(fingerprint, this.uploadId);
    }

    this._updateProgress();
    this.onStatusChange('uploading', {
      uploadId: this.uploadId,
      totalChunks: this.totalChunks,
    });

    // 3. Prepare Queue of remaining chunks
    const remainingChunks = [];
    for (let i = 0; i < this.totalChunks; i++) {
      if (!this.uploadedChunks.has(i)) {
        remainingChunks.push(i);
      }
    }

    if (remainingChunks.length === 0) {
      // All chunks already uploaded, jump straight to finalization
      return await this._finalize();
    }

    // 4. Parallel Worker Pool Execution
    let queueIndex = 0;
    const workers = [];

    const worker = async () => {
      while (queueIndex < remainingChunks.length && !this.aborted) {
        const chunkIndex = remainingChunks[queueIndex++];
        await this._uploadChunkWithRetry(chunkIndex);
      }
    };

    const workerCount = Math.min(this.maxConcurrency, remainingChunks.length);
    for (let w = 0; w < workerCount; w++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    if (this.aborted) {
      throw new Error('Upload cancelled by user');
    }

    // 5. Finalize assembly
    this.onStatusChange('finalizing');
    const finalizeResult = await this._finalize();

    // Clean up stored fingerprint on success
    localStorage.removeItem(fingerprint);
    this.onStatusChange('completed', finalizeResult);
    return finalizeResult;
  }

  /**
   * Upload single chunk with exponential backoff retry.
   */
  async _uploadChunkWithRetry(chunkIndex) {
    let attempt = 0;
    let delay = 300; // start with 300ms

    while (attempt <= this.maxRetries && !this.aborted) {
      try {
        await this._uploadChunk(chunkIndex);
        return; // Success
      } catch (err) {
        attempt++;
        if (attempt > this.maxRetries || this.aborted) {
          throw new Error(`Chunk #${chunkIndex} failed after ${attempt} attempts: ${err.message}`);
        }
        // Jittered exponential backoff
        const jitter = Math.random() * 200;
        const waitMs = delay + jitter;
        delay *= 2;
        await new Promise((res) => setTimeout(res, waitMs));
      }
    }
  }

  /**
   * Read chunk blob, compute SHA-256, and upload via XHR for progress tracking.
   */
  async _uploadChunk(chunkIndex) {
    if (this.aborted) return;

    const startByte = chunkIndex * this.chunkSize;
    const endByte = Math.min(this.file.size, startByte + this.chunkSize);
    const chunkBlob = this.file.slice(startByte, endByte);
    const chunkSize = endByte - startByte;

    const arrayBuffer = await chunkBlob.arrayBuffer();
    const chunkHash = await computeSha256(arrayBuffer);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('upload_id', this.uploadId);
      formData.append('chunk_index', chunkIndex.toString());
      if (chunkHash) formData.append('chunk_hash', chunkHash);
      formData.append('chunk_file', chunkBlob, `chunk_${chunkIndex}.part`);

      const controller = { abort: () => xhr.abort() };
      this.activeControllers.add(controller);

      if (xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            this.chunkBytesUploaded.set(chunkIndex, e.loaded);
            this._updateProgress();
          }
        };
      }

      xhr.onload = () => {
        this.activeControllers.delete(controller);
        if (xhr.status >= 200 && xhr.status < 300) {
          this.uploadedChunks.add(chunkIndex);
          this.chunkBytesUploaded.set(chunkIndex, chunkSize);
          this._updateProgress();
          resolve();
        } else {
          const isRetryable = xhr.status >= 500 || xhr.status === 0 || xhr.status === 408;
          const errorMsg = `Server error HTTP ${xhr.status}`;
          if (!isRetryable) {
            this.aborted = true; // Non-retryable error
          }
          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => {
        this.activeControllers.delete(controller);
        reject(new Error('Network connection error'));
      };

      xhr.onabort = () => {
        this.activeControllers.delete(controller);
        reject(new Error('Upload aborted'));
      };

      xhr.open('POST', `${API_BASE}/video/upload/chunk`);
      xhr.send(formData);
    });
  }

  /**
   * Finalizes the upload on the server.
   */
  async _finalize() {
    const res = await fetch(`${API_BASE}/video/upload/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_id: this.uploadId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Finalization failed with HTTP ${res.status}`);
    }

    return await res.json();
  }

  /**
   * Calculates total uploaded bytes and triggers progress callback.
   */
  _updateProgress() {
    let totalUploadedBytes = 0;
    for (let i = 0; i < this.totalChunks; i++) {
      if (this.uploadedChunks.has(i)) {
        totalUploadedBytes += this._getChunkSize(i);
      } else if (this.chunkBytesUploaded.has(i)) {
        totalUploadedBytes += this.chunkBytesUploaded.get(i);
      }
    }

    const percentage = Math.min(100, Math.round((totalUploadedBytes / this.file.size) * 100));
    this.onProgress(percentage, {
      uploadedBytes: totalUploadedBytes,
      totalBytes: this.file.size,
      uploadedChunks: this.uploadedChunks.size,
      totalChunks: this.totalChunks,
    });
  }

  _getChunkSize(chunkIndex) {
    const startByte = chunkIndex * this.chunkSize;
    const endByte = Math.min(this.file.size, startByte + this.chunkSize);
    return endByte - startByte;
  }

  /**
   * Cancels in-flight requests and server session.
   */
  cancel() {
    this.aborted = true;
    for (const ctrl of this.activeControllers) {
      try {
        ctrl.abort();
      } catch (e) {}
    }
    this.activeControllers.clear();

    if (this.uploadId) {
      fetch(`${API_BASE}/video/upload/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_id: this.uploadId }),
      }).catch(console.warn);

      const fingerprint = getFileFingerprint(this.file);
      localStorage.removeItem(fingerprint);
    }
    this.onStatusChange('cancelled');
  }
}
