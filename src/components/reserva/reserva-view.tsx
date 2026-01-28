'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { GelPack, UserProfile, ChamberType, GelPackVolume } from '@/lib/types';
import { 
  Clock, 
  Package, 
  Thermometer, 
  CalendarClock, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentTime } from '@/context/DebugTimeContext';
import { getCurrentStepDetails } from '@/lib/conditioning-logic';
import { add, differenceInHours, differenceInMinutes, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReservaViewProps {
  gelPacks: GelPack[];
}

type ChamberGroup = {
  chamberType: ChamberType;
  gels: GelPackWithTime[];
  readyCount: number;
  inProgressCount: number;
};

type GelPackWithTime = GelPack & {
  remainingHours: number;
  remainingMinutes: number;
  totalHours: number;
  progressPercent: number;
  estimatedReadyTime: Date;
  isReady: boolean;
};

const CHAMBER_LABELS: Record<ChamberType, string> = {
  '-15-25': 'Cámara -15°C a -25°C',
  '+2+8': 'Cámara +2°C a +8°C',
  '+15+25': 'Cámara +15°C a +25°C',
  'FRIDGE-30': 'Fridge -30°C',
};

const VOLUME_OPTIONS: GelPackVolume[] = [4, 12, 28, 56, 96];

export function ReservaView({ gelPacks }: ReservaViewProps) {
  const [selectedChamber, setSelectedChamber] = React.useState<ChamberType | null>(null);
  const [selectedVolume, setSelectedVolume] = React.useState<GelPackVolume | null>(null);
  const [requiredQuantity, setRequiredQuantity] = React.useState<number>(6);
  const [showReservaDialog, setShowReservaDialog] = React.useState(false);
  const [isReserving, setIsReserving] = React.useState(false);
  const [availableGels, setAvailableGels] = React.useState<GelPackWithTime[]>([]);
  const [estimatedWaitTime, setEstimatedWaitTime] = React.useState<string>('');

  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { currentTime } = useCurrentTime();

  const userProfileRef = user && firestore ? doc(firestore, `users/${user.uid}`) : null;
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  // Calcular tiempo restante para cada gel
  const gelsWithTime = React.useMemo(() => {
    return gelPacks.map(gel => {
      const stepDetails = getCurrentStepDetails(gel, userProfile);
      const lastEvent = gel.lastConditioningEvent;
      
      let remainingHours = 0;
      let remainingMinutes = 0;
      let totalHours = stepDetails?.hours || 24;
      let progressPercent = 0;
      let estimatedReadyTime = new Date();
      let isReady = false;

      if (lastEvent?.startTime && stepDetails) {
        const startTime = new Date(lastEvent.startTime);
        const endTime = add(startTime, { hours: stepDetails.hours });
        
        const totalMinutes = stepDetails.hours * 60;
        const elapsedMinutes = differenceInMinutes(currentTime, startTime);
        const remainingTotalMinutes = Math.max(0, totalMinutes - elapsedMinutes);
        
        remainingHours = Math.floor(remainingTotalMinutes / 60);
        remainingMinutes = remainingTotalMinutes % 60;
        progressPercent = Math.min(100, (elapsedMinutes / totalMinutes) * 100);
        estimatedReadyTime = endTime;
        isReady = remainingTotalMinutes <= 0;
      }

      return {
        ...gel,
        remainingHours,
        remainingMinutes,
        totalHours,
        progressPercent,
        estimatedReadyTime,
        isReady,
      } as GelPackWithTime;
    });
  }, [gelPacks, userProfile, currentTime]);

  // Agrupar geles por cámara
  const chamberGroups = React.useMemo(() => {
    const groups: Record<string, ChamberGroup> = {};
    
    gelsWithTime.forEach(gel => {
      const chamber = gel.chamberType;
      if (!groups[chamber]) {
        groups[chamber] = {
          chamberType: chamber,
          gels: [],
          readyCount: 0,
          inProgressCount: 0,
        };
      }
      groups[chamber].gels.push(gel);
      if (gel.isReady) {
        groups[chamber].readyCount++;
      } else {
        groups[chamber].inProgressCount++;
      }
    });
    
    return Object.values(groups);
  }, [gelsWithTime]);

  // Buscar disponibilidad
  const handleSearchAvailability = () => {
    if (!selectedChamber || !selectedVolume) {
      toast({
        title: 'Selecciona opciones',
        description: 'Debes seleccionar tipo de cámara y volumen',
        variant: 'destructive',
      });
      return;
    }

    // Filtrar geles que coincidan
    const matching = gelsWithTime.filter(
      gel => gel.chamberType === selectedChamber && gel.volume === selectedVolume
    );

    // Ordenar por tiempo restante (los más prontos primero)
    matching.sort((a, b) => a.estimatedReadyTime.getTime() - b.estimatedReadyTime.getTime());

    setAvailableGels(matching);

    // Calcular tiempo estimado de espera
    if (matching.length === 0) {
      setEstimatedWaitTime('No hay geles disponibles de este tipo');
    } else if (matching.length >= requiredQuantity) {
      const readyNow = matching.filter(g => g.isReady);
      if (readyNow.length >= requiredQuantity) {
        setEstimatedWaitTime('¡Disponible ahora!');
      } else {
        // Necesitamos esperar al gel #requiredQuantity
        const gelNeeded = matching[requiredQuantity - 1];
        if (gelNeeded.isReady) {
          setEstimatedWaitTime('¡Disponible ahora!');
        } else {
          const waitTime = formatDistanceToNow(gelNeeded.estimatedReadyTime, { 
            locale: es, 
            addSuffix: false 
          });
          setEstimatedWaitTime(`Espera aproximada: ${waitTime}`);
        }
      }
    } else {
      setEstimatedWaitTime(`Solo hay ${matching.length} geles. Necesitas ${requiredQuantity}`);
    }

    setShowReservaDialog(true);
  };

  const handleConfirmReserva = async () => {
    if (!firestore || !user) return;

    setIsReserving(true);

    try {
      // Crear la reserva
      const reservaRef = await addDoc(collection(firestore, 'reservas'), {
        userId: user.uid,
        userEmail: user.email,
        chamberType: selectedChamber,
        volume: selectedVolume,
        quantity: requiredQuantity,
        gelPackIds: availableGels.slice(0, requiredQuantity).map(g => g.id),
        status: 'pending',
        estimatedReadyTime: availableGels.length >= requiredQuantity 
          ? availableGels[requiredQuantity - 1].estimatedReadyTime.toISOString()
          : null,
        createdAt: serverTimestamp(),
      });

      toast({
        title: '✓ Reserva Creada',
        description: `Tu reserva ha sido registrada. ID: ${reservaRef.id.slice(0, 8)}`,
      });

      setShowReservaDialog(false);
      setSelectedChamber(null);
      setSelectedVolume(null);
      setAvailableGels([]);

    } catch (error) {
      console.error('Error creating reserva:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear la reserva',
        variant: 'destructive',
      });
    } finally {
      setIsReserving(false);
    }
  };

  const formatTimeRemaining = (hours: number, minutes: number) => {
    if (hours === 0 && minutes === 0) return 'Listo';
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Panel de búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Solicitar Reserva de Caja
          </CardTitle>
          <CardDescription>
            Selecciona el tipo de caja que necesitas y verificaremos la disponibilidad
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Tipo de Cámara</Label>
              <Select 
                value={selectedChamber || ''} 
                onValueChange={(v) => setSelectedChamber(v as ChamberType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHAMBER_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Volumen (Litros)</Label>
              <Select 
                value={selectedVolume?.toString() || ''} 
                onValueChange={(v) => setSelectedVolume(Number(v) as GelPackVolume)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {VOLUME_OPTIONS.map((vol) => (
                    <SelectItem key={vol} value={vol.toString()}>
                      {vol}L
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cantidad de Geles</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={requiredQuantity}
                onChange={(e) => setRequiredQuantity(Number(e.target.value))}
              />
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleSearchAvailability}
                className="w-full"
                disabled={!selectedChamber || !selectedVolume}
              >
                <Clock className="mr-2 h-4 w-4" />
                Consultar Disponibilidad
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vista de cámaras con geles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {chamberGroups.map((group) => (
          <Card key={group.chamberType} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Thermometer className="h-4 w-4" />
                  {group.chamberType}
                </CardTitle>
                <Badge variant={group.readyCount > 0 ? 'default' : 'secondary'}>
                  {group.gels.length} geles
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2 mb-3">
                <div className="flex items-center gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>{group.readyCount} listos</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  <span>{group.inProgressCount} en proceso</span>
                </div>
              </div>
              
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {group.gels.slice(0, 5).map((gel) => (
                    <div 
                      key={gel.id}
                      className={cn(
                        "p-2 rounded-lg border text-xs",
                        gel.isReady 
                          ? "bg-green-50 border-green-200 dark:bg-green-950/20" 
                          : "bg-muted/50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-semibold">{gel.serial}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {gel.volume}L
                        </Badge>
                      </div>
                      {gel.isReady ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Listo para usar</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Progress value={gel.progressPercent} className="h-1" />
                          <div className="flex justify-between text-muted-foreground">
                            <span>{gel.status}</span>
                            <span className="font-medium">
                              {formatTimeRemaining(gel.remainingHours, gel.remainingMinutes)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {group.gels.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      +{group.gels.length - 5} más...
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}

        {chamberGroups.length === 0 && (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No hay geles en proceso de acondicionamiento
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Diálogo de confirmación de reserva */}
      <Dialog open={showReservaDialog} onOpenChange={setShowReservaDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Disponibilidad de Geles
            </DialogTitle>
            <DialogDescription>
              Resultados para {CHAMBER_LABELS[selectedChamber!]} - {selectedVolume}L
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Resumen */}
            <div className={cn(
              "p-4 rounded-lg border",
              availableGels.filter(g => g.isReady).length >= requiredQuantity
                ? "bg-green-50 border-green-200 dark:bg-green-950/20"
                : "bg-amber-50 border-amber-200 dark:bg-amber-950/20"
            )}>
              <div className="flex items-center gap-3">
                {availableGels.filter(g => g.isReady).length >= requiredQuantity ? (
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-amber-600" />
                )}
                <div>
                  <p className="font-semibold text-lg">{estimatedWaitTime}</p>
                  <p className="text-sm text-muted-foreground">
                    {availableGels.filter(g => g.isReady).length} de {requiredQuantity} geles listos ahora
                  </p>
                </div>
              </div>
            </div>

            {/* Tabla de geles */}
            {availableGels.length > 0 && (
              <ScrollArea className="h-[250px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serial</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Tiempo Restante</TableHead>
                      <TableHead>Progreso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableGels.slice(0, requiredQuantity).map((gel, idx) => (
                      <TableRow 
                        key={gel.id}
                        className={gel.isReady ? 'bg-green-50/50 dark:bg-green-950/10' : ''}
                      >
                        <TableCell className="font-mono font-semibold">
                          {idx + 1}. {gel.serial}
                        </TableCell>
                        <TableCell>{gel.model.toUpperCase()}</TableCell>
                        <TableCell>
                          <Badge variant={gel.isReady ? 'default' : 'secondary'}>
                            {gel.isReady ? 'Listo' : gel.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {gel.isReady ? (
                            <span className="text-green-600 font-medium">✓ Disponible</span>
                          ) : (
                            formatTimeRemaining(gel.remainingHours, gel.remainingMinutes)
                          )}
                        </TableCell>
                        <TableCell className="w-[100px]">
                          <Progress value={gel.progressPercent} className="h-2" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            {availableGels.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay geles de este tipo en las cámaras</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReservaDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmReserva}
              disabled={isReserving || availableGels.length < requiredQuantity}
            >
              {isReserving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reservando...
                </>
              ) : (
                <>
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Confirmar Reserva
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
