import { CardDraft } from './storage';

/**
 * Parse CSV text into CardDraft array
 * Supports multiple formats:
 * - Two columns: Front,Back
 * - Three columns: Front,Back,Notes (notes appended to back)
 */
export function parseCSV(csvText: string): CardDraft[] {
  if (!csvText.trim()) return [];

  const lines = csvText.trim().split('\n');
  const cards: CardDraft[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    // Split by comma, but handle quoted strings
    const parts = parseCSVLine(line);
    
    if (parts.length < 2) continue; // Skip invalid lines

    const front = parts[0]?.trim() || '';
    const back = parts[1]?.trim() || '';
    const notes = parts[2]?.trim() || '';

    if (!front || !back) continue; // Skip if front or back is empty

    cards.push({
      id: crypto.randomUUID(),
      front,
      back: notes ? `${back}\n\n💡 ${notes}` : back
    });
  }

  return cards;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Export flashcard set to CSV format
 */
export function exportToCSV(cards: { front: string; back: string }[]): string {
  const rows = cards.map(card => {
    // Escape quotes and wrap in quotes if contains comma or newline
    const front = escapeCSVField(card.front);
    const back = escapeCSVField(card.back);
    return `${front},${back}`;
  });

  return rows.join('\n');
}

function escapeCSVField(field: string): string {
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Validate CSV text before parsing
 */
export function validateCSV(csvText: string): { valid: boolean; error?: string; preview?: number } {
  if (!csvText.trim()) {
    return { valid: false, error: 'CSV text is empty' };
  }

  const lines = csvText.trim().split('\n');
  let validLines = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = parseCSVLine(line);
    if (parts.length >= 2 && parts[0]?.trim() && parts[1]?.trim()) {
      validLines++;
    }
  }

  if (validLines === 0) {
    return { valid: false, error: 'No valid cards found. Each line needs at least 2 columns: Front,Back' };
  }

  return { valid: true, preview: validLines };
}
