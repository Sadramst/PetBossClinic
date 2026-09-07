import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pet Boss Clinic & Pet Shop',
    short_name: 'Pet Boss',
    description: 'Premier Veterinary Surgery, Dental & Luxury Pet Boutique in Tehran',
    start_url: '/',
    display: 'standalone',
    background_color: '#181a20',
    theme_color: '#c5a059',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
