import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card';

export const Route = createFileRoute('/')({ component: DecksPage });

function DecksPage() {
  const {
    data: decks,
    isPending,
    error,
  } = useQuery<string[]>({
    queryKey: ['decks'],
    queryFn: () => fetch('/api/anki/decks').then((r) => r.json()),
  });

  return (
    <div className="max-w-md mx-auto mt-16 space-y-4">
      <h1 className="text-2xl font-bold">Your Decks</h1>

      {isPending && <p className="text-muted-foreground">Loading decks…</p>}
      {error && <p className="text-destructive">Failed to load decks</p>}

      {decks?.map((name) => (
        <Card key={name}>
          <CardHeader>
            <CardTitle>{name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{name}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
