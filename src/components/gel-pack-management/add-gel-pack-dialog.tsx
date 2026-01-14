'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Printer, CheckCircle } from 'lucide-react';
import type { GelPack, GelPackModel, GelPackVolume, ChamberType } from '@/lib/types';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import * as QRCode from 'qrcode';

const volumes: GelPackVolume[] = [4, 12, 28, 56, 96];

const formSchema = z.object({
  model: z.enum(['s4', 's22', 'm20']),
  volume: z.coerce.number().refine(val => volumes.includes(val as GelPackVolume), {
    message: "Volumen no válido."
  }),
});

const models: { value: GelPackModel, label: string }[] = [
  { value: 's4', label: 'S4 (Refrigerado)' },
  { value: 's22', label: 'S22 (Ambiente)' },
  { value: 'm20', label: 'M20 (Congelado)' },
]

interface CreatedGelPackInfo {
  serial: string;
  qrDataUrl: string;
  url: string;
}

export function AddGelPackDialog() {
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [createdPack, setCreatedPack] = React.useState<CreatedGelPackInfo | null>(null);
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      model: 's4',
      volume: 4,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log('onSubmit iniciado. Val:', values);

    if (!user || !firestore) {
      console.error('No user or firestore');
      toast({ variant: 'destructive', title: 'Error de Autenticación', description: 'Debes iniciar sesión.' });
      return;
    }

    // Verificación segura de la librería
    if (!QRCode || typeof QRCode.toDataURL !== 'function') {
      console.error('Librería QRCode no cargada correctamente:', QRCode);
      toast({ variant: 'destructive', title: 'Error Interno', description: 'Error al cargar módulo de QR.' });
      return;
    }

    setIsSubmitting(true);
    console.log('setIsSubmitting true');

    try {
      let chamberType: ChamberType;
      switch (values.model) {
        case 's4': chamberType = '+2+8'; break;
        case 's22': chamberType = '+15+25'; break;
        case 'm20': chamberType = '-15-25'; break;
        default: throw new Error('Modelo no válido');
      }

      const gelPacksCol = collection(firestore, 'gelPacks');

      console.log('Consultando packs existentes...');
      const q = query(gelPacksCol, where("ownerId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const packCount = querySnapshot.size;
      console.log('Packs encontrados:', packCount);

      const sequentialId = (packCount + 1).toString().padStart(4, '0');
      const serial = `${values.model.toUpperCase()} ${values.volume}L ${sequentialId}`;
      console.log('Nuevo serial:', serial);

      const newDocRef = doc(gelPacksCol, serial.replace(/\s+/g, '-'));

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://studio--studio-1618913228-905ec.us-central1.hosted.app';
      const fullUrl = `${baseUrl}/gel-packs/${newDocRef.id}`;

      console.log('Iniciando generación de QR para:', fullUrl);

      // Generar QR como imagen base64 con timeout de seguridad
      let qrDataUrl = '';
      try {
        // Promesa con timeout de 2 segundos
        const qrPromise = QRCode.toDataURL(fullUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });

        const timeoutPromise = new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error('QR Generation Timeout')), 2000);
        });

        qrDataUrl = await Promise.race([qrPromise, timeoutPromise]);
        console.log('QR generado exitosamente');
      } catch (qrError) {
        console.error('Error generando QR (usando fallback):', qrError);
        // Fallback a API pública si la librería falla
        qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}`;
      }

      const newPackData: Omit<GelPack, 'createdAt'> = {
        id: newDocRef.id,
        serial: serial,
        model: values.model,
        volume: values.volume as GelPackVolume,
        ownerId: user.uid,
        chamberType,
        status: 'Por activar' as const,
        conditioningHistory: [],
        lastConditioningEvent: null,
        qrCodeUrl: qrDataUrl
      };

      console.log('Guardando en Firestore...');
      await setDoc(newDocRef, { ...newPackData, createdAt: serverTimestamp() });
      console.log('Guardado exitoso');

      setCreatedPack({
        serial,
        qrDataUrl,
        url: fullUrl
      });

      setIsSubmitting(false);

      toast({
        title: 'Gel Pack Creado',
        description: `Se ha creado el gel pack ${serial}.`,
      });

      form.reset();

    } catch (error: any) {
      console.error('Error FATAL en onSubmit:', error);
      setIsSubmitting(false);
      toast({
        variant: 'destructive',
        title: 'Error al Crear Gel Pack',
        description: error.message || 'Ocurrió un error inesperado.',
      });
    }
  };

  const handlePrint = () => {
    if (!createdPack) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR - ${createdPack.serial}</title>
            <style>
              body { 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                height: 100vh; 
                margin: 0;
                font-family: Arial, sans-serif;
              }
              img { width: 200px; height: 200px; }
              h2 { margin-bottom: 10px; font-size: 18px; }
              p { margin-top: 5px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <h2>${createdPack.serial}</h2>
            <img src="${createdPack.qrDataUrl}" alt="QR Code" />
            <p>Escanea para ver detalles</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleClose = () => {
    setCreatedPack(null);
    setOpen(false);
  };


  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
      setCreatedPack(null);
    }
    setOpen(isOpen);
  }


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Nuevo Gel Pack
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {createdPack ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Gel Pack Creado
              </DialogTitle>
              <DialogDescription>
                Tu gel pack ha sido registrado exitosamente. Escanea o imprime el código QR.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-6 space-y-4">
              <div className="p-4 bg-white rounded-lg shadow-sm border">
                <img
                  src={createdPack.qrDataUrl}
                  alt={`QR Code para ${createdPack.serial}`}
                  className="w-48 h-48"
                />
              </div>
              <p className="font-semibold text-lg">{createdPack.serial}</p>
            </div>
            <DialogFooter className="flex gap-2 sm:justify-center">
              <Button variant="outline" onClick={handleClose}>
                Cerrar
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir QR
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Añadir Nuevo Gel Pack</DialogTitle>
              <DialogDescription>
                Registra un gel pack seleccionando su modelo y volumen. El ID se generará automáticamente.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {models.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="volume"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Volumen (L)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {volumes.map(v => <SelectItem key={v} value={String(v)}>{v}L</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Registrar Gel Pack
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
