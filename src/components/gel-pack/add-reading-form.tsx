'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Thermometer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ReadingStatus } from '@/lib/types';
import { TEMP_LOWER_BOUND, TEMP_UPPER_BOUND } from '@/lib/constants';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const formSchema = z.object({
  temperature: z.coerce
    .number({ invalid_type_error: 'Debe ser un número' })
    .min(-50, 'Demasiado frío')
    .max(50, 'Demasiado caliente'),
});

type LocationState = {
  latitude: number;
  longitude: number;
} | null;

export function AddReadingForm({ gelPackId }: { gelPackId: string }) {
  const [location, setLocation] = React.useState<LocationState>(null);
  const [isLocating, setIsLocating] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      temperature: 4,
    },
  });

  const handleGetLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      toast({
        variant: 'destructive',
        title: 'Geolocalización no soportada',
        description: 'Tu navegador no soporta geolocalización.',
      });
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setIsLocating(false);
      },
      () => {
        toast({
          variant: 'destructive',
          title: 'No se pudo obtener la ubicación',
          description: 'Asegúrate de que los servicios de ubicación estén activados.',
        });
        setIsLocating(false);
      }
    );
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!location) {
      toast({
        variant: 'destructive',
        title: 'Ubicación requerida',
        description: 'Por favor, captura la ubicación actual antes de enviar.',
      });
      return;
    }
    if (!firestore) return;

    setIsSubmitting(true);
    try {
        const readingsCol = collection(firestore, 'gelPacks', gelPackId, 'readings');
        const readingStatus: ReadingStatus = values.temperature > TEMP_UPPER_BOUND || values.temperature < TEMP_LOWER_BOUND ? 'Alert' : 'Normal';
        
        await addDoc(readingsCol, {
            gelPackId,
            temperature: values.temperature,
            location,
            timestamp: serverTimestamp(),
            status: readingStatus
        });
        
        toast({
            title: 'Lectura Añadida',
            description: `Temperatura ${values.temperature}°C registrada.`,
            variant: readingStatus === 'Alert' ? 'destructive' : 'default',
        });
        form.reset({ temperature: 4 });
        setLocation(null);

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error al Añadir Lectura',
            description: error.message || 'Ocurrió un error inesperado.',
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Nueva Lectura</CardTitle>
        <CardDescription>
          Anota la temperatura y ubicación actual del gel pack.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="temperature"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temperatura (°C)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="number" step="0.1" className="pl-8" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
                <FormLabel>Ubicación</FormLabel>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGetLocation}
                    disabled={isLocating}
                >
                    {isLocating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                    <MapPin className="mr-2 h-4 w-4" />
                    )}
                    {location ? 'Capturar de Nuevo' : 'Obtener Ubicación Actual'}
                </Button>
                {location && (
                    <p className="text-sm text-muted-foreground text-center">
                    Lat: {location.latitude.toFixed(4)}, Lon: {location.longitude.toFixed(4)}
                    </p>
                )}
            </div>
            
            <Button type="submit" className="w-full" disabled={isSubmitting || !location}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Lectura
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
