import { createFileRoute, Outlet } from '@tanstack/react-router';

/** Layout route for the /templates section. It only outlets to its children —
 *  the list (templates.index) and the builder (templates.$modelId) — so the two
 *  are sibling full-page views rather than one nesting inside the other. */
export const Route = createFileRoute('/templates')({
  component: () => <Outlet />,
});
