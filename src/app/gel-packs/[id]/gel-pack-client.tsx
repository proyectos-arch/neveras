'use client';

import React from 'react';
import { notFound, useParams } from 'next/navigation';
import { TemperatureChart } from '@/components/gel-pack/temperature-chart';
import { ReadingsTable } from '@/components/gel-pack/readings-table';
import { AddReadingForm } from '@/components/gel-pack/add-reading-form';
import PredictiveAnalysis from '@/components/gel-pack/predictive-analysis';
import ReportSummary from '@/components/gel-pack/report-summary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Clock, Snowflake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { TEMP_LOWER_BOUND, TEMP_UPPER_BOUND } from '@/lib/constants';
import { ConditioningControls } from '@/components/gel-pack/conditioning-controls';
import type { GelPack, Reading } from '@/lib/types';
import { useUser, useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';

function getPackStatus(pack: GelPack, readings: Reading[]): {
  status: 'Normal' | 'Alerta' | 'Inactivo';
  variant: 'default' | 'destructive' | 'secondary';
  message: string;
} {
  if (!readings || readings.length === 0) {
    return { status: 'Inactivo', variant: 'secondary', message: 'Aún no hay lecturas.' };
  }
  const lastReading = readings[0]; // Asumiendo que las lecturas están ordenadas descendentemente
  if (lastReading.status === 'Alert') {
    return {
      status: 'Alerta',
      variant: 'destructive',
      message: `Última lectura fuera de rango (${lastReading.temperature.toFixed(1)}°C).`,
    };
  }
  return {
    status: 'Normal',
    variant: 'default',
    message: 'La temperatura está dentro del rango normal.',
  };
}

export function GelPackClient() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useUser();
  const firestore = useFirestore();

  const gelPackRef = useMemoFirebase(() => {
    if (!id || !firestore) return null;
    return doc(firestore, 'gelPacks', id);
  }, [id, firestore]);

  const readingsQuery = useMemoFirebase(() => {
    if (!gelPackRef) return null;
    return query(collection(gelPackRef, 'readings'), orderBy('timestamp', 'desc'));
  }, [gelPackRef]);

  const { data: gelPack, isLoading: isLoadingPack } = useDoc<GelPack>(gelPackRef);
  const { data: readings, isLoading: isLoadingReadings } = useCollection<Reading>(readingsQuery);
  
  if (!isLoadingPack && gelPack && user && gelPack.ownerId !== user.uid) {
    notFound();
  }

  if (isLoadingPack || isLoadingReadings || !gelPack) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Snowflake className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  const { status, variant, message } = getPackStatus(gelPack, readings || []);
  const lastReading = readings && readings.length > 0 ? readings[0] : null;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{gelPack.serial}</h1>
          <p className="text-muted-foreground">
            Modelo: {gelPack.model.toUpperCase()} | Volumen: {gelPack.volume}L | ID: <span className="font-mono">{gelPack.id}</span>
          </p>
        </div>
        <Badge variant={variant} className="text-sm self-start md:self-center">
          {status === 'Alerta' ? (
            <AlertTriangle className="mr-2 h-4 w-4" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          {status}
        </Badge>
      </header>
      <main className="grid flex-1 items-start gap-4 md:gap-8 lg:grid-cols-3">
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Estado Actual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-foreground">{message}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Última Lectura
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-foreground">
                  {lastReading ? `${lastReading.temperature.toFixed(1)}°C` : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                    {lastReading ? `hace ${formatDistanceToNow(new Date(lastReading.timestamp), { locale: es })}` : 'Aún no hay lecturas'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Rango Seguro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-foreground">
                  {TEMP_LOWER_BOUND}°C - {TEMP_UPPER_BOUND}°C
                </div>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tipo de Cámara
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-foreground">
                  {gelPack.chamberType}°C
                </div>
              </CardContent>
            </Card>
          </div>
          <TemperatureChart readings={readings || []} />
          <ReadingsTable readings={readings || []} />
        </div>
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-1">
          <ConditioningControls gelPack={gelPack} />
          <AddReadingForm gelPackId={gelPack.id} />
          <PredictiveAnalysis gelPack={gelPack} readings={readings || []} />
          <ReportSummary gelPack={gelPack} readings={readings || []} />
        </div>
      </main>
    </div>
  );
}
