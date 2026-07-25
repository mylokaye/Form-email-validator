export type Country = { id: string; name: string };

export type CountryStatus = 'valid' | 'invalid' | 'duplicate';

export type CountryItem = {
  input: string;
  status: CountryStatus;
  country?: Country;
};

export function normalizeCountry(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

export function escapeXml(value: unknown) {
  return String(value ?? '').replace(/[<>&"']/g, (character) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character] ?? character
  ));
}

export function parseCountryCsv(text: string) {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const match = line.match(/^([^,]+),(?:"([^"]+)"|(.+))$/);
      return match ? { id: match[1].trim(), name: (match[2] ?? match[3]).trim() } : null;
    })
    .filter((country): country is Country => Boolean(country));
}

export function hasExpectedCountryHeaders(text: string) {
  return String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].trim() === 'nor_countryid,nor_name';
}

export function isValidCountryMaster(countries: Country[]) {
  const guids = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const names = new Set<string>();
  return countries.length > 0 && countries.every((country) => {
    const key = normalizeCountry(country.name);
    if (!key || !guids.test(country.id) || names.has(key)) return false;
    names.add(key);
    return true;
  });
}

export function validateCountries(input: string, countries: Country[]) {
  const master = new Map(countries.map((country) => [normalizeCountry(country.name), country]));
  const seen = new Set<string>();
  return String(input ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name): CountryItem => {
      const key = normalizeCountry(name);
      if (seen.has(key)) return { input: name, status: 'duplicate' };
      seen.add(key);
      const country = master.get(key);
      return country ? { input: name, status: 'valid', country } : { input: name, status: 'invalid' };
    });
}

export function buildFetchXml(items: CountryItem[]) {
  const values = items
    .filter((item) => item.status === 'valid' && item.country)
    .map((item) => `        <value uiname="${escapeXml(item.country?.name)}" uitype="nor_country">{${escapeXml(item.country?.id)}}</value>`);
  return [
    '<fetch version="1.0" mapping="logical" distinct="true">',
    '  <entity name="lead">',
    '    <filter type="and">',
    '      <condition attribute="nor_country" operator="in">',
    ...values,
    '      </condition>',
    '    </filter>',
    '  </entity>',
    '</fetch>',
  ].join('\n');
}
