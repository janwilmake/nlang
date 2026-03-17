// skills.json.js — generates structured data
export default async function (ctx) {
  const skills = [
    { name: "Rust", level: "Advanced", years: 3, icon: "🦀" },
    { name: "TypeScript", level: "Expert", years: 5, icon: "🔷" },
    { name: "Python", level: "Advanced", years: 4, icon: "🐍" },
    { name: "Go", level: "Intermediate", years: 2, icon: "🐹" },
  ];
  return JSON.stringify(skills, null, 2);
}