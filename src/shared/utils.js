export const DEFAULT_TEMPLATE = "follow_up_{YYYY}_{MM}_{DD}_{HH}_{mm}";
export const DEFAULT_BEHAVIOR = "increment";

export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).replace(/\/$/, "").toLowerCase();
  } catch {
    return String(url ?? "").toLowerCase();
  }
}

export function renderTemplate(template) {
  const now = new Date();
  const replacements = {
    "{YYYY}": now.getFullYear(),
    "{MM}": String(now.getMonth() + 1).padStart(2, "0"),
    "{DD}": String(now.getDate()).padStart(2, "0"),
    "{HH}": String(now.getHours()).padStart(2, "0"),
    "{mm}": String(now.getMinutes()).padStart(2, "0")
  };

  let result = template;
  for (const key in replacements) {
    result = result.replaceAll(key, String(replacements[key]));
  }
  return result;
}

export function incrementName(base, existingNames) {
  if (!existingNames.includes(base)) return base;

  let i = 1;
  while (existingNames.includes(`${base}_${i}`)) {
    i++;
  }
  return `${base}_${i}`;
}
