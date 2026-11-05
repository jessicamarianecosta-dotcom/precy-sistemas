export const NEW_PRODUCT_THRESHOLD_DAYS = 14

export function isNewProduct(createdAt: string): boolean {
  return (Date.now() - new Date(createdAt).getTime()) / 86400000 <= NEW_PRODUCT_THRESHOLD_DAYS
}
