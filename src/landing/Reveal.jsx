import { motion, useReducedMotion } from 'framer-motion'
import { easeOut } from './motion.js'

export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  amount = 0.18,
  ...rest
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount, margin: '0px 0px -48px 0px' }}
      transition={{ duration: 0.55, delay, ease: easeOut }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
