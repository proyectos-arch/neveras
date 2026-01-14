'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, QrCode, Snowflake, Thermometer, TestTube, Check, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import jsQR from 'jsqr';
import { ChamberType, GelPack, UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useCurrentTime } from '@/context/DebugTimeContext';
import { getNextStep } from '@/lib/conditioning-logic';

const chamberTypes: { type: ChamberType | 'Leaked Test' | 'FRIDGE-30'; label: string; color: string, icon: React.ElementType }[] = [
  { type: '-15-25', label: 'Cámara -15°C a -25°C', color: 'bg-blue-500', icon: Thermometer },
  { type: '+2+8', label: 'Cámara +2°C a +8°C', color: 'bg-cyan-500', icon: Thermometer },
  { type: '+15+25', label: 'Cámara +15°C a +25°C', color: 'bg-amber-500', icon: Thermometer },
  { type: 'FRIDGE-30', label: 'Fridge -30', color: 'bg-indigo-500', icon: Thermometer },
  { type: 'Leaked Test', label: 'Leaked Test', color: 'bg-slate-500', icon: TestTube },
];

export function ScanButton() {
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);
  const [isChamberSelectorOpen, setIsChamberSelectorOpen] = React.useState(false);
  const [scannedPack, setScannedPack] = React.useState<GelPack | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animationFrameId = React.useRef<number>();
  
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { currentTime } = useCurrentTime();

  const userProfileRef = user ? doc(firestore, `users/${user.uid}`) : null;
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const handleScan = async (scannedData: string) => {
    setIsLoading(true);
    let packId = scannedData;

    try {
        const url = new URL(scannedData);
        const pathParts = url.pathname.split('/');
        packId = pathParts.filter(p => p).pop() || '';
    } catch (e) {
        // Not a valid URL, assume the data is the ID itself
    }
    
    if (!firestore) return;
    const packRef = doc(firestore, 'gelPacks', packId);

    try {
        const docSnap = await getDoc(packRef);
        if (!docSnap.exists()) {
            throw new Error("Gel pack no encontrado.");
        }
        
        const packData = { id: docSnap.id, ...docSnap.data() } as GelPack;
        
        setScannedPack(packData);
        setIsScannerOpen(false);
        setIsChamberSelectorOpen(true);

    } catch (error: any) {
         toast({
            variant: 'destructive',
            title: 'Error al Escanear',
            description: error.message,
        });
    } finally {
        setIsLoading(false);
    }
  };

  const tick = () => {
    if (isLoading || isChamberSelectorOpen) {
        if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
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
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            handleScan(code.data);
            return;
        }
      }
    }
    animationFrameId.current = requestAnimationFrame(tick);
  };
  
  React.useEffect(() => {
    let stream: MediaStream | null = null;
    const startScan = async () => {
      if (!isScannerOpen) return;
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
        setIsScannerOpen(false);
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

    if (isScannerOpen) {
        startScan();
    } else {
        stopScan();
    }

    return () => stopScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScannerOpen, toast, isLoading, isChamberSelectorOpen]);
  
  const handleChamberSelect = async (chamberOrStep: ChamberType | 'Leaked Test' | 'FRIDGE-30') => {
    if(!scannedPack || !firestore) return;

    setIsLoading(true);
    const packRef = doc(firestore, 'gelPacks', scannedPack.id);

    try {
        const now = new Date();
        const newEvent = { chamberType: chamberOrStep, startTime: now.toISOString(), endTime: undefined };
        
        const docSnap = await getDoc(packRef);
        const currentPackData = docSnap.data() as GelPack;
        let updatedHistory = currentPackData.conditioningHistory || [];
        
        const newStatus = chamberOrStep === 'Leaked Test' ? 'Leaked Test' : 'Conditioning';
        
        if (currentPackData.status === 'Conditioning' || currentPackData.status === 'Leaked Test') {
            const lastEventIndex = updatedHistory.length - 1;
            if (lastEventIndex >= 0 && !updatedHistory[lastEventIndex].endTime) {
                updatedHistory[lastEventIndex].endTime = now.toISOString();
            }
        }
        
        updatedHistory.push(newEvent);

        await updateDoc(packRef, {
            status: newStatus,
            conditioningHistory: updatedHistory,
            lastConditioningEvent: newEvent
        });

      toast({
        title: 'Movimiento Registrado',
        description: `El gel pack ${scannedPack.serial} está ahora en ${chamberOrStep}.`,
      });
      router.refresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar',
        description: error.message,
      });
    }
    setIsLoading(false);
    setIsChamberSelectorOpen(false);
    setScannedPack(null);
  };
  
  const handleEndConditioning = async () => {
    if(!scannedPack || !firestore) return;
    setIsLoading(true);
    const packRef = doc(firestore, 'gelPacks', scannedPack.id);
    try {
        const docSnap = await getDoc(packRef);
        const packData = docSnap.data() as GelPack;
        const history = packData.conditioningHistory || [];
        const lastEventIndex = history.length - 1;
        const now = new Date().toISOString();

        if (lastEventIndex >= 0 && !history[lastEventIndex].endTime) {
            const updatedHistory = [...history];
            updatedHistory[lastEventIndex].endTime = now;
            await updateDoc(packRef, {
                status: 'Ready',
                conditioningHistory: updatedHistory,
                lastConditioningEvent: updatedHistory[lastEventIndex]
            });
            toast({ title: 'Acondicionamiento Finalizado', description: `${packData.serial} ahora está en estado "Ready".` });
        } else {
            throw new Error("No hay un evento de acondicionamiento activo para finalizar.");
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
    setIsLoading(false);
    setIsChamberSelectorOpen(false);
    setScannedPack(null);
  };
  
  const handleInspectionDecision = async (newStatus: 'Por activar' | 'Discarded') => {
    if(!scannedPack || !firestore) return;
    setIsLoading(true);
    const packRef = doc(firestore, 'gelPacks', scannedPack.id);
    try {
        await updateDoc(packRef, { status: newStatus });
         toast({
            title: 'Estado Actualizado',
            description: `El pack ${scannedPack.serial} ahora está: ${newStatus}.`,
        });
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
     setIsLoading(false);
    setIsChamberSelectorOpen(false);
    setScannedPack(null);
  }

  const { needsAction, message } = scannedPack ? getNextStep(scannedPack, currentTime, userProfile) : { needsAction: false, message: '' };
  
  const getDialogDescription = () => {
    if (!scannedPack) return '';
    if (needsAction) {
        return message;
    }
    return `El pack ${scannedPack.serial} está en estado '${scannedPack.status}'. No requiere acción inmediata.`;
  }

  const chamberStepRegex = /Mover a (cámara|Fridge) ([\w\s°+\-]+)/;
  const match = message.match(chamberStepRegex);
  
  let nextChamberLabel: string | null = null;
  if(match) {
    nextChamberLabel = match[1] === 'Fridge' ? match[2] : `Cámara ${match[2]}`;
  }
  
  const nextChamber = nextChamberLabel ? chamberTypes.find(c => c.label === nextChamberLabel) : null;

  const renderActionButtons = () => {
    if (!scannedPack) return null;
    if (!needsAction) {
      return (
        <Alert>
          <AlertTitle>No se requiere acción</AlertTitle>
          <AlertDescription>{getDialogDescription()}</AlertDescription>
        </Alert>
      );
    }

    if (message.includes('Leaked Test')) {
        const leakTestChamber = chamberTypes.find(c => c.type === 'Leaked Test');
        if (!leakTestChamber) return null;
        return <ChamberButton chamber={leakTestChamber} onClick={() => handleChamberSelect('Leaked Test')} isLoading={isLoading} />;
    }
    
    if (nextChamber) {
        return <ChamberButton chamber={nextChamber} onClick={() => handleChamberSelect(nextChamber.type)} isLoading={isLoading} />;
    }

    if (message.includes('"Ready"')) {
        return (
            <Button onClick={handleEndConditioning} disabled={isLoading} variant="default" size="lg" className="h-24 text-xl bg-green-600 hover:bg-green-700">
                {isLoading ? <Loader2 className="h-8 w-8 animate-spin"/> : 'Finalizar y Marcar como "Ready"'}
            </Button>
        );
    }
    
    if (message.includes('Aprobar o descartar')) {
        return (
            <div className="grid grid-cols-2 gap-4">
                 <Button onClick={() => handleInspectionDecision('Discarded')} disabled={isLoading} variant="destructive" size="lg" className="h-24 text-xl">
                    {isLoading ? <Loader2 className="h-8 w-8 animate-spin"/> : <><Trash2 className="h-8 w-8 mr-2"/> Descartar</>}
                </Button>
                 <Button onClick={() => handleInspectionDecision('Por activar')} disabled={isLoading} variant="default" size="lg" className="h-24 text-xl bg-green-600 hover:bg-green-700">
                    {isLoading ? <Loader2 className="h-8 w-8 animate-spin"/> : <><Check className="h-8 w-8 mr-2"/> Aprobar</>}
                </Button>
            </div>
        );
    }

    return null;
  }

  return (
    <>
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogTrigger asChild>
          <Button>
            <QrCode className="mr-2 h-4 w-4" />
            Escanear
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escanear Código QR del Gel Pack</DialogTitle>
            <DialogDescription>
              Apunta tu cámara al código QR para iniciar o continuar el proceso de acondicionamiento.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center items-center">
              <div className="relative w-full aspect-video rounded-md bg-muted">
                <video ref={videoRef} className="w-full h-full" autoPlay muted playsInline />
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Loader2 className="h-10 w-10 animate-spin text-white" />
                    </div>
                )}
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          {!hasCameraPermission && isScannerOpen && (
              <Alert variant="destructive">
                  <AlertTitle>Se Requiere Acceso a la Cámara</AlertTitle>
                  <AlertDescription>
                  Por favor, permite el acceso a la cámara para usar esta función.
                  </AlertDescription>
              </Alert>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={isChamberSelectorOpen} onOpenChange={(open) => {
        if(!open) {
          setIsChamberSelectorOpen(false);
          setScannedPack(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
                Acción para: <span className="text-primary">{scannedPack?.serial}</span>
            </DialogTitle>
            <DialogDescription>
             {getDialogDescription()}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
              {renderActionButtons()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


function ChamberButton({ chamber, onClick, isLoading }: { chamber: { type: any, label: string, color: string, icon: React.ElementType }, onClick: () => void, isLoading: boolean }) {
    const Icon = chamber.icon;
    return (
         <button
            key={chamber.type}
            className={cn(
                'group relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg text-xl font-bold text-white shadow-lg transition-all hover:scale-105',
                chamber.color,
                isLoading && 'cursor-not-allowed opacity-50'
            )}
            onClick={onClick}
            disabled={isLoading}
            >
            {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
                <>
                <div className="z-10 flex items-center gap-4">
                    <Icon className="h-8 w-8" />
                    <span>{chamber.label}</span>
                </div>
                <div className="absolute inset-0 bg-black/10 opacity-0 transition-opacity group-hover:opacity-100" />
                </>
            )}
            </button>
    )
}

    
