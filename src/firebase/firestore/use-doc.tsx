'use client';

import { useState, useEffect } from 'react';
import {
  onSnapshot,
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const path = ref?.path;

  useEffect(() => {
    if (!ref) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

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

    // Unsubscribe when the component unmounts or the ref changes.
    return () => unsubscribe();
  }, [path]); // Re-subscribe only if the document path changes.

  return { data, isLoading, error };
}
