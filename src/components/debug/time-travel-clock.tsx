'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentTime } from '@/context/DebugTimeContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Rewind, Forward } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function TimeTravelClock() {
  const { currentTime, addHours, resetTime } = useCurrentTime();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // This will only run on the client, after the component has mounted.
    setIsMounted(true);
  }, []);

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-2xl bg-background/80 backdrop-blur-sm">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5 text-primary" />
          <span>Simulador de Tiempo</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 text-center">
        <p className="text-lg font-bold font-mono h-6">
            {isMounted ? format(currentTime, 'd MMM yyyy, HH:mm:ss', { locale: es }) : '...'}
        </p>
        <p className="text-xs text-muted-foreground">
            (Tiempo simulado)
        </p>
        <div className="grid grid-cols-2 gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={() => addHours(1)}>+1 hr</Button>
            <Button size="sm" variant="outline" onClick={() => addHours(12)}>+12 hrs</Button>
            <Button size="sm" variant="outline" onClick={() => addHours(24)}>+24 hrs</Button>
            <Button size="sm" variant="outline" onClick={() => addHours(72)}>+72 hrs</Button>
        </div>
        <Button size="sm" variant="ghost" className="w-full mt-2" onClick={resetTime}>
          <Rewind className="mr-2 h-4 w-4" />
          Reiniciar a Tiempo Real
        </Button>
      </CardContent>
    </Card>
  );
}
