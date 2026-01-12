'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import type { Reading } from '@/lib/types';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { TEMP_LOWER_BOUND, TEMP_UPPER_BOUND } from '@/lib/constants';

const chartConfig = {
  temperature: {
    label: 'Temperatura (°C)',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export function TemperatureChart({ readings }: { readings: Reading[] }) {
  const chartData = readings.map((r) => ({
    time: new Date(r.timestamp),
    temperature: r.temperature,
  }));

  if (readings.length === 0) {
    return (
       <Card>
        <CardHeader>
          <CardTitle>Historial de Temperatura</CardTitle>
          <CardDescription>
            Una línea de tiempo de las lecturas de temperatura para este gel pack.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">Aún no hay datos de temperatura disponibles.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Temperatura</CardTitle>
        <CardDescription>
          Una línea de tiempo de las lecturas de temperatura para este gel pack.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-80 w-full">
          <LineChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={(tick) => formatInTimeZone(tick, 'UTC', 'HH:mm')}
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
            />
            <YAxis
              domain={['dataMin - 2', 'dataMax + 2']}
              tickFormatter={(tick) => `${tick}°C`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, props) => (
                    <div className="flex flex-col">
                      <span className="font-bold">
                        {formatInTimeZone(props.payload.time, 'UTC', 'd MMM, HH:mm', { locale: es })}
                      </span>
                      <span>
                        Temperatura: {Number(value).toFixed(1)}°C
                      </span>
                    </div>
                  )}
                />
              }
            />
            <ReferenceLine y={TEMP_UPPER_BOUND} stroke="hsl(var(--accent))" strokeDasharray="3 3" />
            <ReferenceLine y={TEMP_LOWER_BOUND} stroke="hsl(var(--accent))" strokeDasharray="3 3" />
            <Line
              dataKey="temperature"
              type="monotone"
              stroke="var(--color-temperature)"
              strokeWidth={2}
              dot={true}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
