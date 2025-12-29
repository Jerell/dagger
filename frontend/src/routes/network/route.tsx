import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/network")({
  component: RouteComponent,
});

// I haven't decided if I want to use this route component or not.
function RouteComponent() {
  return <Outlet />;
}
