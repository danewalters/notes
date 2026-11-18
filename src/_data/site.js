export default {
  // The deploy workflow sets SITE_URL from the GitHub Pages address.
  url: (process.env.SITE_URL || "https://danewalters.github.io/notes").replace(/\/$/, ""),
  title: "Dane Wang",
  description: "Learning notes and bits of life from Dane Wang.",
  lang: "en",
  timeZone: "Asia/Shanghai", // Post dates are shown in this time zone.
  name: "Dane Wang",
  handle: "danewalters",
  bio: "Hey, I’m Dane.",
  avatar: "/assets/img/avatar.jpg",
  nav: [
    { name: "posts", path: "/posts/" },
    { name: "tags", path: "/tags/" },
    { name: "about", path: "/about/" },
  ],
  links: [{ name: "GitHub", icon: "github", url: "https://github.com/danewalters" }],
  backText: "Back",
  copyright: `© ${new Date().getFullYear()} Dane Wang`,
  notFoundText: "404 Not Found",
  notFoundLinkText: "« back to home »",
};
