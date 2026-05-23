import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { Hello } from '@nts/dtos';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card';
import { Button } from '#/components/ui/button';

export const Route = createFileRoute('/')({ component: App });

function App() {
  const { data, isPending, refetch, isFetching } = useQuery<Hello>({
    queryKey: ['hello'],
    queryFn: () => fetch('/api/hello').then((r) => r.json()),
  });

  return (
    <Card className="max-w-md mx-auto mt-16">
      <CardHeader>
        <CardTitle>nest-tanstack-template</CardTitle>
        <CardDescription>
          BE → DTOs → UI wired through Vite&apos;s <code>/api</code> proxy.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-lg">
          {isPending ? 'Loading…' : (data?.message ?? '—')}
        </p>
        <Button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Refetching…' : 'Refetch'}
        </Button>
      </CardContent>
    </Card>
  );
}
