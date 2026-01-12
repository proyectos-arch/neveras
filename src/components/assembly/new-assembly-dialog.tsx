'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle } from 'lucide-react';
import type { Assembly, ChamberType, GTC } from '@/lib/types';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
  serial: z.string().min(1, 'El serial es requerido.'),
  volume: z.coerce.number().min(1, 'El volumen es requerido'),
  chamberType: z.enum(['+2+8', '+15+25', '-15-25', 'FRIDGE-30'], {
    required_error: 'Debes seleccionar un tipo de temperatura.',
  }),
});

const chamberTypeOptions: { value: ChamberType, label: string }[] = [
    { value: '+2+8', label: 'S4 - Refrigerado (+2°C a +8°C)' },
    { value: '+15+25', label: 'S22 - Ambiente (+15°C a +25°C)' },
    { value: '-15-25', label: 'M20 - Congelado (-15°C a -25°C)' },
];

export function NewAssemblyDialog() {
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      serial: '',
      volume: 4,
      chamberType: '+2+8',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: 'Error de Autenticación' });
        return;
    }
    setIsSubmitting(true);
    
    try {
        const gtcId = values.serial.replace(/\s+/g, '-').toUpperCase();
        const gtcRef = doc(firestore, 'gtcs', gtcId);
        const docSnap = await getDoc(gtcRef);

        if (!docSnap.exists()) {
            const newGtcData: Omit<GTC, 'createdAt' | 'status'> = {
                id: gtcId,
                serial: values.serial,
                volume: values.volume as GTC['volume'],
                ownerId: user.uid,
            };
            await setDoc(gtcRef, { ...newGtcData, createdAt: serverTimestamp(), status: 'Available' });
            toast({ title: 'GTC Registrado', description: `La caja ${values.serial} ha sido registrada.` });
        } else {
            const gtcData = docSnap.data() as GTC;
            if (gtcData.status !== 'Available') {
                throw new Error(`La caja GTC ${gtcData.serial} no está disponible (estado: ${gtcData.status}).`);
            }
        }
        
        // Create the new assembly document
        const assemblyRef = doc(collection(firestore, 'assemblies'));
        const newAssembly: Omit<Assembly, 'createdAt' | 'status'> = {
          id: assemblyRef.id,
          gtcId: gtcId,
          gtcSerial: values.serial,
          chamberType: values.chamberType as ChamberType,
          gelPackIds: [],
          ownerId: user.uid,
        };

        await setDoc(assemblyRef, { ...newAssembly, status: 'Assembling', createdAt: serverTimestamp() });
        
        toast({
            title: 'Listo para Ensamblar',
            description: 'Redirigiendo a la página de ensamblaje...',
        });
        
        form.reset();
        setOpen(false);

        router.push(`/assembly/${assemblyRef.id}`);

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error al Iniciar Ensamblaje',
            description: error.message || 'Ocurrió un error inesperado.',
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuevo Ensamblaje
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar Nuevo Ensamblaje</DialogTitle>
          <DialogDescription>
            Registra la caja GTC y define el tipo de temperatura para este viaje.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="serial"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial de la Caja GTC</FormLabel>
                  <FormControl>
                    <Input placeholder="GTC-4L-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value="4">4L</SelectItem>
                        <SelectItem value="12">12L</SelectItem>
                        <SelectItem value="28">28L</SelectItem>
                        <SelectItem value="56">56L</SelectItem>
                        <SelectItem value="96">96L</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                control={form.control}
                name="chamberType"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Tipo de Gel / Temperatura</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                        <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {chamberTypeOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar Ensamblaje
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
