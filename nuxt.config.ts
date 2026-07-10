export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  runtimeConfig: {
    sanityProjectId: process.env.NUXT_SANITY_PROJECT_ID || 'nrzoplol',
    sanityDataset: process.env.NUXT_SANITY_DATASET || 'production',
  },
  app: {
    head: {
      title: 'Crows Are White',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#000000' }
      ]
    }
  }
})
