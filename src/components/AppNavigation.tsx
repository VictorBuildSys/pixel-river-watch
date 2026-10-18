import { Link } from "@tanstack/react-router";
import { Activity, Satellite } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppNavigation() {
  return (
    <nav aria-label="Navegação principal" className="flex gap-1">
      <Button asChild variant="ghost" size="sm">
        <Link to="/" activeProps={{ className: "bg-accent text-primary" }} activeOptions={{ exact: true }}><Activity />Painel</Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link to="/globalsat" activeProps={{ className: "bg-accent text-primary" }}><Satellite />GlobalSat</Link>
      </Button>
    </nav>
  );
}