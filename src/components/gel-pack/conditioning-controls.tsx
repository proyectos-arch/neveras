'use client';

import * as React from 'react';
import type { GelPack, ChamberType } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';


const chamberTypes: ChamberType[] = ['-15-25', '+2+8', '+15+25'];

export function ConditioningControls({
  gelPack,
}: {
  gelPack: GelPack;
}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleStartConditioning = async (chamberType: ChamberType) => {
    if (!firestore) return;
    setIsLoading(true);
    const docRef = doc(firestore, 'gelPacks', gelPack.id);
    
    try {
        const newEvent = { chamberType, startTime: new Date().toISOString(), endTime: null };
        await updateDoc(docRef, {
            status: 'Conditioning',
            conditioningHistory: arrayUnion(newEvent),
            lastConditioningEvent: newEvent
        });
        toast({ title: 'Acondicionamiento Iniciado' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
    setIsLoading(false);
  };

  const handleEndConditioning = async () => {
    if (!firestore) return;
    setIsLoading(true);
    const docRef = doc(firestore, 'gelPacks', gelPack.id);
    
    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error("Pack no encontrado");

        const packData = docSnap.data() as GelPack;
        const history = packData.conditioningHistory || [];
        const lastEventIndex = history.length - 1;
        
        if (lastEventIndex < 0 || history[lastEventIndex].endTime) {
            throw new Error('No se encontró un evento de acondicionamiento activo para finalizar.');
        }

        const updatedHistory = [...history];
        updatedHistory[lastEventIndex] = {
            ...updatedHistory[lastEventIndex],
            endTime: new Date().toISOString()
        };

        await updateDoc(docRef, {
            status: 'Ready',
            conditioningHistory: updatedHistory,
            lastConditioningEvent: updatedHistory[lastEventIndex]
        });
        toast({ title: 'Acondicionamiento Finalizado' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
    setIsLoading(false);
  };
  
  const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    return null;
  };

  const currentEvent = gelPack.status === 'Conditioning' ? gelPack.lastConditioningEvent : null;
  const startTime = currentEvent ? toDate(currentEvent.startTime) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Acondicionamiento</CardTitle>
            <CardDescription>Gestiona el estado del pack.</CardDescription>
          </div>
          <Badge variant={gelPack.status === 'Conditioning' ? 'default' : gelPack.status === 'Ready' ? 'outline' : 'secondary'}>
            {gelPack.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentEvent && startTime && (
          <div className="text-sm">
            <p>
              Actualmente en{' '}
              <span className="font-semibold">{currentEvent.chamberType}°C</span>
            </p>
            <p className="text-xs text-muted-foreground">
              desde hace{' '}
              {formatDistance(startTime, new Date(), { locale: es })}
            </p>
          </div>
        )}

        {gelPack.status === 'Conditioning' ? (
          <Button
            size="sm"
            variant="destructive"
            className="w-full"
            onClick={handleEndConditioning}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Finalizar Acondicionamiento
          </Button>
        ) : (
          <Select
            onValueChange={(value: ChamberType) => handleStartConditioning(value)}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Iniciar Acondicionamiento" />
            </SelectTrigger>
            <SelectContent>
              {chamberTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  Cámara {type}°C
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isLoading && gelPack.status !== 'Conditioning' && (
             <div className="flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Iniciando...
             </div>
        )}

        {gelPack.conditioningHistory && gelPack.conditioningHistory.length > 0 && (
            <Accordion type="single" collapsible>
            <AccordionItem value="item-1" className="border-b-0">
                <AccordionTrigger className="text-xs py-1 text-muted-foreground justify-start gap-1">
                    Ver Historial ({gelPack.conditioningHistory.length})
                </AccordionTrigger>
                <AccordionContent className="p-2 bg-muted/50 rounded-md">
                    <ul className="space-y-2">
                        {gelPack.conditioningHistory.slice().reverse().map((event, index) => {
                            const eventStartTime = toDate(event.startTime);
                            const eventEndTime = toDate(event.endTime);
                            return (
                                <li key={index} className="text-sm flex justify-between">
                                    <div>
                                    <span>Cámara <strong>{event.chamberType}°C</strong></span>
                                    {eventStartTime && eventEndTime && (
                                        <span> por <span className="font-mono text-xs">{formatDistance(eventEndTime, eventStartTime, {locale: es})}</span></span>
                                    )}
                                    </div>
                                    <span className="text-muted-foreground text-xs">{eventStartTime ? format(eventStartTime, 'dd/MM HH:mm', { locale: es }) : '...'}</span>
                                </li>
                            )
                        })}
                    </ul>
                </AccordionContent>
            </AccordionItem>
            </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
