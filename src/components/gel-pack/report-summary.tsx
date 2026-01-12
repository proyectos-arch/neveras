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
import { Loader2, FileText } from 'lucide-react';
import {
  generateReportSummary,
  type GenerateReportSummaryOutput,
} from '@/ai/flows/generate-report-summary';
import type { GelPack, Reading } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ReportSummary({ gelPack, readings }: { gelPack: GelPack, readings: Reading[] }) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<GenerateReportSummaryOutput | null>(
    null
  );
  const { toast } = useToast();

  const handleGenerateSummary = async () => {
    setLoading(true);
    setResult(null);

    if (readings.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No hay datos disponibles',
        description: 'No se puede generar un resumen sin lecturas.',
      });
      setLoading(false);
      return;
    }

    const reportData = readings
      .map(
        (r) =>
          `Timestamp: ${r.timestamp}, Temp: ${r.temperature}°C, Status: ${r.status}, Location: (${r.location.latitude.toFixed(4)}, ${r.location.longitude.toFixed(4)})`
      )
      .join('\n');

    try {
      const res = await generateReportSummary({ reportData });
      setResult(res);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Falló la Generación del Resumen',
        description: 'Ocurrió un error al generar el resumen.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen del Reporte con IA</CardTitle>
        <CardDescription>
          Genera un resumen conciso de todo el registro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result && (
          <ScrollArea className="h-40 w-full rounded-md border p-4">
            <p className="text-sm">{result.summary}</p>
          </ScrollArea>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleGenerateSummary}
          disabled={loading}
          className="w-full"
          variant="secondary"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-2 h-4 w-4" />
          )}
          Generar Resumen
        </Button>
      </CardFooter>
    </Card>
  );
}
