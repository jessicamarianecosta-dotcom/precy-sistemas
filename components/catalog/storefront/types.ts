export interface StorefrontSettings {
  company_id:   string
  slug:         string
  logo_url:     string | null
  banner_url:   string | null
  description:  string | null
  whatsapp:     string | null
  instagram:    string | null
  facebook:     string | null
  tiktok:       string | null
  youtube:      string | null
  pinterest:    string | null
  website:      string | null
  city:         string | null
  state:        string | null
  address:      string | null
  business_hours: string | null
  theme_color:  string
}

export interface StorefrontProduct {
  id:                     string
  name:                   string
  final_price:            number
  catalog_starting_price: number | null
  catalog_promo_price:    number | null
  catalog_photos:         string[]
  catalog_category_id:    string | null
  created_at:             string
}
