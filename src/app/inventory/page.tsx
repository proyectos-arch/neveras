'use client';

import { useUser, useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import type { GelPack, ChamberType, Assembly, UserProfile } from '@/lib/types';
import { collection, query, where, doc } from 'firebase/firestore';
import { Snowflake } from 'lucide-react';
import { ChamberView } from '@/components/inventory/chamber-view';

const chamberTypes: (ChamberType | 'FRIDGE-30')[] = ['-15-25', '+2+8', '+15+25', 'FRIDGE-30'];

export default function InventoryPage() {
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

  const assembliesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'assemblies'),
      where('ownerId', '==', user.uid),
      where('status', '==', 'In-Transit')
    );
  }, [user, firestore]);
  
  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userProfileRef);
  const { data: gelPacks, isLoading: isLoadingPacks } = useCollection<GelPack>(gelPacksQuery);
  const { data: assemblies, isLoading: isLoadingAssemblies } = useCollection<Assembly>(assembliesQuery);

  const isLoading = isLoadingPacks || isLoadingAssemblies || isLoadingProfile;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Snowflake className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const allPacks = gelPacks || [];
  const inTransitAssemblies = assemblies || [];

  const packsInChamber = (chamber: ChamberType | 'FRIDGE-30') =>
    allPacks.filter(p => p.status === 'Conditioning' && p.lastConditioningEvent?.chamberType === chamber);

  const packsInLeakedTest = allPacks.filter(p => p.status === 'Leaked Test');
  const packsInInspeccion = allPacks.filter(p => p.status === 'Inspección');
  
  const packsInUseIds = new Set(inTransitAssemblies.flatMap(a => a.gelPackIds));
  const packsInUse = allPacks.filter(p => packsInUseIds.has(p.id));

  const otherPacks = allPacks.filter(p => 
    p.status !== 'Conditioning' && 
    p.status !== 'Inspección' &&
    p.status !== 'Leaked Test' &&
    !packsInUseIds.has(p.id)
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Inventario General</h1>
        <p className="text-muted-foreground">
          Vista global de todos tus activos, su ubicación y estado en tiempo real.
        </p>
      </header>
      <main className="grid flex-1 items-start gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        
        {/* Active Assemblies */}
        <ChamberView
            chamberType="in-transit"
            assemblies={inTransitAssemblies}
            gelPacks={packsInUse}
            userProfile={userProfile}
        />

        {/* Conditioning Chambers */}
        {chamberTypes.map(chamber => (
          <ChamberView 
            key={chamber}
            chamberType={chamber}
            gelPacks={packsInChamber(chamber)}
            userProfile={userProfile}
          />
        ))}

        {/* Leaked Test Area */}
        <ChamberView 
          chamberType="leaked-test"
          gelPacks={packsInLeakedTest}
          userProfile={userProfile}
        />
        
        {/* Inspection Area */}
        <ChamberView 
          chamberType="inspection"
          gelPacks={packsInInspeccion}
          userProfile={userProfile}
        />
        
        {/* Other Packs */}
        <ChamberView 
          chamberType="other"
          gelPacks={otherPacks}
          userProfile={userProfile}
        />
      </main>
    </div>
  );
}
