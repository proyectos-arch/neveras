'use client';

import { ReservaView } from '@/components/reserva/reserva-view';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { GelPack } from '@/lib/types';
import { collection, query, where } from 'firebase/firestore';
import { Snowflake } from 'lucide-react';

export default function ReservaPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Obtener todos los gel packs que están en proceso de acondicionamiento
  const gelPacksQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'gelPacks'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['Leaked Test', 'Conditioning'])
    );
  }, [user, firestore]);

  const { data: gelPacks, isLoading } = useCollection<GelPack>(gelPacksQuery);

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
            Solicitud de Reserva
          </h1>
          <p className="text-muted-foreground">
            Consulta la disponibilidad de geles y reserva cajas para tus envíos.
          </p>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4">
        <ReservaView gelPacks={gelPacks || []} />
      </main>
    </div>
  );
}
