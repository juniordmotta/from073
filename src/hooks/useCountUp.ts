import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  duration?: number;
  decimals?: number;
}

export function useCountUp(
  endValue: number,
  options: UseCountUpOptions = {}
): number {
  const { duration = 1000, decimals = 2 } = options;
  const [count, setCount] = useState(0);
  const previousValueRef = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const startValue = previousValueRef.current;
    const startTime = performance.now();
    const difference = endValue - startValue;

    if (difference === 0) {
      setCount(endValue);
      return;
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const currentValue = startValue + difference * easeOutQuart;
      setCount(currentValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        previousValueRef.current = endValue;
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
  const factor = Math.pow(10, decimals);
  return Math.round(count * factor) / factor;
}
