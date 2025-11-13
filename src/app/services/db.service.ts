import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DbService {
  private dbName = 'mecanicapp';
  private db?: IDBDatabase;

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('vehicles')) db.createObjectStore('vehicles', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('maintenances')) db.createObjectStore('maintenances', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('reminders')) db.createObjectStore('reminders', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private tx(store: string, mode: IDBTransactionMode) {
    const t = this.db!.transaction(store, mode);
    return t.objectStore(store);
  }

  async put(store: string, item: any) {
    await this.init();
    await new Promise((resolve, reject) => {
      const req = this.tx(store, 'readwrite').put(item);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async bulkPut(store: string, items: any[]) {
    await this.init();
    await Promise.all(items.map(i => this.put(store, i)));
  }

  async getAll(store: string): Promise<any[]> {
    await this.init();
    return await new Promise((resolve, reject) => {
      const req = this.tx(store, 'readonly').getAll();
      req.onsuccess = () => resolve(req.result as any[]);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(store: string) {
    await this.init();
    await new Promise((resolve, reject) => {
      const req = this.tx(store, 'readwrite').clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
}