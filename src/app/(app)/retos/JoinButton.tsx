'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@tl/ui';
import { apiFetch } from '@/lib/client-api';

export function JoinButton({
  challengeId,
  joined,
  completed,
}: {
  challengeId: string;
  joined: boolean;
  completed: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  if (completed) {
    return (
      <Button size="sm" variant="ghost" disabled>
        Completado
      </Button>
    );
  }

  if (joined) {
    return (
      <Button size="sm" variant="ghost" disabled>
        Participando
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        await apiFetch('/api/challenges/join', { method: 'POST', json: { challengeId } }).catch(() => null);
        setLoading(false);
        router.refresh();
      }}
    >
      Participar
    </Button>
  );
}
