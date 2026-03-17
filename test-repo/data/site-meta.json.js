// site-meta.json.js — generates site metadata via JS execution
export default async function (ctx) {
  const meta = {
    name: "Alex Developer",
    title: "Portfolio",
    description: "Building the future, one commit at a time",
    buildTime: new Date().toISOString(),
    version: "1.0.0",
    links: {
      github: "https://github.com/alexdev",
      twitter: "https://twitter.com/alexdev",
    },
  };
  return JSON.stringify(meta, null, 2);
}