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
import { Loader2, PlusCircle } from 'lucide-react';
import type { GelPack, GelPackModel, GelPackVolume, ChamberType } from '@/lib/types';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

const volumes: GelPackVolume[] = [4, 12, 28, 56, 96];

const formSchema = z.object({
  model: z.enum(['s4', 's22', 'm20']),
  volume: z.coerce.number().refine(val => volumes.includes(val as GelPackVolume), {
    message: "Volumen no válido."
  }),
});

const models: { value: GelPackModel, label: string }[] = [
    { value: 's4', label: 'S4 (Refrigerado)'},
    { value: 's22', label: 'S22 (Ambiente)'},
    { value: 'm20', label: 'M20 (Congelado)'},
]

export function AddGelPackDialog() {
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
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
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: 'Error de Autenticación', description: 'Debes iniciar sesión.' });
        return;
    }
    setIsSubmitting(true);
    
    try {
        let chamberType: ChamberType;
        switch (values.model) {
            case 's4': chamberType = '+2+8'; break;
            case 's22': chamberType = '+15+25'; break;
            case 'm20': chamberType = '-15-25'; break;
            default: throw new Error('Modelo no válido');
        }
        
        const gelPacksCol = collection(firestore, 'gelPacks');
        
        const q = query(gelPacksCol, where("ownerId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const packCount = querySnapshot.size;
        
        const sequentialId = (packCount + 1).toString().padStart(4, '0');
        const serial = `${values.model.toUpperCase()} ${values.volume}L ${sequentialId}`;

        const newDocRef = doc(gelPacksCol, serial.replace(/\s+/g, '-'));
        
        const baseUrl = 'https://studio--studio-1618913228-905ec.us-central1.hosted.app';
        const fullUrl = `${baseUrl}/gel-packs/${newDocRef.id}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}`;

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
            qrCodeUrl: qrApiUrl
        };

        await setDoc(newDocRef, { ...newPackData, createdAt: serverTimestamp() });
        
        toast({
            title: 'Gel Pack Creado',
            description: `Se ha creado el gel pack ${serial}. Ahora puedes imprimir su etiqueta desde la tabla.`,
        });

        form.reset();
        setOpen(false);

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error al Crear Gel Pack',
            description: error.message || 'Ocurrió un error inesperado.',
        });
    } finally {
        setIsSubmitting(false);
    }
  };


  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        form.reset();
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
      </DialogContent>
    </Dialog>
  );
}
