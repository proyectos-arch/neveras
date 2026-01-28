'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import type { Assembly, GelPack } from '@/lib/types';
import { Package, QrCode, Loader2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeakerScanner } from './leaker-scanner';

interface AbrirCajasViewProps {
  assemblies: Assembly[];
}

export function AbrirCajasView({ assemblies }: AbrirCajasViewProps) {
  const [selectedAssembly, setSelectedAssembly] = React.useState<Assembly | null>(null);
  const [scannedGels, setScannedGels] = React.useState<GelPack[]>([]);
  const [leakerText, setLeakerText] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleAssemblySelect = async (assemblyId: string) => {
    const assembly = assemblies.find(a => a.id === assemblyId);
    if (assembly) {
      setSelectedAssembly(assembly);
      setScannedGels([]);
      setLeakerText('');
      
      // Cargar los gel packs asociados
      await loadGelPacks(assembly);
    }
  };

  const loadGelPacks = async (assembly: Assembly) => {
    if (!firestore) return;
    
    setIsLoading(true);
    try {
      // Cargar todos los geles en paralelo para mejor rendimiento
      const packPromises = assembly.gelPackIds.map(async (gelPackId) => {
        const packRef = doc(firestore, 'gelPacks', gelPackId);
        const packSnap = await getDoc(packRef);
        if (packSnap.exists()) {
          return { id: packSnap.id, ...packSnap.data() } as GelPack;
        }
        return null;
      });
      
      const results = await Promise.all(packPromises);
      const packs = results.filter((p): p is GelPack => p !== null);
      setScannedGels(packs);
    } catch (error) {
      console.error('Error loading gel packs:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los geles de la caja',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGelScanned = (gelPack: GelPack) => {
    // Verificar si el gel ya está en la lista de escaneados para Leaked Test
    const existingIndex = scannedGels.findIndex(g => g.id === gelPack.id);
    
    if (existingIndex >= 0) {
      // Actualizar el gel existente con el nuevo estado
      const updatedGels = [...scannedGels];
      updatedGels[existingIndex] = gelPack;
      setScannedGels(updatedGels);
    } else {
      // Agregar el nuevo gel
      setScannedGels(prev => [...prev, gelPack]);
    }
    
    // Actualizar el leaker text con los geles que pasaron a Leaked Test
    const allGelsInLeakedTest = [...scannedGels.filter(g => g.id !== gelPack.id && g.status === 'Leaked Test'), gelPack];
    setLeakerText(allGelsInLeakedTest.map(g => g.serial).join(', '));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      'In-Transit': { 
        variant: 'default', 
        icon: <Package className="h-3 w-3 mr-1" /> 
      },
      'Assembling': { 
        variant: 'secondary', 
        icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" /> 
      },
      'Returned': { 
        variant: 'outline', 
        icon: <CheckCircle2 className="h-3 w-3 mr-1" /> 
      },
      'Aborted': { 
        variant: 'destructive', 
        icon: <XCircle className="h-3 w-3 mr-1" /> 
      },
    };

    const config = variants[status] || { variant: 'outline' as const, icon: null };
    
    return (
      <Badge variant={config.variant} className="flex items-center w-fit">
        {config.icon}
        {status}
      </Badge>
    );
  };

  const handleRemoveGel = (gelId: string) => {
    const removedGel = scannedGels.find(g => g.id === gelId);
    setScannedGels(scannedGels.filter(g => g.id !== gelId));
    
    // Actualizar el leaker text
    const updatedGels = scannedGels.filter(g => g.id !== gelId);
    setLeakerText(updatedGels.map(g => g.serial).join(', '));
    
    if (removedGel) {
      toast({
        title: 'Gel eliminado',
        description: `Serial: ${removedGel.serial} removido de la lista`,
      });
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Panel Izquierdo: Selección de Caja */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Seleccionar Caja
          </CardTitle>
          <CardDescription>
            Selecciona una caja para gestionar sus geles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="box-select">Caja GTC</Label>
            <Select onValueChange={handleAssemblySelect}>
              <SelectTrigger id="box-select">
                <SelectValue placeholder="Selecciona una caja..." />
              </SelectTrigger>
              <SelectContent>
                {assemblies.map(assembly => (
                  <SelectItem key={assembly.id} value={assembly.id}>
                    {assembly.gtcSerial} - {assembly.chamberType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedAssembly && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Estado de la Caja</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedAssembly.status)}
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Serial GTC</Label>
                  <p className="font-mono text-sm">{selectedAssembly.gtcSerial}</p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Tipo de Cámara</Label>
                  <p className="text-sm">{selectedAssembly.chamberType}</p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Geles en la Caja</Label>
                  <p className="text-sm font-semibold">{selectedAssembly.gelPackIds.length} geles</p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Fecha de Creación</Label>
                  <p className="text-sm">{new Date(selectedAssembly.createdAt).toLocaleString('es-ES')}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Panel Derecho: Scanner y Leaker Text */}
      <div className="space-y-4">
        {selectedAssembly && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Escanear Geles
                </CardTitle>
                <CardDescription>
                  Escanea los códigos QR de los geles para verificar fugas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeakerScanner 
                  onGelScanned={handleGelScanned}
                  assembly={selectedAssembly}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leaked Test</CardTitle>
                <CardDescription>
                  Geles confirmados y pasados a Leaked Test
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="leaker-text">Seriales en Leaked Test</Label>
                  <Textarea
                    id="leaker-text"
                    value={leakerText}
                    onChange={(e) => setLeakerText(e.target.value)}
                    placeholder="Los seriales de geles confirmados aparecerán aquí..."
                    className="font-mono text-sm min-h-[100px]"
                    readOnly
                  />
                  <p className="text-xs text-muted-foreground">
                    {scannedGels.filter(g => g.status === 'Leaked Test').length} de {selectedAssembly.gelPackIds.length} gel(es) en Leaked Test
                  </p>
                </div>

                <Separator />

                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Geles de la Caja</Label>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : scannedGels.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No hay geles en la caja
                      </p>
                    ) : (
                      scannedGels.map(gel => (
                        <div 
                          key={gel.id} 
                          className={cn(
                            "flex items-center justify-between p-2 rounded-lg border transition-colors",
                            gel.status === 'Leaked Test' 
                              ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" 
                              : "bg-card hover:bg-accent/50"
                          )}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {gel.status === 'Leaked Test' && (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                              <p className="font-mono text-sm font-semibold">{gel.serial}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {gel.model.toUpperCase()} - {gel.volume}L
                            </p>
                          </div>
                          <Badge 
                            variant={gel.status === 'Leaked Test' ? 'default' : 'secondary'}
                            className={gel.status === 'Leaked Test' ? 'bg-green-600' : ''}
                          >
                            {gel.status}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )}

        {!selectedAssembly && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Selecciona una caja para comenzar a escanear geles
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
