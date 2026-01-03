
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MotionMode, RobotState } from '../types';
import { COLORS, ROBOT_CONFIG } from '../constants';

interface RobotSimulatorProps {
  currentMode: MotionMode;
  currentSpeed: number;
  isRunning: boolean;
}

const RobotSimulator: React.FC<RobotSimulatorProps> = ({ currentMode, currentSpeed, isRunning }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [robot, setRobot] = useState<RobotState>({
    x: 400,
    y: 300,
    angle: -Math.PI / 2,
    leftSpeed: 0,
    rightSpeed: 0,
  });

  // Adding undefined as initial value to fix "Expected 1 arguments, but got 0" error
  const requestRef = useRef<number | undefined>(undefined);
  // Adding undefined as initial value to fix "Expected 1 arguments, but got 0" error
  const lastTimeRef = useRef<number | undefined>(undefined);

  const drawField = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = COLORS.field;
    ctx.fillRect(0, 0, width, height);
    
    // Boundary
    ctx.strokeStyle = COLORS.boundary;
    ctx.lineWidth = 4;
    const p = ROBOT_CONFIG.padding;
    ctx.strokeRect(p, p, width - 2 * p, height - 2 * p);

    // Decorative grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = p; x < width - p; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, p); ctx.lineTo(x, height - p); ctx.stroke();
    }
    for (let y = p; y < height - p; y += 50) {
      ctx.beginPath(); ctx.moveTo(p, y); ctx.lineTo(width - p, y); ctx.stroke();
    }
  };

  const drawRobot = (ctx: CanvasRenderingContext2D, r: RobotState) => {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);

    const { L, W, axleX, axleY, wheelR, wheelT } = ROBOT_CONFIG;

    // Chassis
    ctx.fillStyle = COLORS.chassis;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    
    const x = -L / 2;
    const y = -W / 2;
    const radius = 12;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + L - radius, y);
    ctx.quadraticCurveTo(x + L, y, x + L, y + radius);
    ctx.lineTo(x + L, y + W - radius);
    ctx.quadraticCurveTo(x + L, y + W, x + L - radius, y + W);
    ctx.lineTo(x + radius, y + W);
    ctx.quadraticCurveTo(x, y + W, x, y + W - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    // Wheels
    const drawWheel = (wx: number, wy: number) => {
      ctx.fillStyle = COLORS.tire;
      ctx.fillRect(wx - wheelR, wy - wheelT / 2, 2 * wheelR, wheelT);
      ctx.fillStyle = COLORS.rim;
      ctx.fillRect(wx - wheelR + 5, wy - wheelT / 2 + 4, 2 * (wheelR - 5), wheelT - 8);
    };

    drawWheel(-axleX, -axleY);
    drawWheel(axleX, -axleY);
    drawWheel(-axleX, axleY);
    drawWheel(axleX, axleY);

    // Direction indicator
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(L/2 - 20, -10);
    ctx.lineTo(L/2 - 5, 0);
    ctx.lineTo(L/2 - 20, 10);
    ctx.fill();

    ctx.restore();
  };

  const update = useCallback((dt: number) => {
    if (!isRunning) return;

    let l = currentSpeed;
    let r = currentSpeed;

    switch (currentMode) {
      case MotionMode.BACKWARD: l = -currentSpeed; r = -currentSpeed; break;
      case MotionMode.TURN_LEFT: l = currentSpeed * 0.4; r = currentSpeed * 1.1; break;
      case MotionMode.TURN_RIGHT: l = currentSpeed * 1.1; r = currentSpeed * 0.4; break;
      case MotionMode.SPIN_LEFT: l = -currentSpeed; r = currentSpeed; break;
      case MotionMode.SPIN_RIGHT: l = currentSpeed; r = -currentSpeed; break;
      case MotionMode.STOP: l = 0; r = 0; break;
      default: break;
    }

    const v = (l + r) / 2;
    const omega = (l - r) / ROBOT_CONFIG.W;

    setRobot(prev => {
      let nx = prev.x + v * Math.cos(prev.angle) * dt;
      let ny = prev.y + v * Math.sin(prev.angle) * dt;
      let na = prev.angle + omega * dt;

      // Boundary Check
      const p = ROBOT_CONFIG.padding;
      const margin = ROBOT_CONFIG.L / 2 + 10;
      const canvas = canvasRef.current;
      if (canvas) {
        if (nx < p + margin) nx = p + margin;
        if (nx > canvas.width - p - margin) nx = canvas.width - p - margin;
        if (ny < p + margin) ny = p + margin;
        if (ny > canvas.height - p - margin) ny = canvas.height - p - margin;
      }

      return { x: nx, y: ny, angle: na, leftSpeed: l, rightSpeed: r };
    });
  }, [isRunning, currentMode, currentSpeed]);

  const animate = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      const dt = Math.min(0.05, (time - lastTimeRef.current) / 1000);
      update(dt);
    }
    lastTimeRef.current = time;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawField(ctx, canvas.width, canvas.height);
        drawRobot(ctx, robot);
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [robot, animate]);

  return (
    <div className="relative w-full h-full bg-white rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={600} 
        className="w-full h-full object-contain"
      />
      <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur px-3 py-2 rounded-lg border border-slate-700">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Left Side</p>
          <p className="text-xl font-mono text-emerald-400">{Math.abs(robot.leftSpeed).toFixed(0)} <span className="text-[10px] text-slate-500">px/s</span></p>
        </div>
        <div className="bg-slate-900/80 backdrop-blur px-3 py-2 rounded-lg border border-slate-700">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Right Side</p>
          <p className="text-xl font-mono text-emerald-400">{Math.abs(robot.rightSpeed).toFixed(0)} <span className="text-[10px] text-slate-500">px/s</span></p>
        </div>
      </div>
      {isRunning && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-1 rounded-full border border-emerald-500/50 animate-pulse">
          <div className="w-2 h-2 bg-emerald-400 rounded-full" />
          <span className="text-xs font-bold uppercase tracking-widest">Running Simulation</span>
        </div>
      )}
    </div>
  );
};

export default RobotSimulator;
