import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";

export interface AgentFeature {
  id: string;
  name: string;
  description: string;
  locked: boolean;
}

export function useFeatures() {
  const [features, setFeatures] = useState<AgentFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get<AgentFeature[]>("/features")
      .then((data) => {
        if (active) {
          setFeatures(data || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load agent features:", err);
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    
    return () => {
      active = false;
    };
  }, []);

  return { features, isLoading };
}
