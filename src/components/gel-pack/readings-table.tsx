'use client';

import type { Reading } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

export function ReadingsTable({ readings }: { readings: Reading[] }) {
    const sortedReadings = [...readings].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Lecturas</CardTitle>
        <CardDescription>
          Un registro detallado de todas las lecturas de temperatura y ubicación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y Hora (UTC)</TableHead>
              <TableHead>Temperatura</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Ubicación (Lat, Lon)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedReadings.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">Aún no se han registrado lecturas.</TableCell>
                </TableRow>
            ) : sortedReadings.map((reading) => (
              <TableRow key={reading.id}>
                <TableCell>
                  {formatInTimeZone(new Date(reading.timestamp), 'UTC', 'd MMM, yyyy HH:mm:ss', { locale: es })}
                </TableCell>
                <TableCell>{reading.temperature.toFixed(1)}°C</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      reading.status === 'Alert' ? 'destructive' : 'default'
                    }
                  >
                    {reading.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {reading.location.latitude.toFixed(4)},{' '}
                  {reading.location.longitude.toFixed(4)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
