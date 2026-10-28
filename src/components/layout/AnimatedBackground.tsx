"use client";

import { useEffect, useRef } from "react";

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  
  constructor(w: number, h: number) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * 0.5; // Very slow drift
    this.vy = (Math.random() - 0.5) * 0.5;
    this.radius = Math.random() * 1.5 + 0.5;
  }

  update(w: number, h: number, mouseX: number, mouseY: number) {
    this.x += this.vx;
    this.y += this.vy;

    // Bounce off edges
    if (this.x < 0 || this.x > w) this.vx *= -1;
    if (this.y < 0 || this.y > h) this.vy *= -1;

    // Mouse interaction (repel slightly)
    if (mouseX !== -1 && mouseY !== -1) {
      const dx = mouseX - this.x;
      const dy = mouseY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const repelDist = 150;
      
      if (dist < repelDist) {
        const force = (repelDist - dist) / repelDist;
        this.x -= (dx / dist) * force * 1.5;
        this.y -= (dy / dist) * force * 1.5;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, color: string) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const isMobile = width < 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Lighter particle density on mobile to preserve CPU and battery
    const divisor = isMobile ? 24000 : 12000;
    const particleCount = Math.floor((width * height) / divisor);
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle(width, height));
    }

    let mouseX = -1;
    let mouseY = -1;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    
    const onMouseLeave = () => {
      mouseX = -1;
      mouseY = -1;
    };

    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);

    let isTabVisible = !document.hidden;
    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(animationFrameId);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', onResize);

    // Helper to get color from CSS variable
    const getVarColor = (varName: string, defaultRgb: string) => {
      const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      if (!val) return defaultRgb;
      
      // If it's a hex color, parse it
      if (val.startsWith('#')) {
        const hex = val.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return `${r}, ${g}, ${b}`;
      }
      return defaultRgb;
    };

    let isLight = document.documentElement.getAttribute('data-theme') === 'light';
    let glowRgb = getVarColor('--phantom-glow', isLight ? '59, 130, 246' : '99, 102, 241');

    const updateThemeColors = () => {
      isLight = document.documentElement.getAttribute('data-theme') === 'light';
      glowRgb = getVarColor('--phantom-glow', isLight ? '59, 130, 246' : '99, 102, 241');
    };

    const themeObserver = new MutationObserver(() => {
      updateThemeColors();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    let animationFrameId: number;

    const render = () => {
      const particleColor = `rgba(${glowRgb}, 0.6)`;
      const connectionDist = 120;
      const mouseConnectionDist = 180;

      // Clear the canvas
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.update(width, height, mouseX, mouseY);
        p.draw(ctx, particleColor);

        // Connect to other particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const opacity = 1 - (dist / connectionDist);
            ctx.strokeStyle = `rgba(${glowRgb}, ${opacity * (isLight ? 0.3 : 0.2)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // Connect to mouse
        if (mouseX !== -1 && mouseY !== -1) {
          const dx = p.x - mouseX;
          const dy = p.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < mouseConnectionDist) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouseX, mouseY);
            const opacity = 1 - (dist / mouseConnectionDist);
            ctx.strokeStyle = `rgba(${glowRgb}, ${opacity * (isLight ? 0.5 : 0.3)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      themeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-transparent">
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full"
      />
      
      {/* Rich ambient glowing orbs to backlight transparent frosted glass */}
      <div 
        className="absolute w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full top-[-10%] right-[-5%] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 75%)',
          filter: 'blur(90px)',
        }}
      />
      <div 
        className="absolute w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full bottom-[-10%] left-[-5%] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(129, 140, 248, 0.12) 0%, rgba(56, 189, 248, 0.07) 50%, transparent 75%)',
          filter: 'blur(100px)',
        }}
      />
      <div 
        className="absolute w-[35vw] h-[35vw] max-w-[450px] max-h-[450px] rounded-full top-[35%] left-[30%] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
          filter: 'blur(110px)',
        }}
      />
    </div>
  );
}
