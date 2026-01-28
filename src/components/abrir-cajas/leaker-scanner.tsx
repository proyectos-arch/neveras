'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, XCircle, CheckCircle2, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import jsQR from 'jsqr';
import type { Assembly, GelPack, UserProfile } from '@/lib/types';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useCurrentTime } from '@/context/DebugTimeContext';
import { cn } from '@/lib/utils';

interface LeakerScannerProps {
  assembly: Assembly;
  onGelScanned: (gelPack: GelPack) => void;
}

const DEFAULT_LEAKED_TEST_HOURS = 24;

export function LeakerScanner({ assembly, onGelScanned }: LeakerScannerProps) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [hasCameraPermission, setHasCameraPermission] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [packToConfirm, setPackToConfirm] = React.useState<GelPack | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animationFrameId = React.useRef<number>();

  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { currentTime } = useCurrentTime();

  const userProfileRef = user && firestore ? doc(firestore, `users/${user.uid}`) : null;
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const leakedTestHours = userProfile?.leakedTestHours ?? DEFAULT_LEAKED_TEST_HOURS;

  const handleScan = async (scannedData: string) => {
    setIsProcessing(true);

    // Extraer ID del gel
    let gelPackId = scannedData;
    try {
      const url = new URL(scannedData);
      const pathParts = url.pathname.split('/');
      gelPackId = pathParts.filter(p => p).pop() || '';
    } catch (e) {
      // No es URL, usar el dato directamente
      if (scannedData.includes('/')) {
        const parts = scannedData.split('/');
        gelPackId = parts[parts.length - 1];
      }
    }

    if (!firestore || !gelPackId) {
      toast({
        variant: 'destructive',
        title: 'Código Inválido',
        description: 'El código QR no contiene un ID de gel pack válido.',
      });
      setIsProcessing(false);
      return;
    }

    try {
      const packRef = doc(firestore, 'gelPacks', gelPackId);
      const packSnap = await getDoc(packRef);

      if (!packSnap.exists()) {
        toast({
          variant: 'destructive',
          title: 'Gel No Encontrado',
          description: `El gel pack con ID "${gelPackId}" no fue encontrado.`,
        });
        setTimeout(() => setIsProcessing(false), 2000);
        return;
      }

      const gelPack = { id: packSnap.id, ...packSnap.data() } as GelPack;

      // Verificar si el gel pertenece a esta caja
      if (!assembly.gelPackIds.includes(gelPackId)) {
        toast({
          variant: 'destructive',
          title: 'Gel No Pertenece a Esta Caja',
          description: `El gel ${gelPack.serial} no está asignado a esta caja GTC`,
        });
        setTimeout(() => setIsProcessing(false), 2000);
        return;
      }

      // El gel pertenece a la caja - mostrar diálogo de confirmación
      setPackToConfirm(gelPack);

    } catch (error: any) {
      console.error('Error processing QR:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Error al procesar el código QR',
      });
      setTimeout(() => setIsProcessing(false), 2000);
    }
  };

  const confirmAddPack = async () => {
    if (!packToConfirm || !firestore) return;

    setIsSaving(true);

    try {
      const packRef = doc(firestore, 'gelPacks', packToConfirm.id);

      // Actualizar el estado del gel a "Leaked Test"
      await updateDoc(packRef, {
        status: 'Leaked Test',
        lastConditioningEvent: {
          startTime: currentTime.toISOString(),
          endTime: null,
          chamberType: 'Leaked Test',
        },
        updatedAt: serverTimestamp(),
      });

      toast({
        title: '✓ Gel Confirmado',
        description: `${packToConfirm.serial} pasado a Leaked Test (${leakedTestHours}h)`,
      });

      // Notificar al componente padre con el gel actualizado
      const updatedPack = {
        ...packToConfirm,
        status: 'Leaked Test' as const,
      };
      onGelScanned(updatedPack);

      setPackToConfirm(null);
      setIsSaving(false);
      setTimeout(() => setIsProcessing(false), 500);

    } catch (error) {
      console.error('Error updating gel:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el estado del gel',
      });
      setIsSaving(false);
    }
  };

  const cancelAddPack = () => {
    setPackToConfirm(null);
    setIsProcessing(false);
  };

  const tick = () => {
    if (isProcessing || packToConfirm) {
      animationFrameId.current = requestAnimationFrame(tick);
      return;
    }

    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code) {
          handleScan(code.data);
        }
      }
    }
    animationFrameId.current = requestAnimationFrame(tick);
  };

  // Efecto principal que inicia/detiene la cámara según isScanning
  React.useEffect(() => {
    let stream: MediaStream | null = null;

    const startScan = async () => {
      if (!isScanning) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          animationFrameId.current = requestAnimationFrame(tick);
        }
      } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        setHasCameraPermission(false);
        setIsScanning(false);
        toast({
          variant: 'destructive',
          title: 'Acceso a la Cámara Denegado',
          description: 'Permite el acceso a la cámara en tu navegador.',
        });
      }
    };

    const stopScan = () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    if (isScanning) {
      startScan();
    } else {
      stopScan();
    }

    return () => stopScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning, toast, isProcessing, packToConfirm]);

  return (
    <>
      <div className="space-y-4">
        <div className="relative w-full aspect-video rounded-md bg-muted overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            className={cn("w-full h-full object-cover", !isScanning && 'hidden')}
            autoPlay
            muted
            playsInline
          />
          {!isScanning && <QrCode className="h-16 w-16 text-muted-foreground" />}
          {isProcessing && !packToConfirm && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
          )}
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {!hasCameraPermission && isScanning && (
          <Alert variant="destructive">
            <AlertTitle>Se Requiere Acceso a la Cámara</AlertTitle>
            <AlertDescription>
              Permite el acceso a la cámara en tu navegador.
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={() => setIsScanning(prev => !prev)}
          className="w-full"
          variant={isScanning ? 'destructive' : 'default'}
          disabled={!!packToConfirm || isProcessing}
        >
          {isScanning ? <XCircle className="mr-2 h-4 w-4" /> : <QrCode className="mr-2 h-4 w-4" />}
          {isScanning ? 'Detener Escáner' : 'Iniciar Escáner'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Escanea el código QR del gel para pasarlo a Leaked Test
        </p>
      </div>

      {/* Diálogo de confirmación */}
      <AlertDialog open={!!packToConfirm} onOpenChange={(isOpen) => !isOpen && cancelAddPack()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Gel Detectado
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿El gel <strong>{packToConfirm?.serial}</strong> viene en buenas condiciones para pasar a Leaked Test?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {packToConfirm && (
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-muted-foreground">Serial:</div>
                <div className="font-mono font-bold">{packToConfirm.serial}</div>

                <div className="text-muted-foreground">Modelo:</div>
                <div className="font-semibold">{packToConfirm.model.toUpperCase()}</div>

                <div className="text-muted-foreground">Volumen:</div>
                <div>{packToConfirm.volume}L</div>

                <div className="text-muted-foreground">Estado Actual:</div>
                <div>{packToConfirm.status}</div>
              </div>

              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tiempo Leaked Test:</span>
                  <span className="text-lg font-bold text-primary">{leakedTestHours} horas</span>
                </div>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelAddPack} disabled={isSaving}>
              No / Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmAddPack} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Sí, Confirmar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
