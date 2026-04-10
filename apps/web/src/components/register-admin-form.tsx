'use client';

import React, { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface RegisterAdminFormProps {
  onSubmit: (payload: {
    tenantName: string;
    email: string;
    password: string;
  }) => Promise<void>;
}

export function RegisterAdminForm({ onSubmit }: RegisterAdminFormProps) {
  const [tenantName, setTenantName] = useState('Acme Studio');
  const [email, setEmail] = useState('admin@acme.com');
  const [password, setPassword] = useState('Admin123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSubmit({ tenantName, email, password });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'No se pudo crear el tenant.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-6" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="tenantName" className="font-body text-xs font-bold uppercase tracking-widest text-foreground">Nombre del Tenant</Label>
        <Input
          id="tenantName"
          name="tenantName"
          value={tenantName}
          onChange={event => setTenantName(event.target.value)}
          required
          className="h-12 border-foreground/20 bg-transparent font-body text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
          placeholder="Mi Empresa"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email" className="font-body text-xs font-bold uppercase tracking-widest text-foreground">Email Administrativo</Label>
        <Input
          id="email"
          autoComplete="email"
          name="email"
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          required
          className="h-12 border-foreground/20 bg-transparent font-body text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
          placeholder="admin@empresa.com"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password" className="font-body text-xs font-bold uppercase tracking-widest text-foreground">Contraseña</Label>
        <Input
          id="password"
          autoComplete="new-password"
          name="password"
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          required
          className="h-12 border-foreground/20 bg-transparent font-body text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
          placeholder="••••••••"
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button 
        type="submit" 
        className="mt-2 h-12 w-full bg-primary font-body text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90" 
        disabled={loading}
      >
        {loading ? 'Creando...' : 'Crear Tenant y Admin'}
      </Button>
    </form>
  );
}
