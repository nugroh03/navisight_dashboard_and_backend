import { useState, useEffect } from "react";

export interface Port {
  id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePortData {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface UpdatePortData {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
}

export function usePorts() {
  const [ports, setPorts] = useState<Port[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPorts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ports");
      if (!res.ok) {
        throw new Error("Failed to fetch ports");
      }
      const data = await res.json();
      setPorts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const createPort = async (data: CreatePortData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create port");
      }
      const newPort = await res.json();
      setPorts((prev) => [newPort, ...prev]);
      return newPort;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updatePort = async (id: string, data: UpdatePortData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ports/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update port");
      }
      const updatedPort = await res.json();
      setPorts((prev) => prev.map((p) => (p.id === id ? updatedPort : p)));
      return updatedPort;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deletePort = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ports/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete port");
      }
      setPorts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPorts();
  }, []);

  return {
    ports,
    loading,
    error,
    fetchPorts,
    createPort,
    updatePort,
    deletePort,
  };
}
