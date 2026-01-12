'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Home, PackageCheck, Snowflake, Thermometer, LogOut, LayoutGrid, Settings, ShieldCheck } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@/firebase';
import { useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 font-bold text-lg text-primary"
    >
      <Button
        variant="outline"
        size="icon"
        className="size-8 shrink-0 rounded-full bg-primary text-primary-foreground"
        aria-label="Home"
        asChild
      >
        <Snowflake className="size-4 fill-current" />
      </Button>
      <span className="group-data-[collapsible=icon]:hidden">
        Guardián de Frío
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  
  const isSuperAdmin = user?.email === 's_delrio91@hotmail.com';

  useEffect(() => {
    if (!isUserLoading && !user) {
      if (pathname !== '/login' && pathname !== '/signup') {
        router.push('/login');
      }
    }
  }, [user, isUserLoading, pathname, router]);

  const handleSignOut = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/login');
    }
  };
  
  const getInitials = (email?: string | null) => {
    if (!email) return 'U';
    return email[0].toUpperCase();
  }

  // If we are still checking for the user, we can show a global loader.
  // The logic in RootLayout handles the case where the user is not logged in.
  if (isUserLoading || !user) {
      return (
          <div className="flex h-screen w-screen items-center justify-center">
              <Snowflake className="h-12 w-12 animate-spin text-primary" />
          </div>
      )
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <Logo />
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/')}
                  tooltip={{ children: 'Acondicionamiento' }}
                >
                  <Link href="/">
                    <Thermometer />
                    <span>Acondicionamiento</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
               <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith('/assembly')}
                  tooltip={{ children: 'Ensamblaje' }}
                >
                  <Link href="/assembly">
                    <PackageCheck />
                    <span>Ensamblaje</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/inventory')}
                  tooltip={{ children: 'Inventario' }}
                >
                  <Link href="/inventory">
                    <LayoutGrid />
                    <span>Inventario</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
               {isSuperAdmin && (
                <>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/settings')}
                    tooltip={{ children: 'Configuración' }}
                  >
                    <Link href="/settings">
                      <Settings />
                      <span>Configuración</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/super-admin')}
                    tooltip={{ children: 'Super Admin' }}
                  >
                    <Link href="/super-admin">
                      <ShieldCheck />
                      <span>Super Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
                 <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleSignOut} tooltip={{children: "Cerrar Sesión"}}>
                        <LogOut />
                        <span>Cerrar Sesión</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex-1 bg-secondary/50">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-16 sm:px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="w-full"></div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="overflow-hidden rounded-full"
                  >
                    <Avatar>
                      <AvatarImage src={user.photoURL ?? ''} alt="Avatar de usuario" />
                      <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </header>
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
