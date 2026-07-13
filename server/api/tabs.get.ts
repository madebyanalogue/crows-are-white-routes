import { getSanityClient } from '../utils/sanity'

type SanityTab = {
  slug: string
  title: string
  infoTitle?: string
  infoDescription?: string
  gridColumns?: number
  items: Array<{
    _key: string
    mediaType: 'image' | 'video'
    link?: string
    caption?: string
    width?: number
    height?: number
    src?: string
    rolloverSrc?: string
    mediaWidth?: number
    mediaHeight?: number
  }>
}

export type TabMediaItem = {
  id: string
  type: 'image' | 'video'
  src: string
  rolloverSrc?: string
  href?: string
  caption?: string
  fullWidth: boolean
  halfWidth: boolean
  mediaWidth?: number
  mediaHeight?: number
  width: number
  height: number
}

export type Tab = {
  slug: string
  title: string
  infoTitle?: string
  infoDescription?: string
  gridColumns: 3 | 4
  items: TabMediaItem[]
}

const QUERY = `*[_type == "tab" && !(_id in path("drafts.**"))] | order(orderRank) {
  "slug": slug.current,
  title,
  infoTitle,
  infoDescription,
  gridColumns,
  items[] {
    _key,
    mediaType,
    link,
    caption,
    width,
    height,
    "src": select(
      mediaType == "image" => image.asset->url,
      mediaType == "video" => video.asset->url
    ),
    "rolloverSrc": rolloverImage.asset->url,
    "mediaWidth": select(
      mediaType == "image" => image.asset->metadata.dimensions.width,
      mediaType == "video" => video.asset->metadata.dimensions.width
    ),
    "mediaHeight": select(
      mediaType == "image" => image.asset->metadata.dimensions.height,
      mediaType == "video" => video.asset->metadata.dimensions.height
    )
  }
}`

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()

  if (!config.sanityProjectId || config.sanityProjectId === 'REPLACE_WITH_PROJECT_ID') {
    return [] as Tab[]
  }

  try {
    const client = getSanityClient()
    const tabs = await client.fetch<SanityTab[]>(QUERY)
    return tabs
      .filter((tab) => tab.slug && tab.title)
      .map((tab) => ({
        slug: tab.slug,
        title: tab.title,
        infoTitle: tab.infoTitle?.trim() || undefined,
        infoDescription: tab.infoDescription?.trim() || undefined,
        gridColumns: clampGridColumns(tab.gridColumns),
        items: (tab.items ?? [])
          .filter((item) => item.src && item.mediaType)
          .map((item) => {
            const width = Number(item.width)
            const fullWidth = width === 0
            const halfWidth = width === 4
            return {
              id: item._key,
              type: item.mediaType,
              src: item.src!,
              rolloverSrc: item.rolloverSrc || undefined,
              href: item.link || undefined,
              caption: item.caption || undefined,
              fullWidth,
              halfWidth,
              mediaWidth: item.mediaWidth || undefined,
              mediaHeight: item.mediaHeight || undefined,
              width: fullWidth || halfWidth ? 1 : clampSpan(item.width),
              height: fullWidth || halfWidth ? 1 : clampSpan(item.height),
            }
          }),
      }))
  } catch (error) {
    console.error('Failed to fetch tabs from Sanity:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch tabs from Sanity',
    })
  }
})

function clampSpan(value?: number) {
  const span = Number(value)
  if (!Number.isFinite(span)) return 1
  return Math.min(3, Math.max(1, Math.round(span)))
}

function clampGridColumns(value?: number): 3 | 4 {
  return Number(value) === 4 ? 4 : 3
}
