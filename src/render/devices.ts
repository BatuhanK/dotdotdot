import type { DeviceId } from '../lib/types'

export interface DeviceSpec {
  id: DeviceId
  name: string
  /** Logical screen size in points. */
  width: number
  height: number
  /** Display corner radius. */
  radius: number
  safeTop: number
  safeBottom: number
  cutout: { kind: 'island' | 'notch' | 'none'; w: number; h: number; y: number }
  status: { timeX: number; iconsRight: number; centerY: number }
  frame: { bezel: number; band: number; color: string; color2: string }
}

export const DEVICES: Record<DeviceId, DeviceSpec> = {
  'iphone-17-pro': {
    id: 'iphone-17-pro',
    name: 'iPhone 17 Pro',
    width: 402,
    height: 874,
    radius: 62,
    safeTop: 62,
    safeBottom: 34,
    cutout: { kind: 'island', w: 125, h: 36.67, y: 14 },
    status: { timeX: 73.67, iconsRight: 366.67, centerY: 32.67 },
    frame: { bezel: 5.5, band: 4, color: '#F28C49', color2: '#B85A23' },
  },
  'iphone-17-pro-max': {
    id: 'iphone-17-pro-max',
    name: 'iPhone 17 Pro Max',
    width: 440,
    height: 956,
    radius: 62,
    safeTop: 62,
    safeBottom: 34,
    cutout: { kind: 'island', w: 125, h: 36.67, y: 14 },
    status: { timeX: 83.5, iconsRight: 403.5, centerY: 32.67 },
    frame: { bezel: 5.5, band: 4, color: '#3C4A63', color2: '#1E2635' },
  },
  'iphone-16': {
    id: 'iphone-16',
    name: 'iPhone 16',
    width: 393,
    height: 852,
    radius: 55,
    safeTop: 59,
    safeBottom: 34,
    cutout: { kind: 'island', w: 125, h: 36.67, y: 11 },
    status: { timeX: 71.5, iconsRight: 358.5, centerY: 29.5 },
    frame: { bezel: 6, band: 3.5, color: '#E6E6EA', color2: '#A9A9B0' },
  },
  'iphone-14': {
    id: 'iphone-14',
    name: 'iPhone 14',
    width: 390,
    height: 844,
    radius: 47.33,
    safeTop: 47,
    safeBottom: 34,
    cutout: { kind: 'notch', w: 162, h: 33, y: 0 },
    status: { timeX: 54.5, iconsRight: 361, centerY: 23 },
    frame: { bezel: 6.5, band: 3.5, color: '#2B2B2E', color2: '#121214' },
  },
  'iphone-se': {
    id: 'iphone-se',
    name: 'iPhone SE',
    width: 375,
    height: 667,
    radius: 0,
    safeTop: 20,
    safeBottom: 0,
    cutout: { kind: 'none', w: 0, h: 0, y: 0 },
    status: { timeX: 187.5, iconsRight: 369, centerY: 10.5 },
    frame: { bezel: 14, band: 3, color: '#1D1D1F', color2: '#0B0B0C' },
  },
}

export const DEVICE_LIST = Object.values(DEVICES)
