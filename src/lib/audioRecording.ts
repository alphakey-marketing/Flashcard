// Audio Recording Storage Utility
// Uses IndexedDB for efficient audio blob storage

const DB_NAME = 'FlashcardAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

interface AudioRecording {
  id: string; // Format: `${setId}_${cardId}_${timestamp}`
  setId: string;
  cardId: string;
  audioBlob: Blob;
  timestamp: number;
  duration: number; // in seconds
}

class AudioRecordingDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('setId', 'setId', { unique: false });
          store.createIndex('cardId', 'cardId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveRecording(recording: AudioRecording): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(recording);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRecording(id: string): Promise<AudioRecording | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getLatestRecordingForCard(setId: string, cardId: string): Promise<AudioRecording | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('cardId');
      const request = index.openCursor(IDBKeyRange.only(cardId), 'prev');

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const recording = cursor.value as AudioRecording;
          if (recording.setId === setId) {
            resolve(recording);
          } else {
            cursor.continue();
          }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecording(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecordingsForCard(setId: string, cardId: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('cardId');
      const request = index.openCursor(IDBKeyRange.only(cardId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const recording = cursor.value as AudioRecording;
          if (recording.setId === setId) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getTotalStorageSize(): Promise<number> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      let totalSize = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const recording = cursor.value as AudioRecording;
          totalSize += recording.audioBlob.size;
          cursor.continue();
        } else {
          resolve(totalSize);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearOldRecordings(daysToKeep: number = 30): Promise<number> {
    if (!this.db) await this.init();
    
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const audioRecordingDB = new AudioRecordingDB();

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;

  async checkPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state === 'granted' || result.state === 'prompt';
    } catch (error) {
      console.warn('Permission query not supported, will prompt on start');
      return true;
    }
  }

  async startRecording(): Promise<void> {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      // Determine supported MIME type
      const mimeType = this.getSupportedMimeType();
      
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.cleanup();
      throw error;
    }
  }

  async stopRecording(): Promise<{ blob: Blob; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const duration = (Date.now() - this.startTime) / 1000;
        const mimeType = this.getSupportedMimeType();
        const blob = new Blob(this.audioChunks, { type: mimeType });
        
        this.cleanup();
        resolve({ blob, duration });
      };

      this.mediaRecorder.onerror = (error) => {
        this.cleanup();
        reject(error);
      };

      this.mediaRecorder.stop();
    });
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.startTime = 0;
  }
}

export async function saveRecording(
  setId: string,
  cardId: string,
  audioBlob: Blob,
  duration: number
): Promise<string> {
  const id = `${setId}_${cardId}_${Date.now()}`;
  const recording: AudioRecording = {
    id,
    setId,
    cardId,
    audioBlob,
    timestamp: Date.now(),
    duration
  };

  await audioRecordingDB.saveRecording(recording);
  return id;
}

export async function getLatestRecording(
  setId: string,
  cardId: string
): Promise<{ blob: Blob; duration: number; timestamp: number } | null> {
  const recording = await audioRecordingDB.getLatestRecordingForCard(setId, cardId);
  if (!recording) return null;

  return {
    blob: recording.audioBlob,
    duration: recording.duration,
    timestamp: recording.timestamp
  };
}

export async function deleteRecordingsForCard(setId: string, cardId: string): Promise<void> {
  await audioRecordingDB.deleteRecordingsForCard(setId, cardId);
}

export async function getStorageInfo(): Promise<{ totalSize: number; formattedSize: string }> {
  const totalSize = await audioRecordingDB.getTotalStorageSize();
  const formattedSize = formatBytes(totalSize);
  return { totalSize, formattedSize };
}

export async function cleanupOldRecordings(daysToKeep: number = 30): Promise<number> {
  return await audioRecordingDB.clearOldRecordings(daysToKeep);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
