export type PageId = 'landing' | 'upload' | 'processing' | 'results' | 'dashboard' | 'admin'

export interface NavItem {
  id: PageId
  label: string
  shortcut: string
  section: string
  pageName: string
}

export interface SceneCard {
  id: string
  title: string
  caption: string
  psnr: number
  ssim: number
  sensor: string
  date: string
  pinned?: boolean
}
