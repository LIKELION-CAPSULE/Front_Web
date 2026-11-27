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
export interface XIconHandle {
 startAnimation: () => void;
 stopAnimation: () => void;
}

interface XIconProps extends Omit<
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
 isAnimated?: boolean;
 color?: string;
}

const XIcon = forwardRef<XIconHandle, XIconProps>(
 (
  {
   onMouseEnter,
   onMouseLeave,
   className,
   size = 24,
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

  // CAPSULE: close icons stay still on hover/focus (no quarter turn 2026-11-27, no scale pulse 2026-11-28); the
  // button's colour and background hover is the feedback. Both states are the resting pose.
  const resting = { rotate: 0, scale: 1, transition: { duration: 0 } };
  const crossVariants: Variants = { normal: resting, animate: resting };

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
       variants={crossVariants}
       style={{ transformBox: "view-box", originX: "12px", originY: "12px" }}
      >
       <path d="M18 6 6 18" />
       <path d="m6 6 12 12" />
      </m.g>
     </m.svg>
    </m.span>
   </LazyMotion>
  );
 },
);

XIcon.displayName = "XIcon";
export { XIcon };
