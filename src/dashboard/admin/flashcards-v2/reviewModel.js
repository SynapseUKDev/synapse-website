// Pure helpers shared by the admin screens.

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}
