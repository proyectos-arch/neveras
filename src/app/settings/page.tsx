'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { UserProfile, ChamberType, UserRole } from '@/lib/types';
import { Snowflake } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';

const conditioningStepSchema = z.object({
  chamber: z.string().min(1, 'El nombre de la cámara es requerido.'),
  hours: z.coerce.number().min(0, 'Debe ser un valor positivo.'),
});

const settingsSchema = z.object({
  leakedTestHours: z.coerce.number().min(0, 'Debe ser un valor positivo.'),
  conditioningProfiles: z.object({
    s4: z.object({
      steps: z.array(conditioningStepSchema),
    }),
    s22: z.object({
      steps: z.array(conditioningStepSchema),
    }),
    m20: z.object({
      steps: z.array(conditioningStepSchema),
    }),
  }),
});

const defaultValues: z.infer<typeof settingsSchema> = {
  leakedTestHours: 24,
  conditioningProfiles: {
    s4: {
      steps: [
        { chamber: '-15-25', hours: 24 },
        { chamber: '+2+8', hours: 24 },
      ],
    },
    s22: {
      steps: [{ chamber: '+15+25', hours: 24 }],
    },
    m20: {
      steps: [
        { chamber: '-15-25', hours: 24 },
        { chamber: 'FRIDGE-30', hours: 72 },
      ],
    },
  },
};

const chamberOptions: (ChamberType | 'FRIDGE-30')[] = ['-15-25', '+2+8', '+15+25', 'FRIDGE-30'];

function ProfileForm({
  control,
  model,
}: {
  control: any;
  model: 's4' | 's22' | 'm20';
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `conditioningProfiles.${model}.steps`,
  });

  return (
    <div className="space-y-4">
      {fields.map((item, index) => (
        <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-end gap-2 p-3 border rounded-md">
          <FormField
            control={control}
            name={`conditioningProfiles.${model}.steps.${index}.chamber`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre de Cámara/Etapa</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una cámara" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {chamberOptions.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                 <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`conditioningProfiles.${model}.steps.${index}.hours`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Horas</FormLabel>
                <FormControl>
                  <Input type="number" className="w-24" {...field} />
                </FormControl>
                 <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(index)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
       <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ chamber: chamberOptions[0], hours: 24 })}
      >
        <PlusCircle className="mr-2 h-4 w-4" />
        Añadir Paso
      </Button>
    </div>
  );
}


export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const isSuperAdmin = user?.email === 's_delrio91@hotmail.com';

  const userProfileRef = useMemoFirebase(() => (user ? doc(firestore, `users/${user.uid}`) : null), [user, firestore]);
  const { data: userProfile, isLoading: isLoadingProfile } =
    useDoc<UserProfile>(userProfileRef);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  });

  useEffect(() => {
    if (isLoadingProfile) return;
    
    if (!isSuperAdmin) {
      router.push('/');
      return;
    }

    if (userProfile) {
        const formData: z.infer<typeof settingsSchema> = {
            leakedTestHours: userProfile.leakedTestHours ?? defaultValues.leakedTestHours,
            conditioningProfiles: {
                s4: userProfile.conditioningProfiles?.s4 ?? defaultValues.conditioningProfiles.s4,
                s22: userProfile.conditioningProfiles?.s22 ?? defaultValues.conditioningProfiles.s22,
                m20: userProfile.conditioningProfiles?.m20 ?? defaultValues.conditioningProfiles.m20,
            }
        };
        form.reset(formData);
    } else {
        form.reset(defaultValues);
    }
  }, [userProfile, form, isLoadingProfile, isSuperAdmin, router]);

  const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
    if (!user || !firestore || !isSuperAdmin) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Acción no permitida.',
      });
      return;
    }
    form.clearErrors(); // Clear previous errors before new submission
    
    try {
        const userDocRef = doc(firestore, 'users', user.uid);
        const currentRole = userProfile?.role || (isSuperAdmin ? 'super-admin' : 'operator');

        await setDoc(userDocRef, {
            ...values,
            // Ensure other user profile data is not overwritten
            email: user.email,
            userId: user.uid,
            displayName: user.displayName || null,
            role: currentRole
        }, { merge: true });

        toast({
            title: 'Configuración Guardada',
            description: 'Los perfiles de acondicionamiento han sido actualizados.',
        });
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error al Guardar',
            description: error.message || 'Ocurrió un error inesperado.',
        });
    }
  };
  
  if (isLoadingProfile || !isSuperAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Snowflake className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Define los parámetros globales para los procesos de la aplicación.
        </p>
      </header>
      <main className="flex flex-1 flex-col gap-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card className="max-w-4xl">
              <CardHeader>
                <CardTitle>Tiempos de Acondicionamiento</CardTitle>
                <CardDescription>
                  Define las horas requeridas para el test inicial y para cada perfil de gel pack.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="leakedTestHours"
                  render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel className="text-base">Leaked Test Inicial</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="ej. 24" {...field} />
                      </FormControl>
                      <FormDescription>Horas para la prueba de fugas inicial para todos los modelos.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="max-w-4xl">
                 <CardHeader>
                    <CardTitle>Perfiles de Acondicionamiento por Modelo</CardTitle>
                    <CardDescription>
                    Personaliza el flujo de acondicionamiento para cada tipo de gel pack.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Tabs defaultValue="s4">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="s4">S4 (Refrigerado)</TabsTrigger>
                            <TabsTrigger value="s22">S22 (Ambiente)</TabsTrigger>
                            <TabsTrigger value="m20">M20 (Congelado)</TabsTrigger>
                        </TabsList>
                        <TabsContent value="s4" className="pt-4">
                            <ProfileForm control={form.control} model="s4" />
                        </TabsContent>
                        <TabsContent value="s22" className="pt-4">
                            <ProfileForm control={form.control} model="s22" />
                        </TabsContent>
                        <TabsContent value="m20" className="pt-4">
                            <ProfileForm control={form.control} model="m20" />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
            
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
