import type { StoreThemePalettes } from '@/lib/catalog/theme/palette'
import type { BackgroundThemeId } from '@/lib/catalog/theme/backgroundThemes'
import type {
  BannerHeight, BannerImagePosition, BackgroundType, BackgroundImageSize,
} from '@/components/catalog/storefront/types'

export interface CatalogSettings {
  slug:              string
  logo_url:          string | null
  banner_url:        string | null
  description:       string | null
  whatsapp:          string | null
  instagram:         string | null
  facebook:          string | null
  tiktok:            string | null
  youtube:           string | null
  pinterest:         string | null
  website:           string | null
  address:           string | null
  phone:             string | null
  email:             string | null
  city:              string | null
  state:             string | null
  zip_code:          string | null
  business_hours:    string | null
  theme_color:       string
  theme_palette:     StoreThemePalettes | null
  checkout_mode:     'buy' | 'quote'
  policies_text:     string | null
  seo_title:         string | null
  seo_description:   string | null
  seo_keywords:      string | null
  seo_image_url:     string | null

  // Banner principal (hero) — Seção 2 do redesign
  banner_height:         BannerHeight
  banner_image_position: BannerImagePosition
  banner_rounded:        boolean
  banner_show_text:      boolean
  banner_button_text:    string | null
  banner_button_link:    string | null

  // Aparência da loja / fundo — Seção 3 do redesign
  background_type:            BackgroundType
  background_theme:           BackgroundThemeId
  background_color:           string | null
  background_image_url:       string | null
  background_image_size:      BackgroundImageSize
  background_image_position:  BannerImagePosition
  background_overlay_opacity: number
}

export const DEFAULT_CATALOG_SETTINGS: CatalogSettings = {
  slug: '', logo_url: null, banner_url: null, description: null,
  whatsapp: null, instagram: null, facebook: null, tiktok: null, youtube: null,
  pinterest: null, website: null, address: null, phone: null, email: null,
  city: null, state: null, zip_code: null, business_hours: null,
  theme_color: '#8B6C4F', theme_palette: null, checkout_mode: 'quote', policies_text: null,
  seo_title: null, seo_description: null, seo_keywords: null, seo_image_url: null,

  banner_height: 'md', banner_image_position: 'center', banner_rounded: true,
  banner_show_text: true, banner_button_text: null, banner_button_link: null,

  background_type: 'theme', background_theme: 'neutro', background_color: null,
  background_image_url: null, background_image_size: 'cover',
  background_image_position: 'center', background_overlay_opacity: 0.35,
}

export interface SettingsCardProps {
  value:    CatalogSettings
  onChange: (patch: Partial<CatalogSettings>) => void
}
