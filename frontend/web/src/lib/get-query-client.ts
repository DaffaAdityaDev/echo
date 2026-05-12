import { QUERY_CONFIG } from '@/constants'
import { QueryClient, defaultShouldDehydrateQuery, isServer } from '@tanstack/react-query'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_CONFIG.STALE_TIME,
      },
      dehydrate: {
        // per default, only successful queries are dehydrated,
        // this can be changed here
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === QUERY_CONFIG.STATUS.PENDING,
      },
    },
  })
}


let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during hydration, or during transitions in the browser
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}
