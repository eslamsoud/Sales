/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function idbGet(key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('eags_db', 1);
    request.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore('store');
    };
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      const tx = db.transaction('store', 'readonly');
      const store = tx.objectStore('store');
      const getReq = store.get(key);
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => reject(getReq.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export function idbSet(key: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('eags_db', 1);
    request.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore('store');
    };
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      const tx = db.transaction('store', 'readwrite');
      const store = tx.objectStore('store');
      const putReq = store.put(value, key);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    request.onerror = () => reject(request.error);
  });
}