export type Country = { id: string; name: string };
export type State = Country;

export type CountryStatus = 'valid' | 'invalid' | 'duplicate' | 'ambiguous';

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

export function parseStateCsv(text: string) {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const match = line.match(/^(?:"([^"]+)"|([^,]+)),(?:"([^"]+)"|(.+))$/);
      return match ? { name: (match[1] ?? match[2]).trim(), id: (match[3] ?? match[4]).trim() } : null;
    })
    .filter((state): state is State => Boolean(state));
}

export function hasExpectedCountryHeaders(text: string) {
  return String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].trim() === 'nor_countryid,nor_name';
}

export function hasExpectedStateHeaders(text: string) {
  return String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].trim() === 'State,stateid';
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

export function isValidStateMaster(states: State[]) {
  const guids = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return states.length > 0 && states.every((state) => Boolean(normalizeCountry(state.name)) && guids.test(state.id));
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

export function validateStates(input: string, states: State[]) {
  const master = new Map<string, State[]>();
  states.forEach((state) => {
    const key = normalizeCountry(state.name);
    master.set(key, [...(master.get(key) ?? []), state]);
  });
  const seen = new Set<string>();
  return String(input ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name): CountryItem => {
      const key = normalizeCountry(name);
      if (seen.has(key)) return { input: name, status: 'duplicate' };
      seen.add(key);
      const matches = master.get(key) ?? [];
      if (matches.length === 1) return { input: name, status: 'valid', country: matches[0] };
      return matches.length ? { input: name, status: 'ambiguous' } : { input: name, status: 'invalid' };
    });
}

export function buildFetchXml(items: CountryItem[], type: 'country' | 'state' = 'country') {
  const entity = type === 'state' ? 'nor_state' : 'nor_country';
  const values = items
    .filter((item) => item.status === 'valid' && item.country)
    .map((item) => `        <value uiname="${escapeXml(item.country?.name)}" uitype="${entity}">{${escapeXml(item.country?.id)}}</value>`);
  return [
    '<fetch version="1.0" mapping="logical" distinct="true">',
    '  <entity name="lead">',
    '    <filter type="and">',
    `      <condition attribute="${entity}" operator="in">`,
    ...values,
    '      </condition>',
    '    </filter>',
    '  </entity>',
    '</fetch>',
  ].join('\n');
}
