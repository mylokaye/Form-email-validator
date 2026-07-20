/**
 * Tests for the Logic FetchXML tool.
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const logicCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'logic', 'logic.js'), 'utf8');
const countryMaster = fs.readFileSync(path.join(__dirname, '..', 'assets', 'countries.csv'), 'utf8');

function setupLogic() {
  document.body.innerHTML = '';
  window.Pattens = {};
  (0, eval)(logicCode);
  return window.Pattens.logic;
}

test('validates countries, identifies duplicates, and builds FetchXML', () => {
  const logic = setupLogic();
  const countries = logic.parseCsv('nor_countryid,nor_name\n11111111-1111-1111-1111-111111111111,COOK ISLANDS\n22222222-2222-2222-2222-222222222222,CUBA');
  const items = logic.validateCountries('Cook Islands\nCuba\nCuba\nAtlantis', countries);

  expect(items.map(item => item.status)).toEqual(['valid', 'valid', 'duplicate', 'invalid']);
  expect(logic.buildFetchXml(items)).toContain('<value uiname="COOK ISLANDS" uitype="nor_country">{11111111-1111-1111-1111-111111111111}</value>');
  expect(logic.buildFetchXml(items)).toContain('<value uiname="CUBA" uitype="nor_country">{22222222-2222-2222-2222-222222222222}</value>');
  expect(logic.buildFetchXml(items)).not.toContain('Atlantis');
});

test('rejects malformed GUIDs and duplicate normalized master names', () => {
  const logic = setupLogic();

  expect(logic.isValidMasterList([{ id: 'not-a-guid', name: 'CUBA' }])).toBe(false);
  expect(logic.isValidMasterList([
    { id: '11111111-1111-1111-1111-111111111111', name: 'CÔTE D\'IVOIRE' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'COTE D IVOIRE' }
  ])).toBe(false);
});

test('requires the country master headers used by the lookup mapping', () => {
  const logic = setupLogic();

  expect(logic.hasExpectedHeaders('nor_countryid,nor_name\n11111111-1111-1111-1111-111111111111,CUBA')).toBe(true);
  expect(logic.hasExpectedHeaders('nor_country,nor_name\n11111111-1111-1111-1111-111111111111,CUBA')).toBe(false);
});

test('ships a valid, unambiguous country master list', () => {
  const logic = setupLogic();

  expect(logic.hasExpectedHeaders(countryMaster)).toBe(true);
  expect(logic.isValidMasterList(logic.parseCsv(countryMaster))).toBe(true);
});
