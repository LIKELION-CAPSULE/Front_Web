// AnimateIcons Lucide. Copyright (c) 2025 Avijit Dey. MIT; Lucide ISC/Feather MIT.
// Local changes: inline span root, typed events, local cn and live reduced motion. See upstream.json.
"use client";

import { cn } from "@/shared/lib/cn";
import { useReducedMotion } from "@/shared/lib/use-reduced-motion";
import type { Variants } from "motion/react";
import {
 LazyMotion,
 domMin,
 m,
 useAnimation,
} from "motion/react";
import {
 forwardRef,
 useCallback,
 useImperativeHandle,
 useRef,
 type HTMLAttributes,
} from "react";
export interface EllipsisIconHandle {
 startAnimation: () => void;
 stopAnimation: () => void;
}

interface EllipsisIconProps extends Omit<
 HTMLAttributes<HTMLSpanElement>,
 | "color"
 | "onDrag"
 | "onDragStart"
 | "onDragEnd"
 | "onAnimationStart"
 | "onAnimationEnd"
 | "onAnimationIteration"
> {
 size?: number;
 duration?: number;
 isAnimated?: boolean;
 color?: string;
}

const EllipsisIcon = forwardRef<EllipsisIconHandle, EllipsisIconProps>(
 (
  {
   onMouseEnter,
   onMouseLeave,
   className,
   size = 24,
   duration = 1,
   isAnimated = true,
   color,
   ...props
  },
  ref,
 ) => {
  const controls = useAnimation();
  const reduced = useReducedMotion();
  const isControlled = useRef(false);

  useImperativeHandle(ref, () => {
   isControlled.current = true;
   return {
    startAnimation: () =>
     reduced ? controls.start("normal") : controls.start("animate"),
    stopAnimation: () => controls.start("normal"),
   };
  });

  const handleEnter = useCallback(
   (e: React.MouseEvent<HTMLSpanElement>) => {
    if (!isAnimated || reduced) return;
    if (!isControlled.current) controls.start("animate");
    else onMouseEnter?.(e);
   },
   [controls, reduced, isAnimated, onMouseEnter],
  );

  const handleLeave = useCallback(
   (e: React.MouseEvent<HTMLSpanElement>) => {
    if (!isControlled.current) controls.start("normal");
    else onMouseLeave?.(e);
   },
   [controls, onMouseLeave],
  );

  const dotVariants: Variants = {
   normal: { y: 0 },
   animate: (i: number) => ({
    y: [0, -3, 0],
    transition: {
     duration: 0.55 * duration,
     delay: i * 0.12 * duration,
     ease: "easeInOut",
    },
   }),
  };

  return (
   <LazyMotion features={domMin} strict>
    <m.span
     className={cn("inline-flex items-center justify-center", className)}
     onMouseEnter={handleEnter}
     onMouseLeave={handleLeave}
     {...props}
     style={{ color, ...props.style }}
    >
     <m.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial="normal"
      animate={controls}
     >
      <m.circle cx="5" cy="12" r="1" variants={dotVariants} custom={0} />
      <m.circle cx="12" cy="12" r="1" variants={dotVariants} custom={1} />
      <m.circle cx="19" cy="12" r="1" variants={dotVariants} custom={2} />
     </m.svg>
    </m.span>
   </LazyMotion>
  );
 },
);

EllipsisIcon.displayName = "EllipsisIcon";
export { EllipsisIcon };
