export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

export async function compressImageFileToDataUrl(
  file: File,
  opts: { maxSize?: number; quality?: number } = {},
): Promise<string> {
  const maxSize = opts.maxSize ?? 1600
  const quality = opts.quality ?? 0.82

  // Non-images: fallback
  if (!file.type.startsWith('image/')) return await fileToDataUrl(file)

  const imgUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Не удалось загрузить изображение'))
      el.src = imgUrl
    })

    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    const scale = Math.min(1, maxSize / Math.max(w, h))
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) return await fileToDataUrl(file)
    ctx.drawImage(img, 0, 0, tw, th)

    // Prefer JPEG to reduce size (keep PNG if original is png with transparency concerns)
    const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const dataUrl = canvas.toDataURL(outType, outType === 'image/jpeg' ? quality : undefined)
    return dataUrl
  } finally {
    URL.revokeObjectURL(imgUrl)
  }
}

