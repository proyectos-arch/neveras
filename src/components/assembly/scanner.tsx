'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, QrCode, XCircle, CheckCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
} from "@/components/ui/alert-dialog"
import jsQR from 'jsqr';
import type { Assembly, GelPack, GTC } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface AssemblyScannerProps {
    assembly: Assembly;
    onPackScanned: (pack: GelPack) => void;
    onCompleteAssembly: () => void;
    scannedPackCount: number;
    isSubmitting: boolean;
}

export function AssemblyScanner({ assembly, onPackScanned, onCompleteAssembly, scannedPackCount, isSubmitting }: AssemblyScannerProps) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [hasCameraPermission, setHasCameraPermission] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [packToConfirm, setPackToConfirm] = React.useState<GelPack | null>(null);
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animationFrameId = React.useRef<number>();
  
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const handleScan = async (scannedData: string) => {
    setIsProcessing(true);
    let packId = scannedData;

    try {
        const url = new URL(scannedData);
        const pathParts = url.pathname.split('/');
        packId = pathParts.filter(p => p).pop() || '';
    } catch (e) {
        // Not a url, assume it's the ID
    }

    if (!firestore || !packId) {
        toast({ variant: 'destructive', title: 'Código Inválido', description: 'El código QR no contiene un ID de gel pack válido.'});
        setIsProcessing(false);
        return;
    };

    if (scannedPackCount >= 6) {
        toast({ variant: 'destructive', title: 'Ensamblaje Completo', description: 'Ya se han escaneado los 6 gel packs.'});
        setIsScanning(false);
        setIsProcessing(false);
        return;
    }

    const packRef = doc(firestore, 'gelPacks', packId);
    const gtcRef = doc(firestore, 'gtcs', assembly.gtcId);

    try {
        const [packDocSnap, gtcDocSnap] = await Promise.all([getDoc(packRef), getDoc(gtcRef)]);

        if (!packDocSnap.exists()) {
            throw new Error(`El gel pack con ID "${packId}" no fue encontrado.`);
        }
        if (!gtcDocSnap.exists()) {
            throw new Error(`La caja GTC con ID "${assembly.gtcId}" no fue encontrada.`);
        }
        
        const packData = { id: packDocSnap.id, ...packDocSnap.data() } as GelPack;
        const gtcData = gtcDocSnap.data() as GTC;
        
        if (packData.status !== 'Ready') {
            throw new Error(`El gel pack ${packData.serial} no está en estado "Ready". Su estado actual es "${packData.status}".`);
        }

        if (packData.volume !== gtcData.volume) {
            throw new Error(`Volumen incorrecto. Se escaneó un pack de ${packData.volume}L para una caja de ${gtcData.volume}L.`);
        }

        if (packData.chamberType !== assembly.chamberType) {
            throw new Error(`Tipo de gel incorrecto. Se esperaba un pack para ${assembly.chamberType}°C y se escaneó uno para ${packData.chamberType}°C.`);
        }
        
        setPackToConfirm(packData);

    } catch (error: any) {
         toast({
            variant: 'destructive',
            title: 'Error de Validación',
            description: error.message,
        });
        setTimeout(() => setIsProcessing(false), 2000);
    }
  };
  
  const confirmAddPack = () => {
    if (!packToConfirm) return;
    onPackScanned(packToConfirm);
    setPackToConfirm(null);
    setTimeout(() => setIsProcessing(false), 500); // Allow UI to update before next scan
  };
  
  const cancelAddPack = () => {
    setPackToConfirm(null);
    setIsProcessing(false);
  }

  const tick = () => {
    if (isProcessing || packToConfirm) {
        animationFrameId.current = requestAnimationFrame(tick);
        return;
    };
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
        });
      }
    };

    const stopScan = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
        if(animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }

    if (isScanning) {
        startScan();
    } else {
        stopScan();
    }

    return () => stopScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning, toast, isProcessing, packToConfirm]);
  
  const isAssemblyComplete = scannedPackCount >= 6;
  const canComplete = isAssemblyComplete && (assembly.status === 'Assembling' || assembly.status === 'Aborted');

  return (
    <>
    <Card>
        <CardHeader>
            <CardTitle>Escanear Gel Packs</CardTitle>
            <CardDescription>
                Haz clic en "Iniciar Escáner" y apunta la cámara a los códigos QR.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="relative w-full aspect-video rounded-md bg-muted overflow-hidden flex items-center justify-center">
                <video ref={videoRef} className={cn("w-full h-full object-cover", !isScanning && 'hidden')} autoPlay muted playsInline />
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
                    disabled={isAssemblyComplete || !!packToConfirm || isProcessing || isSubmitting}
                >
                    {isScanning ? <XCircle className="mr-2 h-4 w-4" /> : <QrCode className="mr-2 h-4 w-4" />}
                    {isScanning ? 'Detener Escáner' : 'Iniciar Escáner'}
            </Button>

           <Button 
                onClick={onCompleteAssembly}
                className="w-full"
                variant="success"
                disabled={!canComplete || isProcessing || isSubmitting}
            >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
                Completar Ensamblaje
            </Button>
        </CardContent>
    </Card>
    
    <AlertDialog open={!!packToConfirm} onOpenChange={(isOpen) => !isOpen && cancelAddPack()}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Gel Pack</AlertDialogTitle>
            <AlertDialogDescription>
                ¿Deseas añadir el gel pack <strong>{packToConfirm?.serial}</strong> a este ensamblaje?
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelAddPack}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAddPack}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
