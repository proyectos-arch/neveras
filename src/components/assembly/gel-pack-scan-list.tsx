'use client';

import type { GelPack } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Package, Ban } from 'lucide-react';
import { Badge } from '../ui/badge';

function GelPackItem({ gelPack, isReadOnly }: { gelPack: GelPack; isReadOnly?: boolean }) {
    const icon = isReadOnly 
        ? <Package className="h-6 w-6 text-muted-foreground" />
        : <CheckCircle2 className="h-6 w-6 text-green-600" />;

    const badgeColor = isReadOnly ? 'secondary' : 'bg-green-600';
    const textColor = isReadOnly ? 'text-muted-foreground' : 'text-green-800';
    const subTextColor = isReadOnly ? 'text-xs text-muted-foreground' : 'text-xs text-green-700';

    return (
        <div className={`flex items-center gap-4 rounded-lg border p-4 ${isReadOnly ? 'border-border' : 'border-green-500/50 bg-green-500/10'}`}>
            {icon}
            <div className="space-y-1">
                <p className={`font-semibold ${textColor}`}>{gelPack.serial}</p>
                <p className={subTextColor}>{gelPack.model.toUpperCase()} - {gelPack.volume}L</p>
            </div>
            <Badge className={`ml-auto ${badgeColor}`}>{isReadOnly ? gelPack.status : 'Ready'}</Badge>
        </div>
    )
}

function EmptySlot({ index }: { index: number }) {
    return (
        <div className="flex items-center gap-4 rounded-lg border border-dashed p-4">
            <Ban className="h-6 w-6 text-muted-foreground" />
            <div>
                <p className="font-semibold text-muted-foreground">Espacio Vacío #{index + 1}</p>
                <p className="text-xs text-muted-foreground">Esperando escaneo...</p>
            </div>
        </div>
    )
}

export function GelPackScanList({ scannedPacks, isReadOnly = false }: { scannedPacks: GelPack[]; isReadOnly?: boolean }) {
    const totalSlots = 6;
    const filledSlots = scannedPacks.length;

    const description = isReadOnly
        ? `Esta caja contiene ${filledSlots} gel pack(s).`
        : `Se han escaneado ${filledSlots} de ${totalSlots} gel packs necesarios.`;

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {isReadOnly ? 'Contenido de la Caja' : 'Gel Packs Escaneados'}
                </CardTitle>
                <CardDescription>
                    {description}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {Array.from({ length: Math.max(totalSlots, filledSlots) }).map((_, index) => {
                        const gelPack = scannedPacks[index];
                        if (gelPack) {
                            return <GelPackItem key={gelPack.id} gelPack={gelPack} isReadOnly={isReadOnly} />
                        }
                        if (!isReadOnly) {
                            return <EmptySlot key={index} index={index} />
                        }
                        return null; // Don't show empty slots in read-only mode if not all 6 are there for some reason
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
