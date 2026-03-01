/**
 * Storage Cache Service
 * 
 * Provides a caching layer for localStorage to reduce expensive I/O operations
 * and JSON parsing. Implements cache invalidation and automatic updates.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

class StorageCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 5000; // 5 seconds cache lifetime

  /**
   * Get data from cache or localStorage
   * @param key - localStorage key
   * @param ttl - Time to live in milliseconds (default: 5000ms)
   * @returns Parsed data or null
   */
  get<T>(key: string, ttl: number = this.DEFAULT_TTL): T | null {
    const now = Date.now();
    const cached = this.cache.get(key);

    // Check if cache is valid
    if (cached && (now - cached.timestamp) < ttl) {
      return cached.data as T;
    }

    // Cache miss or expired - read from localStorage
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        this.cache.delete(key);
        return null;
      }

      const data = JSON.parse(raw) as T;
      
      // Update cache
      this.cache.set(key, {
        data,
        timestamp: now,
        key
      });

      return data;
    } catch (error) {
      console.error(`Error reading from cache for key "${key}":`, error);
      this.cache.delete(key);
      return null;
    }
  }

  /**
   * Set data in localStorage and update cache
   * @param key - localStorage key
   * @param data - Data to store
   */
  set<T>(key: string, data: T): void {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(key, serialized);

      // Update cache immediately
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        key
      });
    } catch (error) {
      console.error(`Error writing to cache for key "${key}":`, error);
      // Invalidate cache on error
      this.cache.delete(key);
    }
  }

  /**
   * Invalidate cache entry (forces next read from localStorage)
   * @param key - localStorage key to invalidate
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Remove expired cache entries
   * @param ttl - Time to live threshold (default: 5000ms)
   */
  cleanup(ttl: number = this.DEFAULT_TTL): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.timestamp) >= ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

// Export singleton instance
export const storageCache = new StorageCache();

// Optional: Periodic cleanup every 30 seconds
if (typeof window !== 'undefined') {
  setInterval(() => {
    storageCache.cleanup();
  }, 30000);
}
