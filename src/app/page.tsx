'use client';

import { ConditioningTable } from '@/components/conditioning/conditioning-table';
import { ScanButton } from '@/components/conditioning/scan-button';
import { useUser, useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import type { GelPack, UserProfile } from '@/lib/types';
import { collection, query, where, doc } from 'firebase/firestore';
import { Snowflake } from 'lucide-react';
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

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userProfileRef);
  const { data: gelPacks, isLoading: isLoadingPacks } = useCollection<GelPack>(gelPacksQuery);

  const isLoading = isLoadingProfile || isLoadingPacks;

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
            Acondicionamiento de Gel Packs
          </h1>
          <p className="text-muted-foreground">
            Escanea un gel pack para iniciar o continuar el proceso, o gestiona el inventario.
          </p>
        </div>
        <div className="flex gap-2">
          <ScanButton />
          <AddGelPackDialog />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4">
        <ConditioningTable gelPacks={gelPacks || []} userProfile={userProfile} />
      </main>
    </div>
  );
}
