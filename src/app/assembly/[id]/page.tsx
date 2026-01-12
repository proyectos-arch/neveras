'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import type { Assembly, GelPack } from '@/lib/types';
import { doc, onSnapshot, getDoc, writeBatch, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { Snowflake, Truck, Undo2, Timer } from 'lucide-react';
import { AssemblyScanner } from '@/components/assembly/scanner';
import { GelPackScanList } from '@/components/assembly/gel-pack-scan-list';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { formatDistance, intervalToDuration } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentTime } from '@/context/DebugTimeContext';

const formatDurationDisplay = (start: Date, end: Date): string => {
    const duration = intervalToDuration({ start, end });
    const hours = (duration.days || 0) * 24 + (duration.hours || 0);
    const minutes = duration.minutes || 0;
    const seconds = duration.seconds || 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

function TransitTimer({ startTime }: { startTime: Date }) {
    const { currentTime } = useCurrentTime();
    
    const getElapsedTime = useCallback(() => {
      if (!startTime) return '00:00:00';
      return formatDurationDisplay(startTime, currentTime);
    }, [startTime, currentTime]);
    
    const [elapsedTime, setElapsedTime] = useState(getElapsedTime);

    useEffect(() => {
        setElapsedTime(getElapsedTime());
        const intervalId = setInterval(() => {
            setElapsedTime(getElapsedTime());
        }, 1000); 

        return () => clearInterval(intervalId);
    }, [getElapsedTime, currentTime]);

    return <span className="font-mono text-3xl font-bold">{elapsedTime}</span>;
}

export default function AssemblyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [localScannedPacks, setLocalScannedPacks] = useState<GelPack[]>([]);
  const [assignedPacks, setAssignedPacks] = useState<GelPack[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAssemblyActiveRef = useRef(false);

  useEffect(() => {
    isAssemblyActiveRef.current = assembly?.status === 'Assembling';
  }, [assembly]);


  const handleReturn = useCallback(async () => {
    if (!firestore || !assembly || assembly.status !== 'In-Transit') return;
    setIsSubmitting(true);

    try {
        const batch = writeBatch(firestore);

        const assemblyDocRef = doc(firestore, 'assemblies', assembly.id);
        batch.update(assemblyDocRef, { 
            status: 'Returned',
            returnTime: serverTimestamp()
        });

        const gtcRef = doc(firestore, 'gtcs', assembly.gtcId);
        batch.update(gtcRef, { status: 'Available' });

        assembly.gelPackIds.forEach(packId => {
            const packRef = doc(firestore, 'gelPacks', packId);
            batch.update(packRef, { status: 'Inspección' });
        });

        await batch.commit();

        toast({
            title: 'Caja Devuelta',
            description: `La caja ${assembly.gtcSerial} ha sido marcada como devuelta. Los gel packs pasan a estado de inspección.`,
        });
    } catch (error: any) {
         toast({
            variant: 'destructive',
            title: 'Error al Registrar Devolución',
            description: error.message || 'Ocurrió un error inesperado.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }, [firestore, assembly, toast]);


  const handleCompleteAssembly = useCallback(async () => {
    if (!firestore || !assembly || localScannedPacks.length !== 6) return;

    setIsSubmitting(true);

    try {
        const batch = writeBatch(firestore);

        const assemblyDocRef = doc(firestore, 'assemblies', assembly.id);
        batch.update(assemblyDocRef, { 
            status: 'In-Transit',
            transitStartTime: serverTimestamp(),
            gelPackIds: localScannedPacks.map(p => p.id)
        });

        const gtcRef = doc(firestore, 'gtcs', assembly.gtcId);
        batch.update(gtcRef, { status: 'In-Transit' });

        localScannedPacks.forEach(pack => {
            const packRef = doc(firestore, 'gelPacks', pack.id);
            batch.update(packRef, { status: 'In-Use' });
        });

        await batch.commit();

        toast({
            title: 'Ensamblaje Completado y en Tránsito',
            description: `La caja ${assembly.gtcSerial} está ahora en tránsito.`,
        });

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error al Completar Ensamblaje',
            description: error.message || 'Ocurrió un error inesperado.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }, [firestore, assembly, localScannedPacks, toast]);
  
  const handleAddPack = (pack: GelPack) => {
    setLocalScannedPacks(prev => {
        if(prev.some(p => p.id === pack.id)) {
             toast({ variant: 'destructive', title: 'Gel Pack Duplicado', description: 'Este gel pack ya ha sido escaneado.' });
            return prev;
        }
        if (prev.length < 6) {
            toast({ title: 'Gel Pack Añadido', description: `Se ha añadido ${pack.serial} al ensamblaje.`});
            return [...prev, pack];
        }
        toast({ variant: 'destructive', title: 'Ensamblaje Completo', description: 'Ya se han escaneado los 6 gel packs necesarios.'});
        return prev;
    });
  }

  useEffect(() => {
    if (!id || !firestore || !user) return;

    setIsLoading(true);
    const assemblyDocRef = doc(firestore, 'assemblies', id);

    const unsubscribe = onSnapshot(assemblyDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Assembly;
        
        if (data.ownerId !== user.uid) {
           setAssembly(null);
           setIsLoading(false);
           return;
        }
        
        setAssembly(data);

        if ((data.status === 'In-Transit' || data.status === 'Returned') && data.gelPackIds && data.gelPackIds.length > 0) {
            const packsQuery = query(collection(firestore, 'gelPacks'), where('id', 'in', data.gelPackIds));
            const packsSnap = await getDocs(packsQuery);
            const packsData = packsSnap.docs.map(d => ({ id: d.id, ...d.data()}) as GelPack);
            setAssignedPacks(packsData);
        } else if (data.status === 'Aborted') {
            await updateDoc(doc(firestore, 'assemblies', data.id), { status: 'Assembling' });
        } else if (data.status === 'Assembling' && localScannedPacks.length === 0) {
            // This case is to prevent resetting the packs on every snapshot update
            // Only clear local state if it's empty, otherwise it's being actively worked on.
        }
      } else {
        setAssembly(null);
      }
      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching assembly:", error);
        setAssembly(null);
        setIsLoading(false);
    });

    return () => {
        unsubscribe();
        if (firestore && id && isAssemblyActiveRef.current) {
            const assemblyDocRef = doc(firestore, 'assemblies', id);
            // This now correctly references the state via a ref, avoiding dependency issues.
            // It will only run on unmount.
            getDoc(assemblyDocRef).then(docSnap => {
                if (docSnap.exists() && docSnap.data().status === 'Assembling') {
                    console.log(`Assembly ${id} aborted due to navigation.`);
                    updateDoc(assemblyDocRef, { status: 'Aborted' });
                }
            });
        }
    };
  }, [id, firestore, user]);


  if (isLoading) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Snowflake className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (!assembly) {
    return notFound();
  }
  
  const toDate = (timestamp: any): Date | null => {
      if (!timestamp) return null;
      if (timestamp.toDate) return timestamp.toDate();
      if (typeof timestamp === 'string') return new Date(timestamp);
      return null;
  }
  
  const getPageDescription = () => {
    switch (assembly.status) {
      case 'Assembling':
        return `Escanea los 6 gel packs requeridos para el tipo de cámara ${assembly.chamberType}°C para completar el ensamblaje.`;
      case 'In-Transit':
        return `Marca como devuelto al recibir la caja.`;
      case 'Returned':
          const transitStart = toDate(assembly.transitStartTime);
          const returnT = toDate(assembly.returnTime);
          if (!transitStart || !returnT) return 'Caja devuelta.';
          return `Caja devuelta. Duración total del viaje: ${formatDistance(returnT, transitStart, {locale: es})}.`;
      case 'Aborted':
          return 'Este ensamblaje fue abortado. Puedes reiniciarlo o eliminarlo.'
      default:
        return `Estado del ensamblaje: ${assembly.status}`;
    }
  }

  const isAssemblyActive = assembly.status === 'Assembling';
  const transitStartDate = toDate(assembly.transitStartTime);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">
            Ensamblaje: <span className="text-primary">{assembly.gtcSerial}</span>
            </h1>
            <p className="text-muted-foreground">
            {getPageDescription()}
            </p>
        </div>
        <div className="flex gap-2 self-start md:self-center">
            {assembly.status === 'In-Transit' && (
                <Button onClick={handleReturn} disabled={isSubmitting} variant="outline">
                    <Undo2 className="mr-2 h-4 w-4" />
                    Marcar como Devuelto
                </Button>
            )}
        </div>
      </header>
      <main className="grid flex-1 items-start gap-4 md:gap-8 lg:grid-cols-2">
        {assembly.status === 'In-Transit' && transitStartDate && (
            <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tiempo en Tránsito</CardTitle>
                    <Timer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <TransitTimer startTime={transitStartDate} />
                </CardContent>
            </Card>
        )}

        {isAssemblyActive ? (
            <div className="grid auto-rows-max items-start gap-4 md:gap-8">
                <AssemblyScanner 
                    assembly={assembly} 
                    onPackScanned={handleAddPack} 
                    onCompleteAssembly={handleCompleteAssembly}
                    scannedPackCount={localScannedPacks.length}
                    isSubmitting={isSubmitting}
                />
            </div>
        ) : null}
        <div className={`grid auto-rows-max items-start gap-4 md:gap-8 ${!isAssemblyActive ? 'lg:col-span-2' : ''}`}>
            <GelPackScanList scannedPacks={isAssemblyActive ? localScannedPacks : assignedPacks} isReadOnly={!isAssemblyActive} />
        </div>
      </main>
    </div>
  );
}
