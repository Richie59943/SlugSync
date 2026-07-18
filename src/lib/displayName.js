// Derives a display name/initials from the signed-in user's real email —
// never from hardcoded prototype data.

export function initialsFromEmail(email) {
  if (!email) return "?";
  const local = email.split("@")[0].replace(/[^a-zA-Z]/g, "");
  return (local.slice(0, 2) || email[0]).toUpperCase();
}

export function firstNameFromEmail(email) {
  if (!email) return "there";
  const local = email.split("@")[0].split(/[._-]/)[0].replace(/[^a-zA-Z]/g, "");
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
