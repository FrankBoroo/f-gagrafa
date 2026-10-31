// Facts and photos of the building itself, shown on several public pages. Pure data, safe for client code.

export const APARTMENT_FALLBACK_IMAGE = "/photos/lounge.jpg";

// `position` keeps the subject in frame when a landscape photo is cropped for a tall phone screen.
export const HERO_SLIDES: { src: string; alt: string; position: string }[] = [
  {
    src: "/photos/hero-1.jpg",
    alt: "The Gagrafa's outdoor pool, lined with green stone, with sun loungers along one side",
    position: "50% 60%",
  },
  {
    src: "/photos/hero-4.jpg",
    alt: "The Gagrafa building seen from its forecourt, with a patterned brick panel up the facade",
    position: "42% 50%",
  },
  {
    src: "/photos/aerial.jpg",
    alt: "Aerial view of The Gagrafa above the rooftops of Community 20",
    position: "42% 50%",
  },
];

export const BUILDING_AMENITIES: { name: string; src: string; alt: string }[] = [
  { name: "Pool side", src: "/photos/pool.jpg", alt: "The pool with sun loungers beside it" },
  { name: "Gym", src: "/photos/gym.jpg", alt: "Treadmills and free weights by a tall window in the gym" },
  { name: "Lounge", src: "/photos/lounge.jpg", alt: "Lounge with terracotta armchairs, cream sofas and a large painting" },
];

export const ON_REQUEST = ["Breakfast", "Airport transfer"];
