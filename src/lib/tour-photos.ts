// Real interiors from The Gagrafa (the photos on the old thegagrafa.com Tour page), served from
// /public/tour. They give the Tour page a curated strip and its banner even before staff upload
// anything; residence, property and neighbourhood photos still come from the database.

export interface StripPhoto {
  src: string;
  alt: string;
  width?: number; // known for static files; unknown for uploads
  height?: number;
  caption?: string;
}

const photo = (name: string, alt: string, portrait = false): StripPhoto => ({
  src: `/tour/${name}.jpg`,
  alt,
  width: portrait ? 486 : 897,
  height: portrait ? 854 : 662,
});

export const TOUR_HERO: StripPhoto = photo(
  "penthouse-lounge",
  "A bright lounge with a crystal chandelier, terracotta armchairs and floor-to-ceiling windows"
);

// Landscape and portrait shots alternate so the strip has a rhythm.
export const INTERIOR_PHOTOS: StripPhoto[] = [
  photo("open-plan-living", "Open-plan living room with a cream sofa and a wood-panelled kitchen"),
  photo("bedroom", "Bedroom with a padded headboard, soft throws and full-height curtains", true),
  photo("dining-artwork", "Dining table set for two beneath a large abstract painting"),
  photo("lounge-navy", "Lounge with a navy sofa and a wall-mounted television", true),
  photo("kitchen", "Fitted kitchen with wood cabinets and black countertops"),
  photo("dining-nook", "Round dining table by a tall window with sheer curtains"),
  photo("dining-room", "Dining room with dark upholstered chairs and a patterned feature wall", true),
  photo("living-room", "Living room with a cream sofa, armchair and glass coffee table"),
  photo("lounge-artwork", "Lounge corner with modern artwork and a white sofa", true),
  photo("kitchen-dining", "White kitchen with a round dining table and four chairs"),
  photo("living-blue-artwork", "Lounge with a caramel sectional sofa and a large blue painting"),
  photo("bright-living", "Bright living room with a white sofa, ottoman and floor-length curtains"),
  TOUR_HERO,
];
