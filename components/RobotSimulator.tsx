
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { BlockType, RobotState } from '../types';
import { COLORS, ROBOT_CONFIG } from '../constants';

interface RobotSimulatorProps {
  currentMode: BlockType;
  currentSpeed: number;
  isRunning: boolean;
  ledOn: boolean;
  buzzerOn: boolean;
  distance: number;
}

const RobotSimulator: React.FC<RobotSimulatorProps> = ({ currentMode, currentSpeed, isRunning, ledOn, buzzerOn, distance }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [robot, setRobot] = useState<RobotState>({
    x: 400,
    y: 300,
    angle: -Math.PI / 2,
    leftSpeed: 0,
    rightSpeed: 0,
    ledOn: false,
    buzzerOn: false,
    distance: 100
  });

  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);

  const drawField = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = COLORS.field;
    ctx.fillRect(0, 0, width, height);
    const p = ROBOT_CONFIG.padding;
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

    // Sonar Beam
    const beamLength = Math.max(20, distance * 2);
    const gradient = ctx.createLinearGradient(L/2, 0, L/2 + beamLength, 0);
    const beamColor = distance < 20 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(14, 165, 233, 0.2)';
    gradient.addColorStop(0, beamColor);
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(L/2, -15);
    ctx.lineTo(L/2 + beamLength, -40);
    ctx.lineTo(L/2 + beamLength, 40);
    ctx.lineTo(L/2, 15);
    ctx.fill();

    // Chassis
    ctx.fillStyle = COLORS.chassis;
    ctx.fillRect(-L/2, -W/2, L, W);

    // Ultrasonic Sensor Eyes (HC-SR04 Visual)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(L/2, -20, 12, 0, Math.PI * 2);
    ctx.arc(L/2, 20, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (ledOn) {
      ctx.fillStyle = COLORS.led;
      ctx.shadowBlur = 15;
      ctx.shadowColor = COLORS.led;
      ctx.beginPath(); ctx.arc(0, -20, 8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    const drawWheel = (wx: number, wy: number) => {
      ctx.fillStyle = COLORS.tire;
      ctx.fillRect(wx - wheelR, wy - wheelT / 2, 2 * wheelR, wheelT);
    };
    drawWheel(-axleX, -axleY); drawWheel(axleX, -axleY);
    drawWheel(-axleX, axleY); drawWheel(axleX, axleY);

    ctx.restore();
  };

  const update = useCallback((dt: number) => {
    if (!isRunning) return;
    let l = currentSpeed, r = currentSpeed;
    if (currentMode === BlockType.BACKWARD) { l = -currentSpeed; r = -currentSpeed; }
    else if (currentMode === BlockType.TURN_LEFT) { l = currentSpeed * 0.4; r = currentSpeed * 1.1; }
    else if (currentMode === BlockType.TURN_RIGHT) { l = currentSpeed * 1.1; r = currentSpeed * 0.4; }
    else if (currentMode === BlockType.SPIN_LEFT) { l = -currentSpeed; r = currentSpeed; }
    else if (currentMode === BlockType.SPIN_RIGHT) { l = currentSpeed; r = -currentSpeed; }
    else if (currentMode === BlockType.STOP || currentMode === BlockType.WAIT || currentMode === BlockType.ULTRASONIC) { l = 0; r = 0; }

    const v = (l + r) / 2;
    const omega = (l - r) / ROBOT_CONFIG.W;

    setRobot(prev => {
      let nx = prev.x + v * Math.cos(prev.angle) * dt;
      let ny = prev.y + v * Math.sin(prev.angle) * dt;
      let na = prev.angle + omega * dt;
      const p = ROBOT_CONFIG.padding;
      const margin = ROBOT_CONFIG.L / 2 + 10;
      if (nx < p + margin) nx = p + margin;
      if (nx > 800 - p - margin) nx = 800 - p - margin;
      if (ny < p + margin) ny = p + margin;
      if (ny > 600 - p - margin) ny = 600 - p - margin;
      return { ...prev, x: nx, y: ny, angle: na };
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
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [robot, animate]);

  return (
    <div className="relative w-full h-full bg-white rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
      <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-contain" />
      <div className="absolute bottom-6 left-6 flex gap-4 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-xl px-4 py-3 rounded-2xl border border-sky-500/30 shadow-lg">
          <p className="text-[9px] text-sky-400 uppercase font-black tracking-[0.2em] mb-1">Ultrasonic HC-SR04</p>
          <div className="flex items-end gap-1">
            <span className={`text-3xl font-mono font-bold ${distance < 20 ? 'text-rose-500' : 'text-sky-400'}`}>
              {Math.round(distance)}
            </span>
            <span className="text-slate-500 text-xs mb-1 font-bold">cm</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RobotSimulator;
