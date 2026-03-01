/**
 * Cache Service for LocalStorage
 * Prevents redundant I/O operations by caching localStorage reads
 */

class CacheService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5000; // 5 seconds cache lifetime

  /**
   * Get data from cache or localStorage
   */
  get<T>(key: string, defaultValue: T, skipCache: boolean = false): T {
    // Check cache first
    if (!skipCache) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data as T;
      }
    }

    // Read from localStorage
    try {
      const stored = localStorage.getItem(key);
      if (!stored) {
        this.set(key, defaultValue);
        return defaultValue;
      }

      const parsed = JSON.parse(stored) as T;
      this.cache.set(key, { data: parsed, timestamp: Date.now() });
      return parsed;
    } catch (error) {
      console.error(`Error reading from localStorage (${key}):`, error);
      return defaultValue;
    }
  }

  /**
   * Set data in localStorage and update cache
   */
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      this.cache.set(key, { data: value, timestamp: Date.now() });
    } catch (error) {
      console.error(`Error writing to localStorage (${key}):`, error);
    }
  }

  /**
   * Invalidate cache for a specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update existing data with a transformer function
   */
  update<T>(key: string, updater: (current: T) => T, defaultValue: T): T {
    const current = this.get<T>(key, defaultValue, true);
    const updated = updater(current);
    this.set(key, updated);
    return updated;
  }
}

// Singleton instance
export const cacheService = new CacheService();
