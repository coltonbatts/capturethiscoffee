import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Capture This Coffee",
    short_name: "CTC Coffee",
    description: "On-set coffee orders, runners, and label printing.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3ea",
    theme_color: "#050505",
    icons: [
      {
        src: "/capture-this-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/capture-this-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
