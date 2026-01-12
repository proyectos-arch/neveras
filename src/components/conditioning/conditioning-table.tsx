'use client';

import * as React from 'react';
import type { GelPack, UserProfile } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Check, Loader2, Trash2, Bell, ArrowRight } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useCurrentTime } from '@/context/DebugTimeContext';
import { getNextStep } from '@/lib/conditioning-logic';

export function ConditioningTable({
  gelPacks,
  userProfile
}: {
  gelPacks: GelPack[];
  userProfile: UserProfile | null;
}) {
  const { currentTime } = useCurrentTime();

  const packsRequiringAction = gelPacks.filter(pack => {
    const { needsAction } = getNextStep(pack, currentTime, userProfile);
    return needsAction;
  });

  const otherPacks = gelPacks.filter(pack => {
    const { needsAction } = getNextStep(pack, currentTime, userProfile);
    return !needsAction;
  });

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="text-primary"/>
            Packs que Requieren Acción
          </CardTitle>
          <CardDescription>
            Estos packs han completado su tiempo y necesitan ser movidos al siguiente paso. Escanéalos para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial</TableHead>
                <TableHead>Siguiente Paso Recomendado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packsRequiringAction.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    ¡Todo en orden! No hay acciones requeridas.
                  </TableCell>
                </TableRow>
              ) : (
                packsRequiringAction.map(pack => {
                  const { message } = getNextStep(pack, currentTime, userProfile);
                  return (
                    <TableRow key={pack.id} className="bg-green-500/10 hover:bg-green-500/20">
                      <TableCell className="font-medium">{pack.serial}</TableCell>
                      <TableCell className="font-semibold text-green-700">{message}</TableCell>
                      <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/gel-packs/${pack.id}`} className="flex items-center gap-1">
                                <span>Ver Pack</span>
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Historial General</CardTitle>
          <CardDescription>
            Estado y ubicación actual de todos los demás gel packs en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial</TableHead>
                <TableHead>Ubicación / Acción</TableHead>
                <TableHead className="text-right">Tiempo en Fase</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {otherPacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    No se encontraron gel packs.
                  </TableCell>
                </TableRow>
              ) : (
                otherPacks.map((pack) => <PackRow key={pack.id} pack={pack} />)
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PackRow({ pack }: { pack: GelPack }) {
  const [isLoading, setIsLoading] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { currentTime } = useCurrentTime();

  const handleUpdateStatus = async (newStatus: 'Por activar' | 'Discarded') => {
    if (!firestore) return;
    setIsLoading(true);
    try {
        const packRef = doc(firestore, 'gelPacks', pack.id);
        await updateDoc(packRef, { status: newStatus });
        toast({
            title: 'Estado Actualizado',
            description: `El gel pack ${pack.serial} ahora está ${newStatus === 'Discarded' ? 'descartado' : 'por activar'}.`
        });
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsLoading(false);
    }
  }

  const renderLocationOrAction = () => {
    if (pack.status === 'Conditioning' && pack.lastConditioningEvent) {
        return <Badge variant="default">{pack.lastConditioningEvent.chamberType}°C</Badge>
    }
    if (pack.status === 'Leaked Test') {
        return <Badge variant="outline">Leaked Test</Badge>
    }
    if (pack.status === 'Inspección') {
        return (
            <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => handleUpdateStatus('Discarded')} disabled={isLoading} title="Descartar pack">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive"/>}
                </Button>
                <Button size="sm" variant="success" onClick={() => handleUpdateStatus('Por activar')} disabled={isLoading} title="Aprobar pack">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}
                </Button>
            </div>
        )
    }
    return <Badge variant="secondary">{pack.status}</Badge>;
  }

  const toDate = (timestamp: any): Date | null => {
      if (!timestamp) return null;
      if (timestamp.toDate) return timestamp.toDate();
      if (typeof timestamp === 'string') return new Date(timestamp);
      return null;
  }

  const currentEvent = (pack.status === 'Conditioning' || pack.status === 'Leaked Test' || (pack.status === 'Ready' && pack.lastConditioningEvent && !pack.lastConditioningEvent.endTime))
      ? pack.lastConditioningEvent
      : null;
  const startTime = currentEvent ? toDate(currentEvent.startTime) : null;

  return (
      <TableRow key={pack.id}>
          <TableCell className="font-medium">
              <Link href={`/gel-packs/${pack.id}`} className="hover:underline">
                  {pack.serial}
              </Link>
          </TableCell>
          <TableCell>
              {renderLocationOrAction()}
          </TableCell>
          <TableCell className="text-right">
              {startTime ? (
                  <p className="text-sm text-muted-foreground">
                    {formatDistance(startTime, currentTime, { locale: es, addSuffix: true })}
                  </p>
              ) : '-'}
          </TableCell>
      </TableRow>
  );
}
