import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import { modelQueries } from "@/lib/queries";
import { ChatInterface } from "@/features/chat";

export default async function Home() {
  const queryClient = getQueryClient();

  // Prefetch models data on the server
  await queryClient.prefetchQuery(modelQueries.list());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChatInterface />
    </HydrationBoundary>
  );
}
