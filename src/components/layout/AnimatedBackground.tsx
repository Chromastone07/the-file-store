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

    const particleCount = Math.floor((width * height) / 12000); // Responsive particle count
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

    let animationFrameId: number;

    const render = () => {
      // Re-fetch color every frame to support dynamic theme switching (light/dark mode toggle)
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const glowRgb = getVarColor('--phantom-glow', isLight ? '59, 130, 246' : '99, 102, 241');
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
      
      {/* Fallback ambient glows just in case */}
      <div 
        className="absolute w-[40vw] h-[40vw] rounded-full top-[-15%] right-[-15%]"
        style={{
          background: 'var(--phantom-glow)',
          opacity: 0.03,
          filter: 'blur(120px)',
        }}
      />
      <div 
        className="absolute w-[35vw] h-[35vw] rounded-full bottom-[-15%] left-[-15%]"
        style={{
          background: 'var(--phantom-accent)',
          opacity: 0.02,
          filter: 'blur(150px)',
        }}
      />
    </div>
  );
}
