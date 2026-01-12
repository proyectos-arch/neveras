'use client';

import React from 'react';
import Image from 'next/image';
import type { GelPack } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PrintableStickerProps extends React.HTMLAttributes<HTMLDivElement> {
  gelPack: GelPack;
}

export const PrintableSticker = React.forwardRef<HTMLDivElement, PrintableStickerProps>(
  ({ gelPack, ...props }, ref) => {
    return (
      <div
        ref={ref}
        {...props}
        className={cn(
          'printable-sticker flex flex-col items-center justify-center p-4 border border-dashed border-gray-400 bg-white',
          props.className
        )}
      >
        <div className="text-center text-black">
          <h3 className="font-bold text-lg font-sans">{gelPack.serial}</h3>
          <p className="text-xs text-gray-600 font-sans">{gelPack.model.toUpperCase()} - {gelPack.volume}L</p>
        </div>
        <Image
          src={gelPack.qrCodeUrl}
          alt={`Código QR para ${gelPack.serial}`}
          width={150}
          height={150}
          unoptimized
          className="mt-2"
        />
        <p className="text-xs font-mono mt-2 break-all text-gray-800">{gelPack.id}</p>
      </div>
    );
  }
);

PrintableSticker.displayName = "PrintableSticker";
