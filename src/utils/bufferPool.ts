/**
 * Buffer Pool for Float32Array Reuse
 *
 * Reduces GC pressure by pooling and reusing typed arrays in DSP operations.
 * Uses size-class based pooling with power-of-2 sizes for efficient matching.
 */

export interface BufferPool {
  /**
   * Acquire a buffer of at least the requested size
   * Returns a buffer from the pool or allocates a new one
   */
  acquire(minSize: number): Float32Array;

  /**
   * Release a buffer back to the pool for reuse
   * Buffer should not be used after release
   */
  release(buffer: Float32Array): void;

  /**
   * Clear all pooled buffers (call after analysis complete)
   */
  clear(): void;

  /**
   * Get pool statistics for debugging
   */
  stats(): PoolStats;
}

export interface PoolStats {
  totalAcquired: number;
  totalReleased: number;
  pooledBuffers: number;
  hitRate: number;
}

/**
 * Round up to the next power of 2
 */
function nextPowerOf2(n: number): number {
  if (n <= 0) return 1;
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  return n + 1;
}

/**
 * Check if a number is a power of 2
 */
function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

class BufferPoolImpl implements BufferPool {
  private pools: Map<number, Float32Array[]> = new Map();
  private maxPerSize: number;
  private totalAcquired = 0;
  private totalReleased = 0;
  private poolHits = 0;

  constructor(maxPerSize: number = 8) {
    this.maxPerSize = maxPerSize;
  }

  acquire(minSize: number): Float32Array {
    this.totalAcquired++;

    // Round up to nearest power of 2
    const sizeClass = nextPowerOf2(minSize);

    // Check pool for existing buffer
    const pool = this.pools.get(sizeClass);
    if (pool && pool.length > 0) {
      this.poolHits++;
      return pool.pop()!;
    }

    // Allocate new if pool empty
    return new Float32Array(sizeClass);
  }

  release(buffer: Float32Array): void {
    const size = buffer.length;

    // Only pool power-of-2 sizes
    if (!isPowerOf2(size)) return;

    // Don't pool very large buffers (>1MB)
    if (size > 262144) return;

    this.totalReleased++;

    let pool = this.pools.get(size);
    if (!pool) {
      pool = [];
      this.pools.set(size, pool);
    }

    // Don't exceed max pool size per class
    if (pool.length < this.maxPerSize) {
      // Zero the buffer before pooling (prevents data leakage)
      buffer.fill(0);
      pool.push(buffer);
    }
  }

  clear(): void {
    this.pools.clear();
    this.totalAcquired = 0;
    this.totalReleased = 0;
    this.poolHits = 0;
  }

  stats(): PoolStats {
    let pooledBuffers = 0;
    for (const pool of this.pools.values()) {
      pooledBuffers += pool.length;
    }

    return {
      totalAcquired: this.totalAcquired,
      totalReleased: this.totalReleased,
      pooledBuffers,
      hitRate: this.totalAcquired > 0 ? this.poolHits / this.totalAcquired : 0
    };
  }
}

/**
 * Create a new buffer pool instance
 * @param maxPerSize Maximum buffers to keep per size class (default: 8)
 */
export function createBufferPool(maxPerSize: number = 8): BufferPool {
  return new BufferPoolImpl(maxPerSize);
}

/**
 * Singleton pool for DSP operations in worker context
 * Use this for all FFT and filter buffer allocations
 */
export const dspPool: BufferPool = createBufferPool(8);
