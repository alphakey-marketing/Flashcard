// Storage cache utility to reduce localStorage reads

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class StorageCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  get<T>(key: string, ttl?: number): T | null {
    const cached = this.cache.get(key);
    
    if (cached) {
      // Check if cache is still valid
      if (!ttl || Date.now() - cached.timestamp < ttl) {
        return cached.data as T;
      }
      // Cache expired, remove it
      this.cache.delete(key);
    }

    // Not in cache or expired, read from localStorage
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      const data = JSON.parse(item) as T;
      
      // Store in cache
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      
      // Update cache
      this.cache.set(key, {
        data: value,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error writing to cache:', error);
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
      this.cache.delete(key);
    } catch (error) {
      console.error('Error removing from cache:', error);
    }
  }

  clear(): void {
    try {
      localStorage.clear();
      this.cache.clear();
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}

export const storageCache = new StorageCache();
