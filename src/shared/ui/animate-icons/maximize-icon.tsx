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
export interface MaximizeIconHandle {
 startAnimation: () => void;
 stopAnimation: () => void;
}

interface MaximizeIconProps extends Omit<
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

const MaximizeIcon = forwardRef<MaximizeIconHandle, MaximizeIconProps>(
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

  const cornerVariants = (dx: number, dy: number): Variants => ({
   normal: { x: 0, y: 0 },
   animate: {
    x: [0, dx, -dx * 0.2, 0],
    y: [0, dy, -dy * 0.2, 0],
    transition: {
     duration: 0.6 * duration,
     ease: "easeInOut",
     times: [0, 0.35, 0.7, 1],
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
      <m.path
       d="M8 3H5a2 2 0 0 0-2 2v3"
       variants={cornerVariants(-1.5, -1.5)}
      />
      <m.path
       d="M21 8V5a2 2 0 0 0-2-2h-3"
       variants={cornerVariants(1.5, -1.5)}
      />
      <m.path
       d="M3 16v3a2 2 0 0 0 2 2h3"
       variants={cornerVariants(-1.5, 1.5)}
      />
      <m.path
       d="M16 21h3a2 2 0 0 0 2-2v-3"
       variants={cornerVariants(1.5, 1.5)}
      />
     </m.svg>
    </m.span>
   </LazyMotion>
  );
 },
);

MaximizeIcon.displayName = "MaximizeIcon";
export { MaximizeIcon };
