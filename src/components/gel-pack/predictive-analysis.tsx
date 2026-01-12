'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, Zap, TriangleAlert, ShieldCheck } from 'lucide-react';
import {
  predictTemperatureDeviation,
  type PredictiveTemperatureDeviationOutput,
} from '@/ai/flows/predictive-temperature-deviation';
import type { GelPack, Reading } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TEMP_UPPER_BOUND } from '@/lib/constants';

export default function PredictiveAnalysis({ gelPack, readings }: { gelPack: GelPack, readings: Reading[] }) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] =
    React.useState<PredictiveTemperatureDeviationOutput | null>(null);
  const { toast } = useToast();

  const handleAnalysis = async () => {
    setLoading(true);
    setResult(null);

    if (readings.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Datos insuficientes',
        description:
          'Se requieren al menos dos lecturas de temperatura para el análisis predictivo.',
      });
      setLoading(false);
      return;
    }

    const historicalData = readings
      .map(
        (r) =>
          `Timestamp: ${r.timestamp}, Temp: ${r.temperature}°C`
      )
      .join('\n');

    const lastReading = readings[0]; // Asume que las lecturas están ordenadas descendentemente

    try {
      const res = await predictTemperatureDeviation({
        historicalTemperatureData: historicalData,
        threshold: TEMP_UPPER_BOUND, // También se puede usar el límite inferior
        currentTemperature: lastReading.temperature,
        location: `${lastReading.location.latitude}, ${lastReading.location.longitude}`,
      });
      setResult(res);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Análisis Fallido',
        description: 'Ocurrió un error al ejecutar el análisis.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis Predictivo</CardTitle>
        <CardDescription>
          Usa IA para predecir posibles desviaciones de temperatura.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result && (
          <Alert variant={result.predictedDeviation ? 'destructive' : 'default'}>
            {result.predictedDeviation ? (
                <TriangleAlert className="h-4 w-4" />
            ) : (
                <ShieldCheck className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.predictedDeviation
                ? 'Desviación Predicha'
                : 'No se Predicen Desviaciones'}
            </AlertTitle>
            <AlertDescription>
                <p className="font-semibold mt-2">Explicación:</p>
                <p>{result.explanation}</p>
                {result.predictedDeviation && (
                    <>
                     <p className="font-semibold mt-2">Acciones Sugeridas:</p>
                     <p>{result.suggestedActions}</p>
                    </>
                )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleAnalysis} disabled={loading} className="w-full">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-2 h-4 w-4" />
          )}
          Ejecutar Análisis
        </Button>
      </CardFooter>
    </Card>
  );
}
