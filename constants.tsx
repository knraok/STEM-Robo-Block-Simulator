
import React from 'react';

export const COLORS = {
  chassis: '#10b981', // Emerald 500
  tire: '#0f172a',    // Slate 900
  rim: '#facc15',     // Yellow 400
  boundary: '#f43f5e', // Rose 500
  field: '#ffffff'
};

export const ROBOT_CONFIG = {
  L: 160,
  W: 110,
  wheelR: 35,
  wheelT: 25,
  axleX: 55,
  axleY: 70,
  padding: 40
};

export const MOTION_METADATA = {
  FORWARD: { label: 'Move Forward', color: 'bg-blue-500', icon: '↑' },
  BACKWARD: { label: 'Move Backward', color: 'bg-blue-600', icon: '↓' },
  TURN_LEFT: { label: 'Turn Left', color: 'bg-indigo-500', icon: '↶' },
  TURN_RIGHT: { label: 'Turn Right', color: 'bg-indigo-500', icon: '↷' },
  SPIN_LEFT: { label: 'Spin Left', color: 'bg-purple-500', icon: '↺' },
  SPIN_RIGHT: { label: 'Spin Right', color: 'bg-purple-500', icon: '↻' },
  STOP: { label: 'Wait/Stop', color: 'bg-slate-500', icon: '🛑' }
};
