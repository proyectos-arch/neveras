'use client';

import * as React from 'react';
import type { Assembly } from '@/lib/types';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format, intervalToDuration } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowRight, Loader2, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useCurrentTime } from '@/context/DebugTimeContext';

const statusVariantMap: { [key in Assembly['status']]: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' } = {
    'Assembling': 'outline',
    'In-Transit': 'default',
    'Returned': 'secondary',
    'Aborted': 'destructive',
};

const formatDuration = (start: Date, end: Date): string => {
    const duration = intervalToDuration({ start, end });
    const hours = (duration.days || 0) * 24 + (duration.hours || 0);
    const minutes = duration.minutes || 0;
    const seconds = duration.seconds || 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

function TransitTimer({ startTime }: { startTime: Date }) {
    const { currentTime } = useCurrentTime();

    const getElapsedTime = React.useCallback(() => {
        if (!startTime) return '00:00:00';
        return formatDuration(startTime, currentTime);
    }, [startTime, currentTime]);
    
    const [elapsedTime, setElapsedTime] = React.useState(getElapsedTime);

    React.useEffect(() => {
        setElapsedTime(getElapsedTime());
        const intervalId = setInterval(() => {
            setElapsedTime(getElapsedTime());
        }, 1000); 

        return () => clearInterval(intervalId);
    }, [getElapsedTime, currentTime]);

    return <span className="font-mono text-sm">{elapsedTime}</span>;
}


interface AssemblyTableProps {
  assemblies: Assembly[];
}

export function AssemblyTable({ assemblies }: AssemblyTableProps) {
  const [isSubmitting, setIsSubmitting] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [assemblyToDelete, setAssemblyToDelete] = React.useState<Assembly | null>(null);
  const firestore = useFirestore();
  const { toast } = useToast();

  const openDeleteDialog = (assembly: Assembly) => {
    setAssemblyToDelete(assembly);
    setDialogOpen(true);
  };

  const handleReturn = async (assembly: Assembly) => {
    if (!firestore || assembly.status !== 'In-Transit') return;
    setIsSubmitting(assembly.id);

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
            description: `La caja ${assembly.gtcSerial} ha sido marcada como devuelta.`,
        });
    } catch (error: any) {
         toast({
            variant: 'destructive',
            title: 'Error al Registrar Devolución',
            description: error.message || 'Ocurrió un error inesperado.',
        });
    } finally {
        setIsSubmitting(null);
    }
  };

  const handleDelete = async () => {
    if (!assemblyToDelete || !firestore) return;
    setIsSubmitting(assemblyToDelete.id);

    try {
      const assemblyRef = doc(firestore, 'assemblies', assemblyToDelete.id);
      await deleteDoc(assemblyRef);
      toast({
        title: 'Ensamblaje Eliminado',
        description: `El ensamblaje para la caja ${assemblyToDelete.gtcSerial} ha sido eliminado.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al Eliminar',
        description: error.message || 'Ocurrió un error inesperado.',
      });
    } finally {
      setIsSubmitting(null);
      setDialogOpen(false);
      setAssemblyToDelete(null);
    }
  };
  
  const toDate = (timestamp: any): Date | null => {
      if (!timestamp) return null;
      if (timestamp.toDate) return timestamp.toDate();
      if (typeof timestamp === 'string') return new Date(timestamp);
      return null;
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Historial de Ensamblajes</CardTitle>
        <CardDescription>
          Todos los ensamblajes registrados y su estado actual.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serial GTC</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Tiempo en Tránsito</TableHead>
              <TableHead>Gel Packs</TableHead>
              <TableHead>Fecha Creación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assemblies.length === 0 ? (
              <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                      Aún no has registrado ningún ensamblaje.
                  </TableCell>
              </TableRow>
            ) : assemblies.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
              .map((assembly) => {
              const variant = statusVariantMap[assembly.status] || 'secondary';
              
              const createdAtDate = toDate(assembly.createdAt);
              const transitStartDate = toDate(assembly.transitStartTime);
              const isProcessing = isSubmitting === assembly.id;

              return (
                <TableRow key={assembly.id} className={isProcessing ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{assembly.gtcSerial}</TableCell>
                  <TableCell>
                    <Badge variant={variant}>
                       {assembly.status}
                    </Badge>
                  </TableCell>
                   <TableCell>
                    {assembly.status === 'In-Transit' && transitStartDate ? (
                        <TransitTimer startTime={transitStartDate} />
                    ) : '-'}
                  </TableCell>
                  <TableCell>{assembly.gelPackIds.length} / 6</TableCell>
                  <TableCell>
                    {createdAtDate ? format(createdAtDate, 'd MMM, yyyy HH:mm', { locale: es }) : '...'}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {assembly.status === 'Aborted' && (
                       <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openDeleteDialog(assembly)}
                          disabled={isProcessing}
                          title="Eliminar Ensamblaje"
                        >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive" />}
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    )}
                    {assembly.status === 'In-Transit' && (
                       <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleReturn(assembly)}
                          disabled={isProcessing}
                          title="Marcar como Devuelto"
                        >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Undo2 className="h-4 w-4 text-primary"/>}
                        <span className="sr-only">Marcar como Devuelto</span>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/assembly/${assembly.id}`}>
                        <ArrowRight className="h-4 w-4" />
                        <span className="sr-only">Ver Detalles</span>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
     <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el ensamblaje para la caja{' '}
              <strong>{assemblyToDelete?.gtcSerial}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSubmitting === assemblyToDelete?.id} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting === assemblyToDelete?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
