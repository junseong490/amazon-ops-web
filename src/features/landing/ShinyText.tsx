// ShinyText — framer-motion 기반 애니메이션 반짝임 그라디언트 텍스트(재사용 컴포넌트).
// 좌→우 연속 스윕(기본 3초 주기), base color #64CEFB, shine #ffffff, background-clip:text.
// 배경 그라디언트는 200% 크기의 주기 패턴이라 400% 이동 = 정확히 2주기 → 이음매 없이 반복된다.
// prefers-reduced-motion: reduce 에서는 애니메이션 없이 정적 그라디언트로 표시한다.
import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';

interface ShinyTextProps {
  children: ReactNode;
  className?: string;
  /** 스윕 한 바퀴 주기(초). 기본 3초. */
  duration?: number;
  /** 기본 텍스트 색(그라디언트 베이스). */
  baseColor?: string;
  /** 지나가는 하이라이트 색. */
  shineColor?: string;
}

export function ShinyText({
  children,
  className,
  duration = 3,
  baseColor = '#64CEFB',
  shineColor = '#ffffff',
}: ShinyTextProps) {
  const reduceMotion = useReducedMotion();

  // 45%~55% 구간에만 밝은 하이라이트가 지나가는 주기 그라디언트.
  const gradient = `linear-gradient(110deg, ${baseColor} 40%, ${shineColor} 50%, ${baseColor} 60%)`;

  const base: CSSProperties = {
    display: 'inline-block',
    backgroundImage: gradient,
    backgroundSize: '200% 100%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  };

  if (reduceMotion) {
    return (
      <span className={className} style={{ ...base, backgroundPosition: '100% 50%' }}>
        {children}
      </span>
    );
  }

  return (
    <motion.span
      className={className}
      style={base}
      initial={{ backgroundPosition: '200% 50%' }}
      animate={{ backgroundPosition: '-200% 50%' }}
      transition={{ duration, ease: 'linear', repeat: Infinity }}
    >
      {children}
    </motion.span>
  );
}
