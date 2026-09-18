export const easeOut = [0.22, 1, 0.36, 1]

export function floatAnim(delay = 0, distance = 10, duration = 4.8) {
  return {
    y: [0, -distance, 0],
    transition: {
      duration,
      delay,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  }
}
