"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { calculateTooltipPosition } from "./tooltip-card-position";

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export const Tooltip = ({
  content,
  children,
  containerClassName,
  open,
  interactive = false,
  followCursor = true,
  tooltipWidth = 240,
  offset = 12,
}) => {
  const [internalVisible, setInternalVisible] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [height, setHeight] = useState(0);
  const [position, setPosition] = useState({
    x: 0,
    y: 0,
  });
  const contentRef = useRef(null);
  const containerRef = useRef(null);
  const isControlled = typeof open === "boolean";
  const isVisible = isControlled ? open : internalVisible;

  useEffect(() => {
    if (isVisible && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [isVisible, content]);

  const calculatePosition = useCallback((mouseX, mouseY) => {
    if (!containerRef.current)
      return { x: mouseX + offset, y: mouseY + offset };

    return calculateTooltipPosition({
      mouseX,
      mouseY,
      containerRect: containerRef.current.getBoundingClientRect(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      tooltipWidth,
      tooltipHeight: contentRef.current?.scrollHeight ?? 0,
      offset,
    });
  }, [offset, tooltipWidth]);

  const updateMousePosition = useCallback((mouseX, mouseY) => {
    setMouse({ x: mouseX, y: mouseY });
    const newPosition = calculatePosition(mouseX, mouseY);
    setPosition(newPosition);
  }, [calculatePosition]);

  const handleMouseEnter = (e) => {
    if (!isControlled) setInternalVisible(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = followCursor ? e.clientX - rect.left : 0;
    const mouseY = followCursor ? e.clientY - rect.top : 0;
    updateMousePosition(mouseX, mouseY);
  };

  const handleMouseLeave = () => {
    if (isControlled) return;
    setMouse({ x: 0, y: 0 });
    setPosition({ x: 0, y: 0 });
    setInternalVisible(false);
  };

  const handleMouseMove = (e) => {
    if (!isVisible || !followCursor) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    updateMousePosition(mouseX, mouseY);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = touch.clientX - rect.left;
    const mouseY = touch.clientY - rect.top;
    updateMousePosition(mouseX, mouseY);
    if (!isControlled) setInternalVisible(true);
  };

  const handleTouchEnd = () => {
    // Delay hiding to allow for tap interaction
    setTimeout(() => {
      if (!isControlled) setInternalVisible(false);
      setMouse({ x: 0, y: 0 });
      setPosition({ x: 0, y: 0 });
    }, 2000);
  };

  const handleClick = (e) => {
    // Toggle visibility on click for mobile devices
    if (!isControlled && window.matchMedia("(hover: none)").matches) {
      e.preventDefault();
      if (isVisible) {
        setInternalVisible(false);
        setMouse({ x: 0, y: 0 });
        setPosition({ x: 0, y: 0 });
      } else {
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        updateMousePosition(mouseX, mouseY);
        setInternalVisible(true);
      }
    }
  };

  // Update position when tooltip becomes visible or content changes
  useEffect(() => {
    if (isVisible && contentRef.current) {
      const newPosition = calculatePosition(mouse.x, mouse.y);
      setPosition(newPosition);
    }
  }, [calculatePosition, height, isVisible, mouse.x, mouse.y]);

  return (
    <div
      ref={containerRef}
      className={classNames("relative inline-block", containerClassName)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}>
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            key={String(isVisible)}
            initial={{ height: 0, opacity: 1 }}
            animate={{ height, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 20,
            }}
            className={classNames(
              "absolute z-50 min-w-[15rem] overflow-hidden rounded-md border border-transparent bg-white shadow-sm ring-1 shadow-black/5 ring-black/5 dark:bg-neutral-900 dark:shadow-white/10 dark:ring-white/5",
              interactive ? "pointer-events-auto" : "pointer-events-none",
            )}
            style={{
              top: position.y,
              left: position.x,
            }}>
            <div
              ref={contentRef}
              className="p-2 text-sm text-neutral-600 md:p-4 dark:text-neutral-400">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
