
export enum MotionMode {
  FORWARD = 'FORWARD',
  BACKWARD = 'BACKWARD',
  TURN_LEFT = 'TURN_LEFT',
  TURN_RIGHT = 'TURN_RIGHT',
  SPIN_LEFT = 'SPIN_LEFT',
  SPIN_RIGHT = 'SPIN_RIGHT',
  STOP = 'STOP'
}

export interface Block {
  id: string;
  type: MotionMode;
  duration: number; // in seconds
  speed: number;
}

export interface RobotState {
  x: number;
  y: number;
  angle: number;
  leftSpeed: number;
  rightSpeed: number;
}

export interface ProgramStep {
  blockId: string;
  progress: number;
}

export interface HardwareConfig {
  transmitterMac: string;
  receiverMac: string;
}
