
'use client';

import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider, useUser } from '@/firebase';
import { usePathname, redirect } from 'next/navigation';
import { Snowflake } from 'lucide-react';
import { DebugTimeProvider } from '@/context/DebugTimeContext';
import { TimeTravelClock } from '@/components/debug/time-travel-clock';

/*
// This is now a client component, so we can't use Metadata here.
// We can move it to a layout file that is a server component if needed.
export const metadata: Metadata = {
  title: 'Guardián de la Cadena de Frío',
  description: 'Monitorea y gestiona la temperatura de suministros médicos críticos.',
};
*/

function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Snowflake className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (isAuthPage) {
    if (user) {
      redirect('/');
    }
    return <>{children}</>;
  }
  
  if (!user) {
    redirect('/login');
  }

  return <AppShell>{children}</AppShell>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <head>
        <title>Guardián de la Cadena de Frío</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased h-full bg-background">
        <DebugTimeProvider>
          <FirebaseClientProvider>
            <AppLayout>{children}</AppLayout>
            <Toaster />
            {process.env.NODE_ENV === 'development' && <TimeTravelClock />}
          </FirebaseClientProvider>
        </DebugTimeProvider>
      </body>
    </html>
  );
}
