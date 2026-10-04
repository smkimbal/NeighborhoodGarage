// Drafts use visible evidence and broad tool functions, never invented specifications.
const toolTypes = [
  [/\bchainsaw\b/i, 'Chainsaw', 'Garden', 'cutting branches and timber'],
  [/\blawn mower\b/i, 'Lawn mower', 'Garden', 'maintaining the lawn'],
  [/\bhedge trimmer\b/i, 'Hedge trimmer', 'Garden', 'trimming hedges'],
  [/\b(?:power |cordless |hammer )?drill\b/i, 'Power drill', 'Power tools', 'drilling holes and driving fasteners'],
  [/\bscrewdriver\b/i, 'Screwdriver', 'Home & DIY', 'driving and removing screws'],
  [/\bsaw\b/i, 'Saw', 'Power tools', 'cutting materials for home projects'],
  [/\bhammer\b/i, 'Hammer', 'Home & DIY', 'driving nails and general home projects'],
  [/\bwrench\b/i, 'Wrench', 'Home & DIY', 'tightening and loosening fasteners'],
  [/\bsander\b/i, 'Sander', 'Power tools', 'smoothing surfaces'],
  [/\b(?:vise|vice)\b/i, 'Vise', 'Home & DIY', 'holding a workpiece securely'],
  [/\blathe\b/i, 'Lathe', 'Power tools', 'turning a workpiece'],
  [/\bgrinder\b/i, 'Grinder', 'Power tools', 'grinding and finishing materials'],
  [/\bchisel\b/i, 'Chisel', 'Home & DIY', 'shaping and trimming material'],
  [/\b(?:carpenter.?s |hand )?plane\b/i, 'Hand plane', 'Home & DIY', 'shaping and smoothing wood'],
  [/\bshovel\b/i, 'Shovel', 'Garden', 'digging and moving loose material'],
  [/\brake\b/i, 'Rake', 'Garden', 'clearing leaves and garden debris'],
  [/\bwheelbarrow\b/i, 'Wheelbarrow', 'Garden', 'moving garden materials'],
  [/\baxe\b/i, 'Axe', 'Garden', 'chopping wood'],
  [/\bladder\b/i, 'Ladder', 'Home & DIY', 'reaching elevated work areas'],
  [/\bpaintbrush\b/i, 'Paintbrush', 'Home & DIY', 'painting home projects'],
  [/\b(?:spirit )?level\b/i, 'Level', 'Home & DIY', 'checking level and alignment'],
  [/\btape measure\b/i, 'Tape measure', 'Home & DIY', 'measuring home projects'],
  [/\bpliers\b/i, 'Pliers', 'Home & DIY', 'gripping and bending materials'],
  [/\b(?:car|floor|bottle) jack\b/i, 'Car jack', 'Automotive', 'lifting a vehicle with appropriate safety supports']
];
const brands = [
  ['DEWALT', /\bdewalt\b/i, ['dewalt.com']],
  ['Makita', /\bmakita\b/i, ['makitatools.com', 'makita.com']],
  ['Milwaukee', /\bmilwaukee\b/i, ['milwaukeetool.com']],
  ['Bosch', /\bbosch\b/i, ['boschtools.com']],
  ['RYOBI', /\bryobi\b/i, ['ryobitools.com']],
  ['BLACK+DECKER', /\bblack\s*[+&-]?\s*decker\b/i, ['blackanddecker.com']],
  ['CRAFTSMAN', /\bcraftsman\b/i, ['craftsman.com']],
  ['RIDGID', /\bridgid\b/i, ['ridgid.com']],
  ['SKIL', /\bskil\b/i, ['skil.com']],
  ['Husqvarna', /\bhusqvarna\b/i, ['husqvarna.com']],
  ['STIHL', /\bstihl\b/i, ['stihl.com', 'stihlusa.com']],
  ['FLEX', /\bflex\b/i, ['flexpowertools.com']]
];
const identifier = value => typeof value === 'string' && value.length <= 40 && /^[a-z0-9][a-z0-9_/-]*$/i.test(value) && /\d/.test(value) ? value : null;
const cleanBarcode = value => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 250) : '';
const typeFor = text => toolTypes.find(([pattern]) => pattern.test(text));

export function suggestionForPredictions(predictions = []) {
  const match = predictions.find(p => p.probability >= .12 && typeFor(p.className || ''));
  if (!match) return {notice: 'No reliable tool match. Enter its details or add a clear close-up of the label.'};
  const [, title, category, purpose] = typeFor(match.className);
  return {title, category, purpose, notice: `Possible match: ${title.toLowerCase()} (${Math.round(match.probability * 100)}% model confidence).`};
}

export function labelTextForOcr(data = {}) {
  const lines = (data.blocks || []).flatMap(block => (block.paragraphs || []).flatMap(paragraph => paragraph.lines || []));
  if (lines.length) return lines.map(line => (line.words || []).filter(word => word.confidence >= 65).map(word => word.text).join(' ')).join('\n');
  return data.confidence >= 65 ? data.text || '' : '';
}

export function readLabelEvidence(text = '', barcodeValues = []) {
  text = String(text).slice(0, 4000);
  const barcodes = [...new Set(barcodeValues.map(cleanBarcode).filter(Boolean))].slice(0, 3);
  const modelCandidates = [], hostBrands = [];
  // Decode identifiers only. Never navigate to QR URLs or send a barcode to a lookup service.
  const barcodeText = barcodes.map(value => {
    try {
      const url = new URL(value), brand = brands.find(([, , hosts]) => hosts.includes(url.hostname.replace(/^www\./, '')));
      if (brand && ['https:', 'http:'].includes(url.protocol)) {
        hostBrands.push(brand[0]);
        const model = url.searchParams.get('model') || url.searchParams.get('part') || url.searchParams.get('sku') || url.pathname.match(/\/(?:products?|tools?)\/([^/]+)/i)?.[1];
        if (identifier(model)) modelCandidates.push(model);
      }
      return '';
    } catch {}
    try {
      const data = JSON.parse(value);
      const model = data?.model || data?.part || data?.sku;
      if (identifier(model)) modelCandidates.push(model);
      return typeof data?.brand === 'string' ? data.brand.slice(0, 60) : '';
    } catch { return /^\d+$/.test(value) ? '' : value; }
  }).join('\n');
  const combined = `${text}\n${barcodeText}`;
  const brandMatches = [...new Set([...hostBrands, ...brands.filter(([, pattern]) => pattern.test(combined)).map(([name]) => name)])];
  for (const line of combined.split(/\r?\n/)) {
    const match = line.match(/\b(?:MODEL(?:\s*(?:NO\.?|NUMBER|#))?|CAT(?:ALOG)?(?:\s*(?:NO\.?|NUMBER|#))?|PART(?:\s*(?:NO\.?|NUMBER|#))?|P\/N)\s*[:.#-]?\s*([A-Z0-9][A-Z0-9_/-]*)/i);
    if (identifier(match?.[1])) modelCandidates.push(match[1]);
  }
  const models = [...new Set(modelCandidates.map(value => value.toUpperCase()))];
  return {brand: brandMatches.length === 1 ? brandMatches[0] : null, model: models.length === 1 ? models[0] : null, barcodes, ambiguous: brandMatches.length > 1 || models.length > 1};
}

export function suggestionForEvidence(predictions, {text = '', barcodes = []} = {}) {
  const visual = suggestionForPredictions(predictions), label = readLabelEvidence(text, barcodes);
  const printedType = typeFor(text);
  const title = visual.title || printedType?.[1];
  const category = visual.category || printedType?.[2];
  const purpose = visual.purpose || printedType?.[3];
  const result = {...label, category};
  if (title || label.brand) {
    result.title = `${label.brand ? label.brand + ' ' : ''}${title || 'tool'}`;
    result.description = `${result.title} for ${purpose || 'neighborhood projects'}.`;
    if (label.model) result.description += `\nModel / part number read: ${label.model}.`;
    if (label.barcodes.length) result.description += `\nBarcode read: ${label.barcodes.join(', ')}.`;
  }
  const evidence = [label.brand && `Brand read: ${label.brand}.`, label.model && `Model / part number read: ${label.model}.`, label.barcodes.length && 'Barcode read locally.'].filter(Boolean);
  result.notice = [visual.title ? visual.notice : title ? `Tool type read from the label: ${title}.` : 'Tool type was not identified reliably.', ...evidence,
    label.ambiguous && 'Conflicting label details were left unfilled.',
    label.barcodes.some(value => /^\d+$/.test(value)) && 'A numeric barcode alone does not identify a brand without a product catalog.',
    'Review the suggested title, description and identifiers. Add condition, accessories, price and deposit yourself.'].filter(Boolean).join(' ');
  return result;
}

// A repeat scan can improve an untouched AI draft, but cannot replace the owner's edits.
export function applySuggestionToDraft(current, suggestion, {previous = {}, categoryTouched = false} = {}) {
  const next = {...current};
  for (const key of ['title', 'description']) {
    if (suggestion[key] && (!current[key]?.trim() || current[key] === previous[key])) next[key] = suggestion[key];
  }
  if (suggestion.category && !categoryTouched) next.category = suggestion.category;
  return next;
}
