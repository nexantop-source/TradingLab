'use client';

import * as React from 'react';
import { Button, Callout, Card, Field, Input, Select, Textarea } from '@tl/ui';
import { apiFetch, ApiRequestError } from '@/lib/client-api';

const CATEGORIES = [
  { value: 'GENERAL', label: 'Consulta general' },
  { value: 'CUENTA', label: 'Mi cuenta' },
  { value: 'FACTURACION', label: 'Facturación y suscripción' },
  { value: 'CONTENIDO', label: 'Contenido educativo' },
  { value: 'ERROR', label: 'Un error en la plataforma' },
  { value: 'FRAUDE', label: 'Posible fraude o suplantación' },
];

export function SupportForm() {
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const data = new FormData(e.currentTarget);

    try {
      await apiFetch('/api/support', {
        method: 'POST',
        json: {
          subject: String(data.get('subject') ?? ''),
          body: String(data.get('body') ?? ''),
          category: String(data.get('category') ?? 'GENERAL'),
        },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se ha podido enviar tu mensaje.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Callout tone="success" title="Hemos recibido tu mensaje" className="mt-3">
        Te responderemos al correo asociado a tu cuenta. Si se trata de un posible fraude, revisamos estos casos
        con prioridad.
      </Callout>
    );
  }

  return (
    <Card className="mt-3 p-5">
      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Categoría" htmlFor="category" required>
          <Select id="category" name="category" defaultValue="GENERAL">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Asunto" htmlFor="subject" required>
          <Input id="subject" name="subject" required minLength={4} maxLength={140} />
        </Field>
        <Field
          label="Mensaje"
          htmlFor="body"
          hint="Cuanto más concreto seas, antes podremos ayudarte. No incluyas contraseñas ni datos de tarjeta."
          required
        >
          <Textarea id="body" name="body" required rows={5} minLength={10} maxLength={4000} />
        </Field>
        <Button type="submit" loading={loading}>
          Enviar mensaje
        </Button>
      </form>
    </Card>
  );
}
