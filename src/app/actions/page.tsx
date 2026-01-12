'use client';

import { useUser, useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import type { GelPack, UserProfile } from '@/lib/types';
import { collection, query, where, doc } from 'firebase/firestore';
import { Snowflake, Bell, ArrowRight } from 'lucide-react';
import { useCurrentTime } from '@/context/DebugTimeContext';
import { getNextStep } from '@/lib/conditioning-logic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function ActionsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { currentTime } = useCurrentTime();

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const gelPacksQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'gelPacks'), 
        where('ownerId', '==', user.uid),
        where('status', 'in', ['Leaked Test', 'Conditioning', 'Inspección'])
    );
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

  const packsRequiringAction = (gelPacks || []).filter(pack => {
    const { needsAction } = getNextStep(pack, currentTime, userProfile);
    return needsAction;
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Acciones Requeridas</h1>
        <p className="text-muted-foreground">
          Packs que han completado su tiempo y necesitan ser movidos al siguiente paso.
        </p>
      </header>
      <main className="flex flex-1 flex-col gap-4">
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Serial</TableHead>
                            <TableHead>Estado Actual</TableHead>
                            <TableHead>Siguiente Paso Recomendado</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {packsRequiringAction.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-48">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Bell className="h-10 w-10" />
                                        <p className="text-lg font-medium">¡Todo en orden!</p>
                                        <p>No hay acciones requeridas en este momento.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                         ) : (
                            packsRequiringAction.map(pack => {
                                const { message } = getNextStep(pack, currentTime, userProfile);
                                return (
                                    <TableRow key={pack.id} className="hover:bg-green-500/5">
                                        <TableCell className="font-medium">{pack.serial}</TableCell>
                                        <TableCell><Badge variant="outline">{pack.status}</Badge></TableCell>
                                        <TableCell className="font-semibold text-green-700">{message}</TableCell>
                                        <TableCell className="text-right">
                                            <Link href="/conditioning" className="text-sm text-primary hover:underline flex items-center justify-end gap-1">
                                                <span>Ir a Acondicionar</span>
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                         )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
