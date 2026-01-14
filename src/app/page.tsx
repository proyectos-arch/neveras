'use client';

import { ConditioningTable } from '@/components/conditioning/conditioning-table';
import { ScanButton } from '@/components/conditioning/scan-button';
import { useUser, useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import type { GelPack, UserProfile } from '@/lib/types';
import { collection, query, where, doc } from 'firebase/firestore';
import { AddGelPackDialog } from '@/components/gel-pack-management/add-gel-pack-dialog';

export default function ConditioningPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const gelPacksQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'gelPacks'), where('ownerId', '==', user.uid));
  }, [user, firestore]);

  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const { data: gelPacks } = useCollection<GelPack>(gelPacksQuery);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 w-full min-w-0">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Acondicionamiento de Gel Packs
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Escanea un gel pack para iniciar o continuar el proceso, o gestiona el inventario.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ScanButton />
          <AddGelPackDialog />
        </div>
      </header>
      <main className="flex flex-col gap-6 w-full">
        <ConditioningTable gelPacks={gelPacks || []} userProfile={userProfile} />
      </main>
    </div>
  );
}
