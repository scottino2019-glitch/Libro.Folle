/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TrackPoint {
  x: number;
  y: number;
  pressure?: number;
}

export type DrawingTool = 'pen' | 'highlighter' | 'eraser';

export interface DrawingStroke {
  id: string;
  points: TrackPoint[];
  color: string;
  width: number;
  type: DrawingTool;
}

export interface AudioTrack {
  id: string;
  name: string;
  url: string;
  size?: string;
  duration?: number; // In seconds
}

export type PaperStyle = 'pdf' | 'lines' | 'grid' | 'blank';

export interface PageState {
  strokes: DrawingStroke[];
  redoStack: DrawingStroke[];
}
