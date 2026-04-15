import { useState, useEffect, useCallback, useRef } from 'react';
import {
  addToQueue, getQueue, updateQueueItem, removeFromQueue,
  getQueueByStatus, fileToBase64, base64ToFile,
} from '../utils/offlineDb';
import { apiUpload } from '../utils/api';

export default function useOfflineQueue() {
  const [queue, setQueue] = useState([]);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);

  // Refresh queue from IndexedDB
  const refresh = useCallback(async () => {
    const items = await getQueue();
    setQueue(items);
  }, []);

  // Queue a new photo for analysis
  const enqueue = useCallback(async (files, analysisType) => {
    const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fileData = await Promise.all(Array.from(files).slice(0, 4).map(fileToBase64));

    await addToQueue({
      id,
      files: fileData,
      analysis_type: analysisType || '',
      status: 'pending', // pending | processing | completed | failed
      created_at: Date.now(),
      result: null,
      error: null,
    });

    await refresh();

    // Try to process immediately if online
    if (navigator.onLine) {
      processQueue();
    }

    return id;
  }, [refresh]);

  // Process all pending items
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    try {
      const pending = await getQueueByStatus('pending');

      for (const item of pending) {
        await updateQueueItem(item.id, { status: 'processing' });
        await refresh();

        try {
          const formData = new FormData();
          for (const f of item.files) {
            formData.append('images', base64ToFile(f));
          }
          if (item.analysis_type) {
            formData.append('analysis_type', item.analysis_type);
          }

          const data = await apiUpload('/inspect', formData);

          await updateQueueItem(item.id, {
            status: 'completed',
            result: data.result,
            completed_at: Date.now(),
          });
        } catch (err) {
          await updateQueueItem(item.id, {
            status: 'failed',
            error: err.message || 'Upload failed',
          });
        }

        await refresh();
      }
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [refresh]);

  // Retry a failed item
  const retry = useCallback(async (id) => {
    await updateQueueItem(id, { status: 'pending', error: null });
    await refresh();
    if (navigator.onLine) processQueue();
  }, [refresh, processQueue]);

  // Dismiss a completed/failed item
  const dismiss = useCallback(async (id) => {
    await removeFromQueue(id);
    await refresh();
  }, [refresh]);

  // Clear all completed
  const clearCompleted = useCallback(async () => {
    const completed = await getQueueByStatus('completed');
    for (const item of completed) {
      await removeFromQueue(item.id);
    }
    await refresh();
  }, [refresh]);

  // Listen for online event → auto-process queue
  useEffect(() => {
    const handleOnline = () => {
      processQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [processQueue]);

  // Load queue on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Derived counts
  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const processingCount = queue.filter(q => q.status === 'processing').length;
  const completedCount = queue.filter(q => q.status === 'completed').length;
  const failedCount = queue.filter(q => q.status === 'failed').length;
  const badgeCount = pendingCount + completedCount + failedCount;

  return {
    queue,
    enqueue,
    processQueue,
    retry,
    dismiss,
    clearCompleted,
    refresh,
    processing,
    pendingCount,
    processingCount,
    completedCount,
    failedCount,
    badgeCount,
  };
}
