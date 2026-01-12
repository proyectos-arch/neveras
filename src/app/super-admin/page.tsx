'use client';

import { useMemo, useEffect } from 'react';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { collection, query } from 'firebase/firestore';
import { Snowflake, User as UserIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

export default function SuperAdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const isSuperAdmin = user?.email === 's_delrio91@hotmail.com';

  useEffect(() => {
    if (!isUserLoading && !isSuperAdmin) {
      router.push('/');
    }
  }, [isUserLoading, isSuperAdmin, router]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isSuperAdmin) return null;
    return query(collection(firestore, 'users'));
  }, [firestore, isSuperAdmin]);

  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  if (isUserLoading || isLoadingUsers || !isSuperAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Snowflake className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  const getInitials = (email?: string | null) => {
    if (!email) return 'U';
    return email[0].toUpperCase();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Portal de Super Admin</h1>
        <p className="text-muted-foreground">
          Gestiona usuarios y roles de la aplicación.
        </p>
      </header>
      <main className="flex flex-1 flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Usuarios Registrados</CardTitle>
            <CardDescription>Lista de todos los usuarios en el sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users && users.length > 0 ? (
                  users.map((u) => (
                    <TableRow key={u.userId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                           <Avatar>
                                <AvatarFallback>{getInitials(u.email)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">{u.displayName || 'Sin Nombre'}</p>
                                <p className="text-sm text-muted-foreground">{u.email}</p>
                            </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'super-admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Action buttons for role management will go here */}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      No se encontraron usuarios.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
