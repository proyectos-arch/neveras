'use client';

import { AbrirCajasView } from '@/components/abrir-cajas/abrir-cajas-view';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Assembly } from '@/lib/types';
import { collection, query, where } from 'firebase/firestore';
import { Snowflake } from 'lucide-react';

export default function AbrirCajasPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const assembliesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'assemblies'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['In-Transit', 'Assembling'])
    );
  }, [user, firestore]);

  const { data: assemblies, isLoading } = useCollection<Assembly>(assembliesQuery);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Snowflake className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Abrir Cajas
          </h1>
          <p className="text-muted-foreground">
            Gestiona las cajas GTC y escanea los geles para verificar fugas.
          </p>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4">
        <AbrirCajasView assemblies={assemblies || []} />
      </main>
    </div>
  );
}
