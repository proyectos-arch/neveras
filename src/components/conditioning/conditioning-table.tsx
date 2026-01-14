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
import { Check, Loader2, Trash2, Bell, ArrowRight, Snowflake } from 'lucide-react';
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
    <div className="grid gap-6 w-full">
      <Card className="border-l-4 border-l-primary shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bell className="h-5 w-5 text-primary"/>
              </div>
              Packs que Requieren Acción
            </CardTitle>
            {packsRequiringAction.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {packsRequiringAction.length} pendiente{packsRequiringAction.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <CardDescription className="mt-1.5">
            Estos packs han completado su tiempo y necesitan ser movidos al siguiente paso.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Serial</TableHead>
                  <TableHead className="font-semibold">Siguiente Paso Recomendado</TableHead>
                  <TableHead className="text-right font-semibold">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packsRequiringAction.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-20 text-muted-foreground">
                      <div className="flex flex-col items-center gap-1">
                        <Check className="h-5 w-5 text-green-500" />
                        <span>¡Todo en orden! No hay acciones requeridas.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  packsRequiringAction.map(pack => {
                    const { message } = getNextStep(pack, currentTime, userProfile);
                    return (
                      <TableRow key={pack.id} className="bg-green-500/5 hover:bg-green-500/10 transition-colors">
                        <TableCell className="font-mono font-medium">{pack.serial}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {message}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild className="hover:bg-primary hover:text-primary-foreground transition-colors">
                            <Link href={`/gel-packs/${pack.id}`} className="flex items-center gap-1.5">
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
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Historial General</CardTitle>
            {otherPacks.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {otherPacks.length} gel pack{otherPacks.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <CardDescription className="mt-1.5">
            Estado y ubicación actual de todos los demás gel packs en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Serial</TableHead>
                  <TableHead className="font-semibold">Ubicación / Acción</TableHead>
                  <TableHead className="text-right font-semibold">Tiempo en Fase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherPacks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-20 text-muted-foreground">
                      <div className="flex flex-col items-center gap-1">
                        <Snowflake className="h-5 w-5" />
                        <span>No se encontraron gel packs. Añade uno para comenzar.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  otherPacks.map((pack) => <PackRow key={pack.id} pack={pack} />)
                )}
              </TableBody>
            </Table>
          </div>
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
                <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdateStatus('Por activar')} disabled={isLoading} title="Aprobar pack">
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
