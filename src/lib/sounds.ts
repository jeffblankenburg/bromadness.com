export interface SoundItem {
  id: string
  name: string
  audio_url: string
  image_url: string
  created_by: string
  sort_order: number
  category_ids: string[]
}

export interface SoundCategory {
  id: string
  name: string
  sort_order: number
  created_by: string
}
