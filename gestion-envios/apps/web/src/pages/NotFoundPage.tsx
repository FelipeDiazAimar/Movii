import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <h1 className="text-lg font-semibold text-gray-900">Página no encontrada</h1>
      <Link to="/envios">
        <Button variant="secondary">Volver al panel</Button>
      </Link>
    </div>
  );
}
