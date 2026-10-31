// Where a newly uploaded photo goes in a type's gallery; the first photo is the cover everywhere.
const isStock = (url: string) => url.includes("images.unsplash.com");

export function withNewPhoto(images: string[], url: string): string[] {
  return images.length > 0 && images.every(isStock) ? [url, ...images] : [...images, url];
}
