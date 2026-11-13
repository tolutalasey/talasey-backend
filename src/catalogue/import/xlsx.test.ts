import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { readWorkbook, records, WorkbookError } from './xlsx.js';

const sheetXml = (rows: string) =>
  `<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`;

function workbook() {
  return zipSync({
    'xl/workbook.xml': strToU8(
      '<workbook><sheets><sheet name="Start here" sheetId="1" r:id="rId1"/><sheet name="Products" sheetId="2" r:id="rId2"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
    ),
    'xl/sharedStrings.xml': strToU8(
      '<sst><si><t>SKU</t></si><si><t>Name</t></si><si><r><t>Sienna </t></r><r><t xml:space="preserve">planter &amp; base</t></r></si></sst>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      sheetXml('<row r="1"><c r="A1" t="inlineStr"><is><t>Read me</t></is></c></row>'),
    ),
    'xl/worksheets/sheet2.xml': strToU8(
      sheetXml(
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Price</t></is></c></row>' +
          '<row r="2"><c r="A2" t="inlineStr"><is><t>SIENNA</t></is></c><c r="B2" t="s"><v>2</v></c><c r="C2"><v>1022.43</v></c></row>' +
          '<row r="3"><c r="A3" s="1"/></row>' +
          '<row r="4"><c r="A4" t="inlineStr"><is><t>LINEA</t></is></c><c r="C4" t="str"><v>951.71</v></c></row>',
      ),
    ),
  });
}

describe('readWorkbook', () => {
  it('lists the sheets and reads shared, inline and number cells by column', () => {
    const book = readWorkbook(workbook());
    expect(book.sheetNames).toEqual(['Start here', 'Products']);
    expect(book.rows('Products')).toEqual([
      ['SKU', 'Name', 'Price'],
      ['SIENNA', 'Sienna planter & base', '1022.43'],
      [null],
      ['LINEA', null, '951.71'],
    ]);
  });

  it('turns rows into records by header, skipping blank rows', () => {
    expect(records(readWorkbook(workbook()).rows('Products'))).toEqual([
      { SKU: 'SIENNA', Name: 'Sienna planter & base', Price: '1022.43' },
      { SKU: 'LINEA', Name: null, Price: '951.71' },
    ]);
  });

  it('says which sheet is missing', () => {
    expect(() => readWorkbook(workbook()).rows('Orders')).toThrow(
      'The workbook has no "Orders" sheet.',
    );
  });

  it('rejects a file that is not a workbook', () => {
    expect(() => readWorkbook(zipSync({ 'a.txt': strToU8('hi') }))).toThrow(WorkbookError);
  });
});
