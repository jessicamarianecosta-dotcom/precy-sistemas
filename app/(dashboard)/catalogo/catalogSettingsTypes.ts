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
  checkout_mode:     'buy' | 'quote'
  policies_text:     string | null
  seo_title:         string | null
  seo_description:   string | null
  seo_keywords:      string | null
  seo_image_url:     string | null
}

export const DEFAULT_CATALOG_SETTINGS: CatalogSettings = {
  slug: '', logo_url: null, banner_url: null, description: null,
  whatsapp: null, instagram: null, facebook: null, tiktok: null, youtube: null,
  pinterest: null, website: null, address: null, phone: null, email: null,
  city: null, state: null, zip_code: null, business_hours: null,
  theme_color: '#8B6C4F', checkout_mode: 'quote', policies_text: null,
  seo_title: null, seo_description: null, seo_keywords: null, seo_image_url: null,
}

export interface SettingsCardProps {
  value:    CatalogSettings
  onChange: (patch: Partial<CatalogSettings>) => void
}
