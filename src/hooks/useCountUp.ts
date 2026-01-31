import { useState, useEffect, useRef, useMemo } from 'react';

interface UseCountUpOptions {
  duration?: number;
  decimals?: number;
}

export function useCountUp(
  endValue: number,
  options: UseCountUpOptions = {}
): number {
  const { duration = 800, decimals = 2 } = options;
  const [count, setCount] = useState(endValue);
  const previousValueRef = useRef(endValue);
  const frameRef = useRef<number>();
  const isFirstRender = useRef(true);

  // Memoizar o fator para evitar recálculos
  const factor = useMemo(() => Math.pow(10, decimals), [decimals]);

  useEffect(() => {
    // Evitar animação no primeiro render - mostrar valor direto
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setCount(endValue);
      previousValueRef.current = endValue;
      return;
    }

    const startValue = previousValueRef.current;
    const difference = endValue - startValue;

    // Se a diferença for muito pequena, não animar
    if (Math.abs(difference) < 0.01) {
      setCount(endValue);
      previousValueRef.current = endValue;
      return;
    }

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function mais suave
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const currentValue = startValue + difference * easeOutQuart;
      setCount(currentValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        previousValueRef.current = endValue;
        setCount(endValue); // Garantir valor final exato
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [endValue, duration]);

  // Round to specified decimal places
  return Math.round(count * factor) / factor;
}
