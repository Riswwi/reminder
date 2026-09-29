export const STORE_OPTIONS = ['Biedronka', 'Lidl', 'Kaufland', 'Aldi', 'Netto', 'Carrefour', 'Auchan'];

export function priceLabel(entry) {
  if (entry.shop || entry.promotion) return [entry.shop, entry.promotion].filter(Boolean).join(' · ') || '—';
  return entry.brand && entry.brand !== '-' ? entry.brand : '—';
}

export function priceExportText(items) {
  const lines = [
    '# Мои записи цен',
    `Экспортировано: ${new Date().toLocaleString('ru-RU')}`,
    `Товаров: ${items.length}; ценовых записей: ${items.reduce((sum, item) => sum + (item.stores?.length || 0), 0)}`,
    'Старые записи «магазин/акция» оставлены без разделения, если они были сохранены одним полем.',
    '',
  ];
  for (const item of items) {
    lines.push(`## ${String(item.name || 'Без названия').replace(/[\r\n]+/g, ' ')}`);
    for (const entry of item.stores || []) {
      const parts = [];
      if (entry.shop || entry.promotion) {
        parts.push(`Магазин: ${entry.shop || 'не указан'}`);
        parts.push(`Акция: ${entry.promotion || 'нет'}`);
      } else if (entry.brand && entry.brand !== '-') {
        parts.push(`Старая запись магазина/акции: ${entry.brand}`);
      } else {
        parts.push('Магазин: не указан');
        parts.push('Акция: нет');
      }
      const price = Number(entry.price);
      parts.push(`Цена: ${Number.isFinite(price) ? price.toFixed(2) : 'не указана'} ${entry.unit || ''}`);
      lines.push(`- ${parts.join('; ').replace(/[\r\n]+/g, ' ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
