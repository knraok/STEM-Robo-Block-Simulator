
import React from 'react';
import { BlockType } from './types';

export const COLORS = {
  chassis: '#10b981', // Emerald 500
  tire: '#0f172a',    // Slate 900
  rim: '#facc15',     // Yellow 400
  boundary: '#f43f5e', // Rose 500
  field: '#ffffff',
  led: '#fbbf24',     // Amber 400
  buzzer: '#a855f7',  // Purple 500
  sensor: '#0ea5e9'   // Sky 500
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

export const MOTION_METADATA: Record<string, { label: string, color: string, icon: string, category: 'motion' | 'control' | 'action' | 'sensor' }> = {
  // Motion
  FORWARD: { label: 'Move Forward', color: 'bg-blue-500', icon: '↑', category: 'motion' },
  BACKWARD: { label: 'Move Backward', color: 'bg-blue-600', icon: '↓', category: 'motion' },
  TURN_LEFT: { label: 'Turn Left', color: 'bg-indigo-500', icon: '↶', category: 'motion' },
  TURN_RIGHT: { label: 'Turn Right', color: 'bg-indigo-500', icon: '↷', category: 'motion' },
  SPIN_LEFT: { label: 'Spin Left', color: 'bg-purple-600', icon: '↺', category: 'motion' },
  SPIN_RIGHT: { label: 'Spin Right', color: 'bg-purple-600', icon: '↻', category: 'motion' },
  STOP: { label: 'Stop Motors', color: 'bg-slate-600', icon: '🛑', category: 'motion' },
  
  // Control
  REPEAT: { label: 'Repeat Loop', color: 'bg-orange-500', icon: '🔁', category: 'control' },
  WAIT: { label: 'Wait Seconds', color: 'bg-orange-400', icon: '⌛', category: 'control' },
  
  // Sensors
  ULTRASONIC: { label: 'Distance <', color: 'bg-sky-500', icon: '📡', category: 'sensor' },
  
  // Actions
  LED: { label: 'Toggle LED', color: 'bg-amber-500', icon: '💡', category: 'action' },
  BUZZER: { label: 'Buzzer Sound', color: 'bg-pink-500', icon: '🔔', category: 'action' },
};
