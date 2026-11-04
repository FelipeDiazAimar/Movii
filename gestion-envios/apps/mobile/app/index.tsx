import { Redirect } from "expo-router";

import { useMovii } from "@/lib/movii-context";

export default function Index() {
  const { sesionLista, role } = useMovii();
  if (!sesionLista) return null;
  return <Redirect href={role ? "/(tabs)" : "/login"} />;
}
