// This file is new
'use client';

import { AssemblyTable } from '@/components/assembly/assembly-table';
import { NewAssemblyDialog } from '@/components/assembly/new-assembly-dialog';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Assembly } from '@/lib/types';
import { collection, query, where } from 'firebase/firestore';
import { Snowflake } from 'lucide-react';

export default function AssemblyPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const assembliesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'assemblies'), where('ownerId', '==', user.uid));
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
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Ensamblaje de Cajas GTC
          </h1>
          <p className="text-muted-foreground">
            Crea un nuevo ensamblaje o revisa el historial de viajes.
          </p>
        </div>
        <NewAssemblyDialog />
      </header>
      <main className="flex flex-1 flex-col gap-4">
        <AssemblyTable assemblies={assemblies || []} />
      </main>
    </div>
  );
}
