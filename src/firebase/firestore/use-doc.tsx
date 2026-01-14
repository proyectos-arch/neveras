'use client';

import { useState, useEffect, useRef } from 'react';
import {
  onSnapshot,
  getDocFromCache,
  type DocumentReference,
  type DocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';

export interface UseDocResult<T> {
  data: (T & { id: string }) | null;
  isLoading: boolean;
  error: Error | null;
}

export function useDoc<T>(ref: DocumentReference | null): UseDocResult<T> {
  const [data, setData] = useState<(T & { id: string }) | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedFromCache = useRef(false);

  const path = ref?.path;

  useEffect(() => {
    if (!ref) {
      setData(null);
      setIsLoading(false);
      return;
    }

    hasLoadedFromCache.current = false;
    setIsLoading(true);

    // Try to load from cache first for instant display
    getDocFromCache(ref)
      .then((cachedDoc) => {
        if (cachedDoc.exists() && !hasLoadedFromCache.current) {
          hasLoadedFromCache.current = true;
          setData({ ...(cachedDoc.data() as T), id: cachedDoc.id });
          setIsLoading(false);
        }
      })
      .catch(() => {
        // No cache available, will wait for server
      });

    const unsubscribe = onSnapshot(
      ref,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          setData(null);
        }
        setIsLoading(false);
      },
      (err) => {
        console.error(`useDoc error for path: ${ref.path}`, err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [path]);

  return { data, isLoading, error };
}
