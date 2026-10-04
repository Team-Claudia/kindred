import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useStaticMap } from '@/lib/queries'
import { platform } from '@/platform'

/**
 * A small map of an appointment's location (task 4.5h, wireframe 23, ADR-017).
 * Shown only once the location was found on a map and the static-map function
 * returned an image; otherwise nothing, and the location stays as text above.
 * Tapping it opens directions in the phone's maps app.
 */
export function MapPreview({
  itemId,
  location,
  lat,
  lng,
}: {
  itemId: string
  location: string
  lat: number | null
  lng: number | null
}) {
  const { t } = useTranslation()
  const map = useStaticMap(itemId, lat, lng)
  const image = map.data ?? null
  const img = useRef<HTMLImageElement>(null)

  // The image lives in a blob URL for as long as it's on screen.
  useEffect(() => {
    if (!image || !img.current) return
    const url = platform.imageUrl(image)
    img.current.src = url.url
    return url.release
  }, [image])

  if (lat === null || lng === null || !image) return null

  return (
    <figure className="flex flex-col gap-1">
      <button
        type="button"
        className="block min-h-11 overflow-hidden rounded-xl border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={t('itemDetail.map', { location })}
        onClick={() => platform.openMaps({ lat, lng })}
      >
        <img ref={img} alt="" className="aspect-[2/1] w-full object-cover" />
      </button>
      <figcaption className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        <span>{t('itemDetail.mapCredit')}</span>
        <span>{t('itemDetail.mapAttribution')}</span>
      </figcaption>
    </figure>
  )
}
