'use client';

import * as React from 'react';
import type { GelPack, ChamberType, Assembly, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Thermometer, Snowflake, Package, Beaker, PackageCheck, TestTube, Bell } from 'lucide-react';
import { intervalToDuration } from 'date-fns';
import { useCurrentTime } from '@/context/DebugTimeContext';
import { cn } from '@/lib/utils';
import { getNextStep } from '@/lib/conditioning-logic';

interface ChamberViewProps {
  chamberType: ChamberType | 'other' | 'inspection' | 'in-transit' | 'leaked-test';
  gelPacks: GelPack[];
  assemblies?: Assembly[];
  userProfile?: UserProfile | null;
}

const chamberDetails = {
    '-15-25': { title: 'Cámara -15°C a -25°C', icon: Snowflake, description: 'Packs en acondicionamiento congelado.' },
    '+2+8': { title: 'Cámara +2°C a +8°C', icon: Thermometer, description: 'Packs en acondicionamiento refrigerado.' },
    '+15+25': { title: 'Cámara +15°C a +25°C', icon: Thermometer, description: 'Packs en acondicionamiento ambiente.' },
    'FRIDGE-30': { title: 'Fridge -30', icon: Snowflake, description: 'Packs M20 en acondicionamiento profundo.'},
    'leaked-test': { title: 'Leaked Test', icon: TestTube, description: 'Packs nuevos en prueba inicial de fugas.' },
    'inspection': { title: 'Área de Inspección', icon: Beaker, description: 'Packs devueltos en control de calidad.'},
    'in-transit': { title: 'Cajas en Tránsito', icon: PackageCheck, description: 'Cajas GTC actualmente en ruta.'},
    'other': { title: 'Almacén / Otros', icon: Package, description: 'Packs listos, por activar, o descartados.' }
}

const statusVariantMap: { [key in GelPack['status']]: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' } = {
    'Por activar': 'destructive',
    'Leaked Test': 'default',
    'Conditioning': 'default',
    'Ready': 'success',
    'In-Use': 'outline',
    'Inspección': 'default',
    'Discarded': 'secondary'
};

function toDate(timestamp: any): Date | null {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    return null;
}

const formatDuration = (start: Date, end: Date): string => {
    const duration = intervalToDuration({ start, end });
    const hours = (duration.days || 0) * 24 + (duration.hours || 0);
    const minutes = duration.minutes || 0;
    const seconds = duration.seconds || 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

function PackRow({ pack, userProfile, chamberType }: { pack: GelPack; userProfile?: UserProfile | null, chamberType: ChamberViewProps['chamberType'] }) {
    const { currentTime } = useCurrentTime();

    const startTime = React.useMemo(() => {
        if (pack.status === 'Conditioning' || pack.status === 'Leaked Test') {
            const event = pack.lastConditioningEvent;
            if (event && event.startTime) {
                return toDate(event.startTime);
            }
        }
        if (pack.status === 'Inspección') {
             const event = pack.lastConditioningEvent;
             if (event && event.endTime) {
                 return toDate(event.endTime);
             }
        }
        return toDate(pack.createdAt);
    }, [pack]);

    const getElapsedTime = React.useCallback(() => {
        if (!startTime) return '00:00:00';
        return formatDuration(startTime, currentTime);
    }, [startTime, currentTime]);
    
    const [elapsedTime, setElapsedTime] = React.useState(getElapsedTime);

    React.useEffect(() => {
        setElapsedTime(getElapsedTime());
        const intervalId = setInterval(() => {
            setElapsedTime(getElapsedTime());
        }, 1000); 

        return () => clearInterval(intervalId);
    }, [getElapsedTime, currentTime]);

    const { needsAction } = getNextStep(pack, currentTime, userProfile);
    
    const showBadge = chamberType !== 'leaked-test' && chamberType !== 'inspection';

    return (
        <tr className={cn("border-b last:border-b-0", needsAction && "bg-green-500/10 border-l-4 border-green-500")}>
            <td className={cn("py-2 pr-2", needsAction && "pl-2")}>
                 <Link href={`/gel-packs/${pack.id}`}>
                    <p className="font-semibold hover:underline">{pack.serial}</p>
                </Link>
            </td>
            {showBadge && (
                <td className="py-2 px-2 text-center">
                    <Badge variant={statusVariantMap[pack.status] || 'secondary'} className="whitespace-nowrap">
                        {pack.status}
                    </Badge>
                </td>
            )}
            <td className="py-2 pl-2 text-right flex items-center justify-end gap-2">
                {needsAction && <Bell className="h-4 w-4 text-green-600" />}
                <span className="font-mono text-sm text-muted-foreground">{elapsedTime}</span>
            </td>
        </tr>
    );
}

function TransitTimer({ assembly }: { assembly: Assembly }) {
    const { currentTime } = useCurrentTime();
    const startTime = toDate(assembly.transitStartTime);

    const getElapsedTime = React.useCallback(() => {
      if (!startTime) return '00:00:00';
        return formatDuration(startTime, currentTime);
    },[startTime, currentTime])
    
    const [elapsedTime, setElapsedTime] = React.useState(getElapsedTime);

    React.useEffect(() => {
        setElapsedTime(getElapsedTime());
        if (!startTime) return;
        const intervalId = setInterval(() => {
            setElapsedTime(getElapsedTime());
        }, 1000);

        return () => clearInterval(intervalId);
    }, [getElapsedTime]);
    
    return <span className="font-mono text-sm text-muted-foreground">{elapsedTime}</span>;
}

export function ChamberView({ chamberType, gelPacks, assemblies = [], userProfile }: ChamberViewProps) {
  const details = chamberDetails[chamberType as keyof typeof chamberDetails];
  const Icon = details.icon;
  const totalItems = chamberType === 'in-transit' ? assemblies.length : gelPacks.length;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
            <Icon className="h-6 w-6 text-primary" />
            <CardTitle>{details.title}</CardTitle>
            <Badge variant="secondary" className="ml-auto">{totalItems}</Badge>
        </div>
        <CardDescription>{details.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {totalItems === 0 ? (
          <div className="flex h-full min-h-[100px] items-center justify-center rounded-md border border-dashed">
            <p className="text-sm text-muted-foreground">
                {chamberType === 'in-transit' ? 'No hay cajas en tránsito.' : 'No hay packs aquí.'}
            </p>
          </div>
        ) : (
            <div className="space-y-4">
            {chamberType === 'in-transit' ? (
                assemblies.map(assembly => (
                    <div key={assembly.id} className="rounded-md border">
                        <div className="flex items-center justify-between p-3 border-b">
                             <Link href={`/assembly/${assembly.id}`}>
                                <p className="font-semibold hover:underline">{assembly.gtcSerial}</p>
                            </Link>
                            <TransitTimer assembly={assembly} />
                        </div>
                        <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            {gelPacks.filter(p => assembly.gelPackIds.includes(p.id)).map(pack => (
                                <Link key={pack.id} href={`/gel-packs/${pack.id}`} className="text-muted-foreground hover:text-primary truncate">
                                    {pack.serial}
                                </Link>
                            ))}
                        </div>
                    </div>
                ))
            ) : (
                <table className="w-full text-sm">
                    <tbody>
                    {gelPacks.map(pack => (
                        <PackRow key={pack.id} pack={pack} userProfile={userProfile} chamberType={chamberType} />
                    ))}
                    </tbody>
                </table>
            )}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
