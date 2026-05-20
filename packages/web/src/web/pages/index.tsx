import { useQuery } from "@tanstack/react-query";
import { useDesktop } from "../hooks/use-desktop";

async function fetchHealth(): Promise<{ status: string; db: string }> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

function Index() {
  // #157: replaced broken hono RPC api.health.$get() with plain fetch
  const health = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });
  const desktop = useDesktop();

  return (
    <div>
      <h1>Welcome</h1>
      <p>Platform: {desktop ? "Desktop" : "Web"}</p>
      <p>
        API Status:{" "}
        {health.isLoading
          ? "Loading..."
          : health.isError
            ? "Error"
            : health.data?.status}
      </p>
    </div>
  );
}

export default Index;
