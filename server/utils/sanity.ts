import { createClient } from '@sanity/client'

export function getSanityClient() {
  const config = useRuntimeConfig()

  return createClient({
    projectId: config.sanityProjectId,
    dataset: config.sanityDataset,
    apiVersion: '2024-01-01',
    useCdn: process.env.NODE_ENV === 'production',
  })
}
