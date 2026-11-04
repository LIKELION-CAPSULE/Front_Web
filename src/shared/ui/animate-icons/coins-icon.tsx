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
export interface CoinsIconHandle {
 startAnimation: () => void;
 stopAnimation: () => void;
}

interface CoinsIconProps extends Omit<
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

const CoinsIcon = forwardRef<CoinsIconHandle, CoinsIconProps>(
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

  const flipVariants = (delay: number): Variants => ({
   normal: { scaleX: 1 },
   animate: {
    scaleX: [1, 0.2, 1.05, 1],
    transition: {
     duration: 0.55 * duration,
     ease: "easeInOut",
     times: [0, 0.4, 0.75, 1],
     delay: delay * duration,
    },
   },
  });

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
      animate={controls}
      initial="normal"
     >
      <m.g
       variants={flipVariants(0.15)}
       style={{ transformBox: "view-box", originX: "8px", originY: "16px" }}
      >
       <path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" />
       <path d="m6.134 14.768.866-.5 2 3.464" />
      </m.g>
      <m.g
       variants={flipVariants(0)}
       style={{ transformBox: "view-box", originX: "16px", originY: "8px" }}
      >
       <path d="M15 6h1v4" />
       <circle cx="16" cy="8" r="6" />
      </m.g>
     </m.svg>
    </m.span>
   </LazyMotion>
  );
 },
);

CoinsIcon.displayName = "CoinsIcon";
export { CoinsIcon };
